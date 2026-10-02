import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from 'node:crypto';
const scrypt = (password: string, salt: string, length: number, options: object) =>
  new Promise<Buffer>((resolve, reject) =>
    derive(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password: string, encoded: string) {
  const [salt, hex] = encoded.split(':');
  const key = (await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  const stored = Buffer.from(hex, 'hex');
  return stored.length === key.length && timingSafeEqual(stored, key);
}
export function encrypt(value: string, key: string) {
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return `v1.${iv.toString('hex')}.${c.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;
}
export function decrypt(value: string, key: string) {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1') throw new Error('Invalid secret version');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
}
export function validSignature(raw: Buffer, signature: string | undefined, secret: string) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), 'hex'),
    createHmac('sha256', secret).update(raw).digest(),
  );
}
export const manager = (role: string) => ['owner', 'admin', 'supervisor'].includes(role);
export function messageVisible(
  role: string,
  assigned: string | null,
  userId: string,
  from: number,
  notesFrom: number,
  m: { sequence: number; direction: string },
) {
  return (
    manager(role) ||
    (assigned === userId && m.sequence >= (m.direction === 'note' ? notesFrom : from))
  );
}
export function windowOpen(lastCustomerAt: Date | null, now = new Date()) {
  return !!lastCustomerAt && now.getTime() - lastCustomerAt.getTime() < 24 * 3600 * 1000;
}
export function nextStatus(current: string, event: string) {
  const ranks: Record<string, number> = {
    queued: 0,
    sending: 1,
    accepted: 2,
    sent: 3,
    delivered: 4,
    read: 5,
  };
  if (event === 'failed') return ['delivered', 'read'].includes(current) ? current : 'failed';
  return (ranks[event] ?? -1) > (ranks[current] ?? -1) ? event : current;
}
