import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { encrypt } from '../packages/domain/src/security.js';
import { safeError } from '../apps/api/src/diagnostics.js';

test('safe diagnostics never serialize error input, metadata or stack', () => {
  const result = safeError(
    Object.assign(new Error('Authorization synthetic-secret message body'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { token: 'synthetic-secret' },
    }),
  );
  assert.equal(result.errorCode, 'P2002');
  assert.equal(result.errorType, 'PrismaClientKnownRequestError');
  assert.ok(!JSON.stringify(result).includes('synthetic-secret'));
  assert.equal(safeError({ name: 'secret', code: 'secret' }).errorType, 'Error');
});

test('Meta HTTP ingress: raw HMAC, realistic envelope, dedup and durable diagnostics (mock database)', async (t) => {
  process.env.DATABASE_URL = 'mysql://synthetic:synthetic@localhost:3306/unused_test';
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  process.env.NODE_ENV = 'test';
  const { db } = await import('../packages/database/src.js');
  const { registerWebhook } = await import('../apps/api/src/webhook.js');
  const account = {
    id: '00000000-0000-4000-8000-000000000001',
    companyId: 'synthetic-company',
    active: true,
    mode: 'meta',
    wabaId: '100000000001',
    phoneNumberId: '100000000002',
    appSecretEncrypted: encrypt('synthetic-secret', process.env.ENCRYPTION_KEY),
    lastWebhookSuccess: null as Date | null,
    lastWebhookAttempt: null as Date | null,
    lastWebhookRequestId: null as string | null,
    lastWebhookStatus: null as string | null,
    lastWebhookErrorCode: null as string | null,
  };
  const messages = new Map<string, any>(),
    contacts = new Map<string, any>(),
    conversations = new Map<string, any>();
  const envelopes = new Set<string>(),
    statuses = new Map<string, any>();
  let internalFailure = false;
  const tx = {
    $queryRaw: async () => [],
    account: { findUniqueOrThrow: async () => ({ ...account }) },
    webhookEvent: {
      findUnique: async ({ where }: any) =>
        envelopes.has(where.accountId_digest.digest) ? {} : null,
      create: async ({ data }: any) => envelopes.add(data.digest),
    },
    contact: {
      upsert: async ({ create }: any) => {
        if (!contacts.has(create.waId)) contacts.set(create.waId, { ...create, id: create.waId });
        return contacts.get(create.waId);
      },
    },
    conversation: {
      upsert: async ({ create }: any) => {
        if (!conversations.has(create.contactId))
          conversations.set(create.contactId, { ...create, id: create.contactId, lastSequence: 0 });
        return { ...conversations.get(create.contactId) };
      },
      update: async ({ where, data }: any) => {
        const c = conversations.get(where.id ?? where.companyId_id.id);
        if (data.lastSequence) c.lastSequence++;
        else Object.assign(c, data);
        return { ...c };
      },
    },
    message: {
      findUnique: async ({ where }: any) => messages.get(where.providerId),
      create: async ({ data }: any) => {
        if (internalFailure)
          throw Object.assign(new Error('synthetic private input'), { code: 'P2002' });
        messages.set(data.providerId, { ...data, conversation: { accountId: account.id } });
        return data;
      },
    },
    providerStatus: { upsert: async ({ create }: any) => statuses.set(create.digest, create) },
  };
  const database = {
    account: {
      findUnique: async () => ({ ...account }),
      update: async ({ data }: any) => Object.assign(account, data),
      updateMany: async ({ where, data }: any) => {
        if (
          !where.lastWebhookRequestId ||
          where.lastWebhookRequestId === account.lastWebhookRequestId
        )
          Object.assign(account, data);
        return { count: 1 };
      },
    },
    $transaction: async (fn: any) => {
      const snapshot = [messages, contacts, conversations, statuses].map((m) => structuredClone(m));
      try {
        return await fn(tx);
      } catch (error) {
        [messages, contacts, conversations, statuses].forEach((m, i) => {
          m.clear();
          for (const [key, value] of snapshot[i]) m.set(key, value);
        });
        throw error;
      }
    },
  };
  const logs: string[] = [];
  for (const method of ['info', 'warn', 'error'] as const)
    t.mock.method(console, method, (v: string) => logs.push(v));
  const app = Fastify();
  app.setErrorHandler((error, _req, reply) =>
    reply
      .code(
        error instanceof ZodError ? 422 : ((error as { statusCode?: number }).statusCode ?? 500),
      )
      .send({ message: 'sanitized' }),
  );
  await registerWebhook(app, database as unknown as typeof db);
  const fixture = () => ({
    object: 'whatsapp_business_account',
    additional_envelope_field: true,
    entry: [
      {
        id: account.wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: account.phoneNumberId,
              },
              contacts: [{ wa_id: '15550000001', profile: { name: 'Contato sintético 🧪' } }],
              messages: [
                {
                  from: '15550000001',
                  id: 'wamid.synthetic.1',
                  timestamp: '1791150000',
                  type: 'text',
                  text: { body: 'Mensagem sintética 🧪' },
                  context: { id: 'wamid.synthetic.context' },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const send = async (payload: unknown, valid = true) => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return app.inject({
      method: 'POST',
      url: `/webhooks/meta/${account.id}`,
      payload: raw,
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256':
          'sha256=' +
          createHmac('sha256', valid ? 'synthetic-secret' : 'wrong')
            .update(raw)
            .digest('hex'),
      },
    });
  };
  try {
    await t.test('invalid signature is untrusted and does not create success', async () => {
      assert.equal((await send(fixture(), false)).statusCode, 403);
      assert.equal(account.lastWebhookStatus, 'untrusted');
      assert.equal(account.lastWebhookErrorCode, 'SIGNATURE_INVALID');
      assert.ok(account.lastWebhookAttempt);
      assert.equal(account.lastWebhookSuccess, null);
    });
    await t.test('valid signature, first contact/conversation, text and extra fields', async () => {
      assert.equal((await send(fixture())).statusCode, 200);
      assert.equal(messages.size, 1);
      assert.equal(contacts.size, 1);
      assert.equal(conversations.size, 1);
      assert.equal(messages.get('wamid.synthetic.1').status, 'received');
      assert.equal(account.lastWebhookStatus, 'success');
      assert.ok(account.lastWebhookSuccess);
    });
    await t.test('same webhook and same message in another envelope are deduplicated', async () => {
      assert.equal((await send(fixture())).statusCode, 200);
      const b = fixture();
      b.additional_envelope_field = false;
      assert.equal((await send(b)).statusCode, 200);
      assert.equal(messages.size, 1);
      assert.equal(conversations.get('15550000001').lastSequence, 1);
    });
    await t.test('existing contact and conversation are reused', async () => {
      const b = fixture();
      b.entry[0].changes[0].value.messages[0].id = 'wamid.synthetic.2';
      assert.equal((await send(b)).statusCode, 200);
      assert.equal(messages.size, 2);
      assert.equal(contacts.size, 1);
      assert.equal(conversations.size, 1);
    });
    for (const [code, mutate] of [
      ['WABA_MISMATCH', (b: any) => (b.entry[0].id = '999')],
      [
        'PHONE_MISMATCH',
        (b: any) => (b.entry[0].changes[0].value.metadata.phone_number_id = '999'),
      ],
      [
        'PAYLOAD_INVALID',
        (b: any) => (b.entry[0].changes[0].value.messages[0].timestamp = '9999999999999999'),
      ],
    ] as const)
      await t.test(code, async () => {
        const success = account.lastWebhookSuccess;
        const b = fixture();
        mutate(b);
        assert.ok((await send(b)).statusCode >= 400);
        assert.equal(account.lastWebhookErrorCode, code);
        assert.equal(account.lastWebhookSuccess, success);
      });
    await t.test('malformed JSON is rejected after raw signature verification', async () => {
      assert.equal((await send('{')).statusCode, 422);
      assert.equal(account.lastWebhookErrorCode, 'PAYLOAD_INVALID');
    });
    await t.test(
      'internal rollback preserves attempt, safe code and previous success; retry succeeds',
      async () => {
        const success = account.lastWebhookSuccess;
        const b = fixture();
        b.entry[0].changes[0].value.messages[0].id = 'wamid.synthetic.rollback';
        internalFailure = true;
        assert.equal((await send(b)).statusCode, 500);
        assert.ok(account.lastWebhookAttempt);
        assert.equal(account.lastWebhookSuccess, success);
        assert.equal(account.lastWebhookErrorCode, 'P2002');
        assert.equal(messages.size, 2);
        assert.equal(conversations.get('15550000001').lastSequence, 2);
        internalFailure = false;
        assert.equal((await send(b)).statusCode, 200);
      },
    );
    await t.test('realistic status payload is stored with timestamp and dedup', async () => {
      const b: any = fixture();
      delete b.entry[0].changes[0].value.messages;
      b.entry[0].changes[0].value.statuses = [
        {
          id: 'wamid.synthetic.outgoing',
          status: 'delivered',
          timestamp: '1791150001',
          recipient_id: '15550000001',
          pricing: { billable: true, category: 'utility', pricing_model: 'PMP' },
        },
      ];
      assert.equal((await send(b)).statusCode, 200);
      assert.equal((await send(b)).statusCode, 200);
      assert.equal(statuses.size, 1);
    });
    await t.test('inactive account rejects processing and preserves history', async () => {
      account.active = false;
      assert.equal((await send(fixture())).statusCode, 403);
      assert.equal(account.lastWebhookErrorCode, 'ACCOUNT_INACTIVE');
      assert.equal(messages.size, 3);
    });
    await t.test(
      'global 500 handler logs method/route/Prisma code and omits query/input',
      async () => {
        const { createApp } = await import('../apps/api/src/app.js');
        const globalApp = await createApp();
        globalApp.get('/synthetic-error', async () => {
          throw Object.assign(new Error('synthetic private input'), { code: 'P2003' });
        });
        try {
          const response = await globalApp.inject('/synthetic-error?token=synthetic-secret');
          assert.equal(response.statusCode, 500);
          assert.ok(!response.body.includes('synthetic private input'));
          const log = logs.map((v) => JSON.parse(v)).find((v) => v.code === 'SERVER_ERROR');
          assert.equal(log.method, 'GET');
          assert.equal(log.path, '/synthetic-error');
          assert.equal(log.errorCode, 'P2003');
          assert.ok(log.requestId);
        } finally {
          await globalApp.close();
        }
      },
    );
    assert.ok(!logs.join('').includes('Mensagem sintética'));
    assert.ok(!logs.join('').includes('synthetic-secret'));
    assert.ok(!logs.join('').includes('synthetic private input'));
  } finally {
    await app.close();
  }
});
