import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { safeError } from './diagnostics.js';
const timestampSchema = z
  .string()
  .regex(/^\d{1,12}$/)
  .refine((value) => {
    const ms = Number(value) * 1000;
    return ms >= 0 && ms <= 253402300799000;
  });
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import { decrypt, hash, validSignature } from '../../../packages/domain/src/security.js';
import { append, fail } from './helpers.js';
export const payloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z
    .array(
      z.object({
        id: z.string().min(1).max(190),
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z
                .object({
                  metadata: z.object({ phone_number_id: z.string() }).optional(),
                  messages: z
                    .array(
                      z
                        .object({
                          id: z.string().min(1).max(190),
                          from: z.string().regex(/^\d{6,20}$/),
                          timestamp: timestampSchema,
                          type: z.string().min(1).max(30),
                          text: z.object({ body: z.string().max(4096) }).optional(),
                        })
                        .passthrough()
                        .refine((message) => message.type !== 'text' || !!message.text),
                    )
                    .max(100)
                    .optional(),
                  contacts: z
                    .array(
                      z.object({
                        wa_id: z.string().min(1).max(190),
                        profile: z.object({ name: z.string() }),
                      }),
                    )
                    .optional(),
                  statuses: z
                    .array(
                      z.object({
                        id: z.string().min(1).max(190),
                        status: z.enum(['sent', 'delivered', 'read', 'failed']),
                        timestamp: timestampSchema,
                        pricing: z
                          .object({
                            billable: z.boolean().optional(),
                            category: z.string().max(30).optional(),
                          })
                          .passthrough()
                          .optional(),
                        errors: z.array(z.object({ code: z.number() })).optional(),
                      }),
                    )
                    .max(100)
                    .optional(),
                })
                .passthrough(),
            }),
          )
          .max(100),
      }),
    )
    .max(100),
});
export async function registerWebhook(app: FastifyInstance, database = db) {
  await app.register(async (scope) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );
    scope.get('/webhooks/meta/:id', async (req, reply) => {
      const id = z.object({ id: z.string().uuid() }).parse(req.params).id;
      const q = z
        .object({
          'hub.mode': z.literal('subscribe'),
          'hub.verify_token': z.string(),
          'hub.challenge': z.string().max(200),
        })
        .parse(req.query);
      const a = await database.account.findUnique({ where: { id } });
      if (!a || a.mode !== 'meta' || a.verifyHash !== hash(q['hub.verify_token']))
        fail(403, 'Verificação inválida');
      return reply.type('text/plain').send(q['hub.challenge']);
    });
    scope.post('/webhooks/meta/:id', async (req) => {
      const id = z.object({ id: z.string().uuid() }).parse(req.params).id;
      const a = await database.account.findUnique({ where: { id } });
      if (!a || a.mode !== 'meta') fail(404, 'Integração não encontrada');
      // Internal ID is bounded and cannot be supplied through client headers.
      const requestId = randomUUID();
      await database.account.update({
        where: { id },
        data: {
          lastWebhookAttempt: new Date(),
          lastWebhookStatus: 'attempt',
          lastWebhookErrorCode: null,
          lastWebhookErrorMessage: null,
          lastWebhookRequestId: requestId,
        },
      });
      let failureCode = 'INTERNAL_ERROR';
      try {
        if (!a.active) {
          failureCode = 'ACCOUNT_INACTIVE';
          fail(403, 'Conta desativada');
        }
        const raw = req.body;
        if (!Buffer.isBuffer(raw)) {
          failureCode = 'PAYLOAD_INVALID';
          fail(422, 'Payload inválido');
        }
        failureCode = 'CREDENTIAL_ERROR';
        if (!a.appSecretEncrypted) fail(503, 'Credencial indisponível');
        const secret = decrypt(a.appSecretEncrypted, config.ENCRYPTION_KEY);
        failureCode = 'SIGNATURE_INVALID';
        if (
          !validSignature(
            raw,
            typeof req.headers['x-hub-signature-256'] === 'string'
              ? req.headers['x-hub-signature-256']
              : undefined,
            secret,
          )
        )
          fail(403, 'Assinatura inválida');
        failureCode = 'PAYLOAD_INVALID';
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch {
          fail(422, 'Payload inválido');
        }
        const b = payloadSchema.parse(parsed),
          digest = hash(raw);
        // Validate all routing identities before dedup or any domain writes.
        for (const entry of b.entry) {
          if (entry.id !== a.wabaId) {
            failureCode = 'WABA_MISMATCH';
            fail(403, 'WABA divergente');
          }
          for (const change of entry.changes) {
            if ((change.value.messages || change.value.statuses) && !change.value.metadata) {
              failureCode = 'PHONE_MISMATCH';
              fail(422, 'Número ausente');
            }
            if (
              change.value.metadata &&
              change.value.metadata.phone_number_id !== a.phoneNumberId
            ) {
              failureCode = 'PHONE_MISMATCH';
              fail(403, 'Número divergente');
            }
          }
        }
        failureCode = 'INTERNAL_ERROR';
        await database.$transaction(
          async (tx) => {
            // Lock account: serializes envelope dedup and contact creation for one integration.
            await tx.$queryRaw`SELECT id FROM Account WHERE id = ${a.id} FOR UPDATE`;
            const current = await tx.account.findUniqueOrThrow({ where: { id: a.id } });
            if (!current.active) fail(403, 'Conta desativada');
            if (
              await tx.webhookEvent.findUnique({
                where: { accountId_digest: { accountId: a.id, digest } },
              })
            )
              return;
            for (const e of b.entry) {
              if (e.id !== a.wabaId) fail(403, 'WABA divergente');
              for (const change of e.changes) {
                if (change.field !== 'messages') continue;
                const value = change.value;
                if (value.metadata && value.metadata.phone_number_id !== a.phoneNumberId)
                  fail(403, 'Número divergente');
                for (const m of value.messages ?? []) {
                  if (!value.metadata) fail(422, 'Número ausente');
                  const existing = await tx.message.findUnique({
                    where: { providerId: m.id },
                    include: { conversation: true },
                  });
                  if (existing) {
                    if (
                      existing.companyId !== a.companyId ||
                      existing.conversation.accountId !== a.id
                    ) {
                      failureCode = 'PROVIDER_ID_CONFLICT';
                      fail(409, 'Identificador de mensagem conflitante');
                    }
                    continue;
                  }
                  const name =
                    value.contacts?.find((c) => c.wa_id === m.from)?.profile.name.slice(0, 100) ??
                    m.from;
                  const contact = await tx.contact.upsert({
                    where: { companyId_waId: { companyId: a.companyId, waId: m.from } },
                    create: { companyId: a.companyId, waId: m.from, name },
                    update: {},
                  });
                  const c = await tx.conversation.upsert({
                    where: {
                      companyId_accountId_contactId: {
                        companyId: a.companyId,
                        accountId: a.id,
                        contactId: contact.id,
                      },
                    },
                    create: { companyId: a.companyId, accountId: a.id, contactId: contact.id },
                    update: {},
                  });
                  const timestamp = new Date(Number(m.timestamp) * 1000);
                  if (!Number.isFinite(timestamp.getTime())) fail(422, 'Timestamp inválido');
                  await append(tx, a.companyId, c.id, {
                    originAt: timestamp,
                    direction: 'incoming',
                    type: m.type,
                    body:
                      m.type === 'text'
                        ? (m.text?.body ?? '')
                        : '[Mídia recebida na Meta — download automático ainda não implementado]',
                    providerId: m.id,
                    status: 'received',
                    // Raw media can contain private captions/URLs; preserve type only in this beta.
                    payload: undefined,
                  });
                  await tx.conversation.update({
                    where: { id: c.id },
                    data: {
                      status: 'open',
                      lastCustomerAt:
                        c.lastCustomerAt && c.lastCustomerAt > timestamp
                          ? c.lastCustomerAt
                          : timestamp,
                    },
                  });
                }
                for (const s of value.statuses ?? []) {
                  const key = hash(
                    `${a.id}:${s.id}:${s.status}:${s.timestamp}:${JSON.stringify(s.pricing ?? {})}`,
                  );
                  await tx.providerStatus.upsert({
                    where: { digest: key },
                    create: {
                      accountId: a.id,
                      providerId: s.id,
                      status: s.status,
                      occurredAt: new Date(Number(s.timestamp) * 1000),
                      digest: key,
                      category: s.pricing?.category,
                      billable: s.pricing?.billable,
                      errorCode: s.errors?.[0] ? String(s.errors[0].code) : undefined,
                    },
                    update: {},
                  });
                }
              }
            }
            await tx.webhookEvent.create({ data: { accountId: a.id, digest } });
          },
          { timeout: 15000 },
        );
        const completedAt = new Date();
        await database.account.updateMany({
          where: {
            id,
            OR: [{ lastWebhookSuccess: null }, { lastWebhookSuccess: { lt: completedAt } }],
          },
          data: { lastWebhook: completedAt, lastWebhookSuccess: completedAt },
        });
        await database.account.updateMany({
          where: { id, lastWebhookRequestId: requestId },
          data: {
            lastWebhookStatus: 'success',
            lastWebhookErrorCode: null,
            lastWebhookErrorMessage: null,
          },
        });
        console.info(
          JSON.stringify({
            level: 'info',
            requestId: req.id,
            webhookRequestId: requestId,
            method: req.method,
            path: req.routeOptions.url,
            code: 'WEBHOOK_SUCCESS',
          }),
        );
        return { ok: true };
      } catch (error) {
        const safe = safeError(error);
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 403 && failureCode === 'INTERNAL_ERROR') failureCode = 'ACCOUNT_INACTIVE';
        const code =
          failureCode === 'INTERNAL_ERROR' ? (safe.errorCode ?? failureCode) : failureCode;
        try {
          await database.account.updateMany({
            where: { id, lastWebhookRequestId: requestId },
            data: {
              lastWebhookStatus: failureCode === 'SIGNATURE_INVALID' ? 'untrusted' : 'error',
              lastWebhookErrorCode: code,
              lastWebhookErrorMessage: 'Webhook rejeitado ou não processado',
            },
          });
        } catch (diagnosticError) {
          console.error(
            JSON.stringify({
              level: 'error',
              requestId: req.id,
              code: 'WEBHOOK_DIAGNOSTIC_FAILED',
              ...safeError(diagnosticError),
            }),
          );
        }
        console.warn(
          JSON.stringify({
            level: 'warn',
            requestId: req.id,
            webhookRequestId: requestId,
            method: req.method,
            path: req.routeOptions.url,
            code,
            ...safe,
          }),
        );
        throw error;
      }
    });
  });
}
