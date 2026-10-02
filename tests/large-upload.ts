import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { passwordHash } from '../packages/domain/src/security.js';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Dedicated TEST_DATABASE_URL ending in _test required');
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.ALLOW_UNSCANNED_FILES = 'true';
const root = await mkdtemp(join(tmpdir(), 'chat-large-'));
process.env.STORAGE_ROOT = root;
const { db } = await import('../packages/database/src.js');
const { createApp } = await import('../apps/api/src/app.js');
const app = await createApp();
const company = await db.company.create({ data: { name: 'Large upload synthetic test' } });
const email = `large-${crypto.randomUUID()}@example.invalid`,
  password = 'synthetic-large-upload-password';
const owner = await db.user.create({
  data: {
    companyId: company.id,
    name: 'Synthetic',
    email,
    passwordHash: await passwordHash(password),
    role: 'owner',
  },
});
try {
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  assert.equal(login.statusCode, 200);
  const h = { cookie: `${login.cookies[0].name}=${login.cookies[0].value}` };
  const me = await app.inject({ url: '/api/me', headers: h });
  const headers = { ...h, 'x-csrf-token': me.json().csrfToken };
  const size = 2147483648,
    chunk = Buffer.alloc(8388608, 0x61),
    digest = createHash('sha256');
  const created = await app.inject({
    method: 'POST',
    url: '/api/uploads',
    headers,
    payload: { name: 'synthetic-2GiB.bin', mime: 'application/octet-stream', size: String(size) },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id;
  const baseline = process.memoryUsage().rss;
  let peak = baseline;
  for (let offset = 0; offset < size; offset += chunk.length) {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/uploads/${id}/parts`,
      headers: {
        ...headers,
        'content-type': 'application/octet-stream',
        'content-length': String(chunk.length),
        'upload-offset': String(offset),
      },
      payload: chunk,
    });
    assert.equal(res.statusCode, 200, res.body);
    digest.update(chunk);
    peak = Math.max(peak, process.memoryUsage().rss);
  }
  const complete = await app.inject({
    method: 'POST',
    url: `/api/uploads/${id}/complete`,
    headers,
    payload: {},
  });
  assert.equal(complete.statusCode, 200, complete.body);
  const f = await db.upload.findUniqueOrThrow({ where: { id } });
  assert.equal(f.sha256, digest.digest('hex'));
  assert.equal(f.size, BigInt(size));
  const range = await app.inject({
    url: `/api/files/${id}`,
    headers: { ...headers, range: `bytes=${size - 4}-${size - 1}` },
  });
  assert.equal(range.statusCode, 206);
  assert.equal(range.body, 'aaaa');
  const growthMiB = (peak - baseline) / 1048576;
  assert(growthMiB < 512, `Unexpected memory growth ${growthMiB} MiB`);
  console.log(
    JSON.stringify({
      sizeBytes: size,
      parts: size / chunk.length,
      sha256Verified: true,
      rangeVerified: true,
      peakRssGrowthMiB: Number(growthMiB.toFixed(1)),
    }),
  );
} finally {
  await db.audit.deleteMany({ where: { companyId: company.id } });
  await db.upload.deleteMany({ where: { companyId: company.id } });
  await db.user.delete({ where: { id: owner.id } });
  await db.company.delete({ where: { id: company.id } });
  await app.close();
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
}
