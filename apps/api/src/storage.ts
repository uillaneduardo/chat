import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, open, rename, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import { hash, token, manager } from '../../../packages/domain/src/security.js';
import { fileFor, needManager, audit, fail } from './helpers.js';
const root = resolve(config.STORAGE_ROOT),
  locks = new Set<string>();
export const filePath = (id: string) => resolve(root, `${z.string().uuid().parse(id)}.bin`);
const tempPath = (id: string) => filePath(id) + '.part';
const param = (p: unknown) => z.object({ id: z.string().uuid() }).parse(p).id;
const scan = promisify(execFile);
export async function cleanupUploads() {
  const expired = await db.upload.findMany({
    where: { state: 'pending', expiresAt: { lt: new Date() } },
    take: 100,
  });
  for (const f of expired) {
    if (locks.has(f.id)) continue;
    locks.add(f.id);
    try {
      await db.$transaction(async (tx) => {
        const won = await tx.upload.updateMany({
          where: { id: f.id, state: 'pending' },
          data: { state: 'expired' },
        });
        if (won.count)
          await tx.company.update({
            where: { id: f.companyId },
            data: { reservedBytes: { decrement: f.size } },
          });
      });
      await unlink(tempPath(f.id)).catch(() => {});
      await unlink(filePath(f.id)).catch(() => {});
    } finally {
      locks.delete(f.id);
    }
  }
}
async function sendFile(
  req: FastifyRequest,
  reply: FastifyReply,
  id: string,
  name: string,
  size: bigint,
) {
  const path = filePath(id);
  if (!(await stat(path).catch(() => null))) fail(404, 'Arquivo indisponível');
  reply
    .header('Content-Type', 'application/octet-stream')
    .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
    .header('Accept-Ranges', 'bytes')
    .header('Cache-Control', 'private, no-store');
  const total = Number(size);
  let start = 0,
    end = total - 1;
  if (req.headers.range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!m) {
      reply.header('Content-Range', `bytes */${total}`);
      return reply.code(416).send();
    }
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), end) : end;
    if (start > end || start >= total) {
      reply.header('Content-Range', `bytes */${total}`);
      return reply.code(416).send();
    }
    reply.code(206).header('Content-Range', `bytes ${start}-${end}/${total}`);
  }
  reply.header('Content-Length', end - start + 1);
  return reply.send(createReadStream(path, { start, end }));
}
export async function registerStorage(app: FastifyInstance) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  app.addContentTypeParser('application/octet-stream', (req, payload, done) => done(null, payload));
  app.post('/api/uploads', async (req) => {
    const b = z
      .object({
        name: z
          .string()
          .min(1)
          .max(200)
          .regex(/^[^/\\\x00-\x1f]+$/),
        mime: z.string().max(100).default('application/octet-stream'),
        size: z.string().regex(/^\d+$/),
      })
      .parse(req.body);
    const size = BigInt(b.size);
    if (size <= 0n) fail(422, 'Arquivo vazio');
    const f = await db.$transaction(async (tx) => {
      const reserved =
        await tx.$executeRaw`UPDATE Company SET reservedBytes=reservedBytes+${size} WHERE id=${req.actor.companyId} AND maxFileBytes>=${size} AND usedBytes+reservedBytes+${size}<=quotaBytes`;
      if (!reserved) fail(413, 'Limite de arquivo ou quota excedido');
      return tx.upload.create({
        data: {
          companyId: req.actor.companyId,
          ownerId: req.actor.id,
          name: b.name,
          mime: b.mime,
          size,
          expiresAt: new Date(Date.now() + 24 * 3600000),
        },
      });
    });
    try {
      const handle = await open(tempPath(f.id), 'wx', 0o600);
      await handle.close();
    } catch (e) {
      await db.$transaction([
        db.upload.update({ where: { id: f.id }, data: { state: 'failed' } }),
        db.company.update({
          where: { id: f.companyId },
          data: { reservedBytes: { decrement: f.size } },
        }),
      ]);
      throw e;
    }
    await audit(f.companyId, req.actor.id, 'upload.create', f.id);
    return { id: f.id, offset: '0', chunkBytes: 8388608 };
  });
  app.get('/api/uploads/:id', async (req) => {
    const id = param(req.params),
      f = await db.upload.findFirst({
        where: { id, companyId: req.actor.companyId, ownerId: req.actor.id },
      });
    if (!f) fail(404, 'Upload não encontrado');
    return {
      id,
      size: f.size.toString(),
      offset: f.offset.toString(),
      state: f.state,
      expiresAt: f.expiresAt,
      name: f.name,
    };
  });
  app.put(
    '/api/uploads/:id/parts',
    { bodyLimit: 8388608, config: { rateLimit: { max: 600, timeWindow: '1 minute' } } },
    async (req) => {
      const id = param(req.params),
        offset = BigInt(z.string().regex(/^\d+$/).parse(req.headers['upload-offset']));
      if (locks.has(id)) fail(409, 'Upload em andamento');
      locks.add(id);
      try {
        const f = await db.upload.findFirst({
          where: { id, companyId: req.actor.companyId, ownerId: req.actor.id },
        });
        if (!f || f.state !== 'pending' || f.expiresAt < new Date())
          fail(404, 'Upload expirado ou indisponível');
        if (offset !== f.offset) fail(409, 'Offset divergente; consulte a sessão');
        if (req.headers['content-type'] !== 'application/octet-stream')
          fail(415, 'Use application/octet-stream');
        const length = Number(req.headers['content-length']);
        if (
          !Number.isSafeInteger(length) ||
          length <= 0 ||
          length > 8388608 ||
          offset + BigInt(length) > f.size
        )
          fail(413, 'Parte excede limite ou tamanho declarado');
        const h = await open(tempPath(id), 'r+');
        await h.truncate(Number(offset));
        await h.close();
        let bytes = 0;
        const counter = new Transform({
          transform(chunk, _enc, cb) {
            bytes += chunk.length;
            if (bytes > length) cb(new Error('Parte excedida'));
            else cb(null, chunk);
          },
        });
        try {
          await pipeline(
            req.body as Readable,
            counter,
            createWriteStream(tempPath(id), { flags: 'r+', start: Number(offset) }),
          );
          if (bytes !== length) fail(422, 'Parte incompleta');
          const next = offset + BigInt(bytes);
          await db.upload.update({ where: { id }, data: { offset: next } });
          return { offset: next.toString() };
        } catch (e) {
          const h = await open(tempPath(id), 'r+');
          await h.truncate(Number(offset));
          await h.close();
          throw e;
        }
      } finally {
        locks.delete(id);
      }
    },
  );
  app.post('/api/uploads/:id/complete', async (req) => {
    const id = param(req.params);
    if (locks.has(id)) fail(409, 'Upload em andamento');
    locks.add(id);
    try {
      const f = await db.upload.findFirst({
        where: { id, companyId: req.actor.companyId, ownerId: req.actor.id },
      });
      if (!f) fail(404, 'Upload não encontrado');
      if (f.state === 'ready') return { id, state: 'ready' };
      if (f.state !== 'pending' || f.offset !== f.size)
        fail(409, 'Upload incompleto ou indisponível');
      const hasPart = !!(await stat(tempPath(id)).catch(() => null));
      const disk = hasPart ? tempPath(id) : filePath(id);
      const info = await stat(disk).catch(() => null);
      if (!info || BigInt(info.size) !== f.size)
        fail(409, 'Arquivo ausente ou tamanho inconsistente');
      const sha = createHash('sha256');
      for await (const chunk of createReadStream(disk)) sha.update(chunk);
      let state = 'quarantine';
      if (config.CLAMSCAN_PATH) {
        try {
          await scan(config.CLAMSCAN_PATH, ['--no-summary', disk], {
            timeout: 300000,
            maxBuffer: 8192,
          });
          state = 'ready';
        } catch {
          state = 'quarantine';
        }
      } else if (config.ALLOW_UNSCANNED_FILES === 'true') state = 'ready';
      if (hasPart) await rename(tempPath(id), filePath(id));
      await db.$transaction([
        db.upload.update({ where: { id }, data: { state, sha256: sha.digest('hex') } }),
        db.company.update({
          where: { id: f.companyId },
          data: { reservedBytes: { decrement: f.size }, usedBytes: { increment: f.size } },
        }),
        db.audit.create({
          data: {
            companyId: f.companyId,
            actorId: req.actor.id,
            action: `upload.${state}`,
            resourceId: id,
          },
        }),
      ]);
      return { id, state };
    } finally {
      locks.delete(id);
    }
  });
  app.delete('/api/uploads/:id', async (req) => {
    const id = param(req.params);
    if (locks.has(id)) fail(409, 'Upload em andamento');
    locks.add(id);
    try {
      const f = await fileFor(req.actor, id);
      if (f.ownerId !== req.actor.id && !manager(req.actor.role)) fail(403, 'Sem permissão');
      if (['deleted', 'expired', 'failed'].includes(f.state)) return { ok: true };
      await db.$transaction([
        db.upload.update({ where: { id }, data: { state: 'deleted' } }),
        db.company.update({
          where: { id: f.companyId },
          data:
            f.state === 'pending'
              ? { reservedBytes: { decrement: f.size } }
              : { usedBytes: { decrement: f.size } },
        }),
        db.share.updateMany({ where: { fileId: id }, data: { revoked: true } }),
      ]);
      await unlink(filePath(id)).catch(() => {});
      await unlink(tempPath(id)).catch(() => {});
      await audit(f.companyId, req.actor.id, 'file.delete', id);
      return { ok: true };
    } finally {
      locks.delete(id);
    }
  });
  app.get('/api/files/:id', async (req, reply) => {
    const f = await fileFor(req.actor, param(req.params));
    if (f.state !== 'ready') fail(404, 'Arquivo não liberado');
    await audit(f.companyId, req.actor.id, 'file.download', f.id);
    return sendFile(req, reply, f.id, f.name, f.size);
  });
  app.post('/api/files/:id/shares', async (req) => {
    needManager(req.actor);
    const f = await fileFor(req.actor, param(req.params));
    if (f.state !== 'ready') fail(409, 'Arquivo não liberado');
    const { hours } = z
      .object({ hours: z.number().int().min(1).max(168).default(24) })
      .parse(req.body);
    const raw = token();
    const s = await db.share.create({
      data: {
        companyId: f.companyId,
        fileId: f.id,
        tokenHash: hash(raw),
        expiresAt: new Date(Date.now() + hours * 3600000),
      },
    });
    await audit(f.companyId, req.actor.id, 'share.create', s.id);
    return {
      id: s.id,
      url: `${config.PUBLIC_BASE_URL}/files/share/${raw}`,
      expiresAt: s.expiresAt,
    };
  });
  app.get('/api/shares', async (req) => {
    needManager(req.actor);
    return db.share.findMany({
      where: { companyId: req.actor.companyId },
      select: { id: true, fileId: true, expiresAt: true, revoked: true },
      take: 200,
    });
  });
  app.delete('/api/shares/:id', async (req) => {
    needManager(req.actor);
    const id = param(req.params);
    await db.share.updateMany({
      where: { id, companyId: req.actor.companyId },
      data: { revoked: true },
    });
    await audit(req.actor.companyId, req.actor.id, 'share.revoke', id);
    return { ok: true };
  });
  app.get(
    '/files/share/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const raw = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.params).token;
      const s = await db.share.findUnique({
        where: { tokenHash: hash(raw) },
        include: { file: true },
      });
      if (!s || s.revoked || s.expiresAt < new Date() || s.file.state !== 'ready')
        fail(404, 'Link inválido ou expirado');
      return sendFile(req, reply, s.fileId, s.file.name, s.file.size);
    },
  );
}
