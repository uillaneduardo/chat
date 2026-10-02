import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import { decrypt, hash, validSignature } from '../../../packages/domain/src/security.js';
import { append, fail } from './helpers.js';
const payloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z
    .array(
      z.object({
        id: z.string(),
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
                          id: z.string(),
                          from: z.string().regex(/^\d{6,20}$/),
                          timestamp: z.string().regex(/^\d+$/),
                          type: z.string(),
                          text: z.object({ body: z.string().max(4096) }).optional(),
                        })
                        .passthrough(),
                    )
                    .max(100)
                    .optional(),
                  contacts: z
                    .array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }) }))
                    .optional(),
                  statuses: z
                    .array(
                      z.object({
                        id: z.string(),
                        status: z.enum(['sent', 'delivered', 'read', 'failed']),
                        timestamp: z.string().regex(/^\d+$/),
                        pricing: z
                          .object({
                            billable: z.boolean().optional(),
                            category: z.string().optional(),
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
export async function registerWebhook(app: FastifyInstance) {
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
      const a = await db.account.findUnique({ where: { id } });
      if (!a || a.mode !== 'meta' || a.verifyHash !== hash(q['hub.verify_token']))
        fail(403, 'Verificação inválida');
      return reply.type('text/plain').send(q['hub.challenge']);
    });
    scope.post('/webhooks/meta/:id', async (req) => {
      const id = z.object({ id: z.string().uuid() }).parse(req.params).id;
      const a = await db.account.findUnique({ where: { id } });
      if (!a || a.mode !== 'meta' || !a.appSecretEncrypted) fail(404, 'Integração não encontrada');
      const raw = req.body as Buffer;
      if (
        !validSignature(
          raw,
          req.headers['x-hub-signature-256'] as string | undefined,
          decrypt(a.appSecretEncrypted, config.ENCRYPTION_KEY),
        )
      )
        fail(403, 'Assinatura inválida');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        fail(422, 'Payload inválido');
      }
      const b = payloadSchema.parse(parsed),
        digest = hash(raw);
      await db.$transaction(
        async (tx) => {
          // Lock account: serializes envelope dedup and contact creation for one integration.
          await tx.account.update({ where: { id: a.id }, data: { lastWebhook: new Date() } });
          if (
            await tx.webhookEvent.findUnique({
              where: { accountId_digest: { accountId: a.id, digest } },
            })
          )
            return;
          for (const e of b.entry) {
            if (e.id !== a.wabaId) fail(403, 'WABA divergente');
            for (const change of e.changes) {
              const value = change.value;
              if (value.metadata && value.metadata.phone_number_id !== a.phoneNumberId)
                fail(403, 'Número divergente');
              for (const m of value.messages ?? []) {
                if (!value.metadata) fail(422, 'Número ausente');
                if (await tx.message.findUnique({ where: { providerId: m.id } })) continue;
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
                  payload: m.type === 'text' ? undefined : JSON.stringify(m),
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
      return { ok: true };
    });
  });
}
