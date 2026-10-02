import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordHash,
  passwordMatches,
  encrypt,
  decrypt,
  validSignature,
  messageVisible,
  windowOpen,
  nextStatus,
} from '../packages/domain/src/security.js';
import { createHmac } from 'node:crypto';
test('password, authenticated encryption and raw webhook signature', async () => {
  const p = await passwordHash('synthetic-password-123');
  assert(await passwordMatches('synthetic-password-123', p));
  assert.equal(await passwordMatches('wrong', p), false);
  const key = 'ab'.repeat(32),
    encrypted = encrypt('synthetic token', key);
  assert.equal(decrypt(encrypted, key), 'synthetic token');
  assert.throws(() => decrypt(encrypted, 'cd'.repeat(32)));
  const raw = Buffer.from('{"hello":1}'),
    signature = 'sha256=' + createHmac('sha256', 'secret').update(raw).digest('hex');
  assert(validSignature(raw, signature, 'secret'));
  assert.equal(validSignature(Buffer.from('{ "hello":1}'), signature, 'secret'), false);
});
test('history boundary, notes and previous assignment denied', () => {
  assert.equal(
    messageVisible('agent', 'new', 'new', 5, 7, { sequence: 4, direction: 'incoming' }),
    false,
  );
  assert.equal(
    messageVisible('agent', 'new', 'new', 5, 7, { sequence: 6, direction: 'note' }),
    false,
  );
  assert.equal(
    messageVisible('agent', 'new', 'old', 5, 7, { sequence: 10, direction: 'incoming' }),
    false,
  );
  assert(messageVisible('agent', 'new', 'new', 5, 7, { sequence: 5, direction: 'incoming' }));
  assert(messageVisible('supervisor', 'new', 'boss', 5, 7, { sequence: 1, direction: 'incoming' }));
});
test('window boundary and status do not regress', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  assert.equal(windowOpen(new Date('2026-09-30T12:00:00Z'), now), false);
  assert(windowOpen(new Date('2026-10-01T11:00:00Z'), now));
  assert.equal(nextStatus('read', 'delivered'), 'read');
  assert.equal(nextStatus('delivered', 'failed'), 'delivered');
  assert.equal(nextStatus('accepted', 'sent'), 'sent');
});
