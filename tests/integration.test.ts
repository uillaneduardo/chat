import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { passwordHash, encrypt } from '../packages/domain/src/security.js';
// No destructive cleanup unless the explicitly supplied test DB has a test suffix.
const testURL = process.env.TEST_DATABASE_URL;
test(
  'MariaDB API: auth, tenants, transfer, streaming, shares, webhook and outbox',
  { skip: !testURL, timeout: 120000 },
  async () => {
    if (!new URL(testURL!).pathname.endsWith('_test'))
      throw new Error('TEST_DATABASE_URL must point to a dedicated *_test database');
    process.env.DATABASE_URL = testURL;
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_DEMO = 'true';
    process.env.ALLOW_UNSCANNED_FILES = 'true';
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
    process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
    const storage = await mkdtemp(join(tmpdir(), 'chat-files-'));
    process.env.STORAGE_ROOT = storage;
    const { db } = await import('../packages/database/src.js');
    const { createApp } = await import('../apps/api/src/app.js');
    const { dispatch } = await import('../apps/worker/src/dispatcher.js');
    const { processStatuses } = await import('../apps/worker/src/status.js');
    const app = await createApp();
    try {
      for (const model of [
        'providerStatus',
        'webhookEvent',
        'audit',
        'tariff',
        'share',
        'message',
        'transfer',
        'conversation',
        'contact',
        'upload',
        'account',
        'session',
        'user',
        'company',
      ] as const)
        await (db[model] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
      const password = 'synthetic-only-password';
      const pass = await passwordHash(password);
      const c1 = await db.company.create({ data: { name: 'Synthetic A' } }),
        c2 = await db.company.create({ data: { name: 'Synthetic B' } });
      const owner = await db.user.create({
        data: {
          companyId: c1.id,
          name: 'Owner',
          email: 'owner@example.invalid',
          passwordHash: pass,
          role: 'owner',
        },
      });
      const agent1 = await db.user.create({
        data: {
          companyId: c1.id,
          name: 'Agent One',
          email: 'one@example.invalid',
          passwordHash: pass,
          role: 'agent',
        },
      });
      const agent2 = await db.user.create({
        data: {
          companyId: c1.id,
          name: 'Agent Two',
          email: 'two@example.invalid',
          passwordHash: pass,
          role: 'agent',
        },
      });
      await db.user.create({
        data: {
          companyId: c2.id,
          name: 'Other',
          email: 'other@example.invalid',
          passwordHash: pass,
          role: 'owner',
        },
      });
      const account = await db.account.create({
        data: { companyId: c1.id, name: 'Demo', mode: 'demo' },
      });
      async function login(email: string) {
        const r = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email, password },
        });
        assert.equal(r.statusCode, 200, r.body);
        const cookie = r.cookies[0];
        const h = { cookie: `${cookie.name}=${cookie.value}` };
        const me = await app.inject({ url: '/api/me', headers: h });
        return { ...h, 'x-csrf-token': me.json().csrfToken };
      }
      const boss = await login(owner.email),
        one = await login(agent1.email),
        two = await login(agent2.email),
        other = await login('other@example.invalid');
      const call = async (
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: string,
        h: Record<string, string>,
        payload?: unknown,
      ) => app.inject({ method, url, headers: h, payload: payload as object });
      assert.equal(
        (
          await call(
            'POST',
            '/api/conversations',
            { cookie: boss.cookie },
            { name: 'x', waId: '558100000001', accountId: account.id },
          )
        ).statusCode,
        403,
      );
      const created = await call('POST', '/api/conversations', boss, {
        name: 'Synthetic Contact',
        waId: '558100000001',
        accountId: account.id,
      });
      assert.equal(created.statusCode, 200, created.body);
      const id = created.json().id;
      async function add(
        h: Record<string, string>,
        body: string,
        direction = 'incoming',
        fileId?: string,
      ) {
        return call(
          'POST',
          `/api/conversations/${id}/messages`,
          { ...h, 'idempotency-key': crypto.randomUUID() },
          { body, direction, fileId },
        );
      }
      assert.equal((await add(boss, 'Private history')).statusCode, 200);
      assert.equal((await add(boss, 'Hidden note', 'note')).statusCode, 200);
      assert.equal((await call('GET', `/api/conversations/${id}`, other)).statusCode, 404);
      const up = await call('POST', '/api/uploads', boss, {
        name: 'synthetic.txt',
        mime: 'text/plain',
        size: '11',
      });
      assert.equal(up.statusCode, 200, up.body);
      const fid = up.json().id;
      const part = await app.inject({
        method: 'PUT',
        url: `/api/uploads/${fid}/parts`,
        headers: {
          ...boss,
          'content-type': 'application/octet-stream',
          'upload-offset': '0',
          'content-length': '5',
        },
        payload: Buffer.from('hello'),
      });
      assert.equal(part.statusCode, 200, part.body);
      assert.equal((await call('GET', `/api/uploads/${fid}`, boss)).json().offset, '5');
      assert.equal(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/uploads/${fid}/parts`,
            headers: {
              ...boss,
              'content-type': 'application/octet-stream',
              'upload-offset': '0',
              'content-length': '5',
            },
            payload: Buffer.from('hello'),
          })
        ).statusCode,
        409,
      );
      const part2 = await app.inject({
        method: 'PUT',
        url: `/api/uploads/${fid}/parts`,
        headers: {
          ...boss,
          'content-type': 'application/octet-stream',
          'upload-offset': '5',
          'content-length': '6',
        },
        payload: Buffer.from(' world'),
      });
      assert.equal(part2.statusCode, 200, part2.body);
      assert.equal(
        (await call('POST', `/api/uploads/${fid}/complete`, boss, {})).json().state,
        'ready',
      );
      assert.equal((await add(boss, 'Hidden attachment', 'note', fid)).statusCode, 200);
      const share = await call('POST', `/api/files/${fid}/shares`, boss, { hours: 1 });
      const shareURL = new URL(share.json().url).pathname;
      assert.equal((await app.inject({ url: shareURL })).body, 'hello world');
      const range = await app.inject({
        url: `/api/files/${fid}`,
        headers: { ...boss, range: 'bytes=6-10' },
      });
      assert.equal(range.statusCode, 206);
      assert.equal(range.body, 'world');
      let current = (await call('GET', `/api/conversations/${id}`, boss)).json();
      assert.equal(
        (
          await call('POST', `/api/conversations/${id}/transfers`, boss, {
            userId: agent1.id,
            mode: 'full',
            includeNotes: true,
            version: current.version,
          })
        ).statusCode,
        200,
      );
      assert(
        (await call('GET', `/api/conversations/${id}`, one))
          .json()
          .messages.some((m: { body: string }) => m.body === 'Private history'),
      );
      current = (await call('GET', `/api/conversations/${id}`, boss)).json();
      assert.equal(
        (
          await call('POST', `/api/conversations/${id}/transfers`, boss, {
            userId: agent2.id,
            mode: 'future',
            summary: 'Allowed summary',
            version: current.version,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await call('POST', `/api/conversations/${id}/transfers`, boss, {
            userId: agent1.id,
            mode: 'full',
            version: current.version,
          })
        ).statusCode,
        409,
      );
      assert.equal((await call('GET', `/api/conversations/${id}`, one)).statusCode, 404);
      assert.equal((await call('GET', `/api/conversations/${id}`, two)).json().messages.length, 0);
      assert.equal((await call('GET', `/api/files/${fid}`, two)).statusCode, 404);
      assert.equal((await app.inject({ url: shareURL })).statusCode, 404);
      const cv = await db.conversation.findUniqueOrThrow({ where: { id } });
      await db.message.create({
        data: {
          companyId: c1.id,
          conversationId: id,
          sequence: cv.lastSequence + 1,
          direction: 'incoming',
          body: 'Delayed hidden historical message',
          status: 'received',
          originAt: new Date(Date.now() - 60000),
        },
      });
      await db.conversation.update({ where: { id }, data: { lastSequence: { increment: 1 } } });
      assert.equal((await call('GET', `/api/conversations/${id}`, two)).json().messages.length, 0);
      const key = crypto.randomUUID(),
        payload = { body: 'New reply', direction: 'outgoing' };
      const send1 = await call(
        'POST',
        `/api/conversations/${id}/messages`,
        { ...two, 'idempotency-key': key },
        payload,
      );
      assert.equal(send1.statusCode, 200, send1.body);
      const send2 = await call(
        'POST',
        `/api/conversations/${id}/messages`,
        { ...two, 'idempotency-key': key },
        payload,
      );
      assert.equal(send1.json().id, send2.json().id);
      assert.equal(
        (
          await call(
            'POST',
            `/api/conversations/${id}/messages`,
            { ...two, 'idempotency-key': key },
            { ...payload, body: 'different' },
          )
        ).statusCode,
        409,
      );
      await dispatch();
      assert.equal(
        (await call('GET', `/api/conversations/${id}`, two)).json().messages[0].status,
        'delivered',
      );
      assert.equal((await call('GET', '/api/usage', two)).statusCode, 403);
      const secret = 'synthetic-secret-123456';
      const meta = await db.account.create({
        data: {
          companyId: c1.id,
          name: 'Meta synthetic',
          mode: 'meta',
          phoneNumberId: '123456789',
          wabaId: '987654321',
          graphVersion: 'v99.0',
          appSecretEncrypted: encrypt(secret, process.env.ENCRYPTION_KEY!),
          verifyHash: 'not-used',
        },
      });
      const envelope = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: meta.wabaId,
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: meta.phoneNumberId },
                  messages: [
                    {
                      id: 'synthetic-inbound',
                      from: '558100000002',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: 'Webhook inbound' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const raw = JSON.stringify(envelope),
        signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: `/webhooks/meta/${meta.id}`,
            headers: { 'content-type': 'application/json' },
            payload: raw,
          })
        ).statusCode,
        403,
      );
      for (let i = 0; i < 2; i++) {
        const r = await app.inject({
          method: 'POST',
          url: `/webhooks/meta/${meta.id}`,
          headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
          payload: raw,
        });
        assert.equal(r.statusCode, 200, r.body);
      }
      assert.equal(await db.message.count({ where: { providerId: 'synthetic-inbound' } }), 1);
      // Delayed status before provider ID association remains durable and is applied later.
      await db.providerStatus.create({
        data: {
          accountId: meta.id,
          providerId: 'synthetic-outbound',
          status: 'read',
          occurredAt: new Date(),
          digest: 'synthetic-status-key',
          billable: true,
          category: 'utility',
        },
      });
      await processStatuses();
      assert.equal(await db.providerStatus.count({ where: { applied: false } }), 1);
      const mc = await db.conversation.findFirstOrThrow({ where: { accountId: meta.id } });
      await db.message.create({
        data: {
          companyId: c1.id,
          conversationId: mc.id,
          sequence: 2,
          direction: 'outgoing',
          body: 'synthetic send',
          status: 'accepted',
          providerId: 'synthetic-outbound',
        },
      });
      await db.tariff.create({
        data: {
          companyId: c1.id,
          market: 'BR',
          category: 'utility',
          currency: 'USD',
          price: '0.12345678',
          validFrom: new Date(Date.now() - 10000),
          source: 'https://example.invalid/synthetic-rate',
        },
      });
      await db.providerStatus.updateMany({
        where: { applied: false },
        data: { nextAttemptAt: new Date() },
      });
      await processStatuses();
      const priced = await db.message.findUniqueOrThrow({
        where: { providerId: 'synthetic-outbound' },
      });
      assert.equal(priced.status, 'read');
      assert.equal(priced.cost?.toFixed(8), '0.12345678');
      await processStatuses();
      assert.equal(
        (await db.message.findUniqueOrThrow({ where: { id: priced.id } })).cost?.toFixed(8),
        '0.12345678',
      );
      // Exercise the Meta adapter without any external request.
      await db.account.update({
        where: { id: meta.id },
        data: { tokenEncrypted: encrypt('synthetic-access-token', process.env.ENCRYPTION_KEY!) },
      });
      const originalFetch = globalThis.fetch;
      let externalAttempts = 0;
      try {
        globalThis.fetch = (async () => {
          externalAttempts++;
          return Response.json({ messages: [{ id: 'synthetic-adapter-accepted' }] });
        }) as typeof fetch;
        const accepted = await db.message.create({
          data: {
            companyId: c1.id,
            conversationId: mc.id,
            sequence: 3,
            direction: 'outgoing',
            body: 'mock adapter send',
            status: 'queued',
          },
        });
        await dispatch();
        assert.equal(
          (await db.message.findUniqueOrThrow({ where: { id: accepted.id } })).status,
          'accepted',
        );
        globalThis.fetch = (async () => {
          externalAttempts++;
          throw new Error('Synthetic network timeout');
        }) as typeof fetch;
        const uncertain = await db.message.create({
          data: {
            companyId: c1.id,
            conversationId: mc.id,
            sequence: 4,
            direction: 'outgoing',
            body: 'mock uncertain send',
            status: 'queued',
          },
        });
        await dispatch();
        await dispatch();
        assert.equal(
          (await db.message.findUniqueOrThrow({ where: { id: uncertain.id } })).status,
          'uncertain',
        );
        assert.equal(externalAttempts, 2, 'An uncertain result must not be retried blindly');
      } finally {
        globalThis.fetch = originalFetch;
      }
      // Real MariaDB webhook fixture: rollback must not erase the HTTP attempt.
      const realEnvelope = structuredClone(envelope);
      const value = realEnvelope.entry[0].changes[0].value;
      Object.assign(value.metadata, { display_phone_number: '15550000000' });
      Object.assign(value, {
        messaging_product: 'whatsapp',
        contacts: [{ wa_id: '15550000001', profile: { name: 'Sintético 🧪' } }],
      });
      value.messages[0].from = '15550000001';
      value.messages[0].id = 'wamid.synthetic.realistic';
      const postWebhook = async (body: unknown) => {
        const rawBody = JSON.stringify(body);
        return app.inject({
          method: 'POST',
          url: `/webhooks/meta/${meta.id}`,
          payload: rawBody,
          headers: {
            'content-type': 'application/json',
            'x-hub-signature-256':
              'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'),
          },
        });
      };
      assert.equal((await postWebhook(realEnvelope)).statusCode, 200);
      const realConversation = await db.conversation.findFirstOrThrow({
        where: { accountId: meta.id, contact: { waId: '15550000001' } },
      });
      // Force the actual unique(sequence) failure after contact/conversation upserts.
      await db.conversation.update({
        where: { id: realConversation.id },
        data: { lastSequence: 0 },
      });
      value.messages[0].id = 'wamid.synthetic.rollback';
      const priorSuccess = (await db.account.findUniqueOrThrow({ where: { id: meta.id } }))
        .lastWebhookSuccess;
      assert.equal((await postWebhook(realEnvelope)).statusCode, 500);
      const failedAccount = await db.account.findUniqueOrThrow({ where: { id: meta.id } });
      assert.ok(failedAccount.lastWebhookAttempt);
      assert.equal(failedAccount.lastWebhookErrorCode, 'P2002');
      assert.deepEqual(failedAccount.lastWebhookSuccess, priorSuccess);
      assert.equal(await db.message.count({ where: { providerId: value.messages[0].id } }), 0);
      await db.conversation.update({
        where: { id: realConversation.id },
        data: { lastSequence: 1 },
      });
      assert.equal((await postWebhook(realEnvelope)).statusCode, 200);
      assert.equal((await postWebhook(realEnvelope)).statusCode, 200);
      assert.equal(await db.message.count({ where: { providerId: value.messages[0].id } }), 1);
      // Administrative scope, confirmation and history preservation.
      assert.equal(
        (await call('PATCH', `/api/accounts/${account.id}`, one, { active: false })).statusCode,
        403,
      );
      assert.equal(
        (await call('PATCH', `/api/accounts/${account.id}`, other, { active: false })).statusCode,
        404,
      );
      assert.equal(
        (
          await call(
            'PATCH',
            `/api/accounts/${account.id}`,
            { cookie: boss.cookie },
            { active: false },
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (await call('PATCH', `/api/accounts/${account.id}`, boss, { active: false })).statusCode,
        200,
      );
      assert.equal(
        (
          await call('POST', '/api/conversations', boss, {
            accountId: account.id,
            name: 'Blocked',
            waId: '15550000002',
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (await call('DELETE', `/api/accounts/${account.id}`, boss, { confirm: true })).statusCode,
        409,
      );
      assert.ok(await db.conversation.findUnique({ where: { id } }));
      const empty = await db.account.create({
        data: { companyId: c1.id, name: 'Empty demo', mode: 'demo', active: false },
      });
      assert.equal((await call('DELETE', `/api/accounts/${empty.id}`, boss, {})).statusCode, 422);
      assert.equal(
        (await call('DELETE', `/api/accounts/${empty.id}`, boss, { confirm: true })).statusCode,
        200,
      );
      assert.equal(await db.account.count({ where: { id: empty.id } }), 0);
      assert.equal(
        await db.audit.count({ where: { resourceId: empty.id, action: 'account.delete' } }),
        1,
      );
      const diagnosis = await call('POST', `/api/accounts/${meta.id}/diagnostics`, boss, {});
      assert.equal(diagnosis.statusCode, 200);
      assert.ok(!diagnosis.body.includes('synthetic-access-token'));
      assert.equal(
        (await call('PATCH', `/api/accounts/${meta.id}`, boss, { active: false })).statusCode,
        200,
      );
      assert.equal((await postWebhook(realEnvelope)).statusCode, 403);
      // Queue dispatch must not call Meta once the account is inactive.
      const blocked = await db.message.create({
        data: {
          companyId: c1.id,
          conversationId: realConversation.id,
          sequence: 3,
          direction: 'outgoing',
          body: 'Blocked synthetic',
          status: 'queued',
        },
      });
      const fetchBeforeBlocked = globalThis.fetch;
      let blockedFetches = 0;
      try {
        globalThis.fetch = (async () => {
          blockedFetches++;
          throw new Error('No external call allowed');
        }) as typeof fetch;
        await dispatch();
      } finally {
        globalThis.fetch = fetchBeforeBlocked;
      }
      assert.equal(blockedFetches, 0);
      assert.equal(
        (await db.message.findUniqueOrThrow({ where: { id: blocked.id } })).errorCode,
        'ACCOUNT_INACTIVE',
      );
      const { config } = await import('../packages/config/src/index.js');
      const oldDemoEnabled = config.ENABLE_DEMO;
      try {
        config.ENABLE_DEMO = 'false';
        assert.equal(
          (await call('POST', '/api/accounts', boss, { name: 'Forbidden demo', mode: 'demo' }))
            .statusCode,
          403,
        );
        assert.equal(
          (await call('PATCH', `/api/accounts/${account.id}`, boss, { active: true })).statusCode,
          403,
        );
        assert.ok(await db.account.findUnique({ where: { id: account.id } }));
      } finally {
        config.ENABLE_DEMO = oldDemoEnabled;
      }
      // Atomic quota reservations: only one concurrent request fits.
      await db.company.update({ where: { id: c1.id }, data: { quotaBytes: 32n } });
      const reservations = await Promise.all(
        [1, 2].map((n) =>
          call('POST', '/api/uploads', boss, {
            name: `quota-${n}.txt`,
            size: '20',
            mime: 'text/plain',
          }),
        ),
      );
      assert.deepEqual(reservations.map((r) => r.statusCode).sort(), [200, 413]);
      await call(
        'DELETE',
        `/api/uploads/${reservations.find((r) => r.statusCode === 200)!.json().id}`,
        boss,
      );
      const company = await db.company.findUniqueOrThrow({ where: { id: c1.id } });
      assert.equal(company.usedBytes, 11n);
      assert.equal(company.reservedBytes, 0n);
      await call('DELETE', `/api/uploads/${fid}`, boss);
      assert.equal((await db.company.findUniqueOrThrow({ where: { id: c1.id } })).usedBytes, 0n);
      assert.equal((await call('POST', '/api/auth/logout', boss, {})).statusCode, 200);
      assert.equal((await call('GET', '/api/me', boss)).statusCode, 401);
    } finally {
      await app.close();
      await db.$disconnect();
      await rm(storage, { recursive: true, force: true });
    }
  },
);
