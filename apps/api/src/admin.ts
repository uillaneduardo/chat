import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import { accountSchema, userSchema } from '../../../packages/contracts/src/index.js';
import { encrypt, hash, passwordHash } from '../../../packages/domain/src/security.js';
import { needAdmin, needManager, fail, audit } from './helpers.js';
export async function registerAdmin(app: FastifyInstance) {
  app.get('/api/users', async (req) => {
    needManager(req.actor);
    return db.user.findMany({
      where: { companyId: req.actor.companyId },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  });
  app.post('/api/users', async (req) => {
    needAdmin(req.actor);
    const b = userSchema.parse(req.body);
    const u = await db.user.create({
      data: {
        companyId: req.actor.companyId,
        name: b.name,
        email: b.email.toLowerCase(),
        role: b.role,
        passwordHash: await passwordHash(b.password),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await audit(req.actor.companyId, req.actor.id, 'user.create', u.id);
    return u;
  });
  app.patch('/api/users/:id', async (req) => {
    needAdmin(req.actor);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = z.object({ active: z.boolean() }).parse(req.body);
    const u = await db.user.findFirst({ where: { id, companyId: req.actor.companyId } });
    if (!u || u.role === 'owner' || u.id === req.actor.id)
      fail(403, 'Não é possível alterar este usuário');
    await db.$transaction([
      db.user.update({ where: { id }, data: b }),
      db.session.deleteMany({ where: { userId: id } }),
      db.audit.create({
        data: {
          companyId: req.actor.companyId,
          actorId: req.actor.id,
          action: 'user.status',
          resourceId: id,
          details: JSON.stringify(b),
        },
      }),
    ]);
    return { ok: true };
  });
  app.get('/api/accounts', async (req) => {
    needManager(req.actor);
    const rows = await db.account.findMany({ where: { companyId: req.actor.companyId } });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      mode: a.mode,
      phoneNumberId: a.phoneNumberId,
      wabaId: a.wabaId,
      graphVersion: a.graphVersion,
      lastWebhook: a.lastWebhook,
      hasCredentials: !!a.tokenEncrypted,
      webhookUrl: `${config.PUBLIC_BASE_URL}/webhooks/meta/${a.id}`,
    }));
  });
  const data = (b: z.infer<typeof accountSchema>) => ({
    name: b.name,
    mode: b.mode,
    phoneNumberId: b.phoneNumberId,
    wabaId: b.wabaId,
    graphVersion: b.graphVersion,
    ...(b.accessToken ? { tokenEncrypted: encrypt(b.accessToken, config.ENCRYPTION_KEY) } : {}),
    ...(b.appSecret ? { appSecretEncrypted: encrypt(b.appSecret, config.ENCRYPTION_KEY) } : {}),
    ...(b.verifyToken ? { verifyHash: hash(b.verifyToken) } : {}),
  });
  app.post('/api/accounts', async (req) => {
    needAdmin(req.actor);
    const b = accountSchema.parse(req.body);
    if (b.mode === 'demo' && config.ENABLE_DEMO !== 'true') fail(403, 'Modo demo desativado');
    if (
      b.mode === 'meta' &&
      (!b.phoneNumberId ||
        !b.wabaId ||
        !b.graphVersion ||
        !b.accessToken ||
        !b.appSecret ||
        !b.verifyToken)
    )
      fail(422, 'Preencha todos os campos Meta');
    const a = await db.account.create({ data: { companyId: req.actor.companyId, ...data(b) } });
    await audit(req.actor.companyId, req.actor.id, 'account.create', a.id);
    return { id: a.id };
  });
  app.put('/api/accounts/:id', async (req) => {
    needAdmin(req.actor);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = accountSchema.parse(req.body);
    const a = await db.account.findFirst({ where: { id, companyId: req.actor.companyId } });
    if (!a) fail(404, 'Conta não encontrada');
    if (b.mode !== a.mode) fail(422, 'O modo da conta não pode ser alterado');
    await db.account.update({ where: { id }, data: data(b) });
    await audit(req.actor.companyId, req.actor.id, 'account.update_credentials', id);
    return { ok: true };
  });
  app.get('/api/settings', async (req) => {
    needManager(req.actor);
    const c = await db.company.findUniqueOrThrow({ where: { id: req.actor.companyId } });
    return {
      ...c,
      maxFileBytes: c.maxFileBytes.toString(),
      quotaBytes: c.quotaBytes.toString(),
      usedBytes: c.usedBytes.toString(),
      reservedBytes: c.reservedBytes.toString(),
      unscannedAllowed: config.ALLOW_UNSCANNED_FILES === 'true',
    };
  });
  app.put('/api/settings', async (req) => {
    needAdmin(req.actor);
    const b = z
      .object({
        name: z.string().min(1).max(100),
        maxFileBytes: z.string().regex(/^\d+$/),
        quotaBytes: z.string().regex(/^\d+$/),
        budget: z
          .string()
          .regex(/^\d+(\.\d{1,8})?$/)
          .nullable(),
      })
      .parse(req.body);
    const max = BigInt(b.maxFileBytes),
      quota = BigInt(b.quotaBytes);
    if (max < 1n || max > 2147483648n || quota < 1n || quota > 10000000000000n)
      fail(422, 'Limites inválidos; máximo de arquivo beta: 2 GiB');
    const c = await db.company.findUniqueOrThrow({ where: { id: req.actor.companyId } });
    if (quota < c.usedBytes + c.reservedBytes)
      fail(409, 'Quota menor que o espaço usado e reservado');
    await db.company.update({
      where: { id: c.id },
      data: { name: b.name, maxFileBytes: max, quotaBytes: quota, budget: b.budget },
    });
    await audit(c.id, req.actor.id, 'settings.update');
    return { ok: true };
  });
  app.get('/api/tariffs', async (req) => {
    needManager(req.actor);
    return db.tariff.findMany({
      where: { companyId: req.actor.companyId },
      orderBy: { validFrom: 'desc' },
    });
  });
  app.post('/api/tariffs', async (req) => {
    needAdmin(req.actor);
    const b = z
      .object({
        market: z.literal('BR'),
        category: z.enum(['service', 'utility', 'authentication', 'marketing']),
        currency: z.string().regex(/^[A-Z]{3}$/),
        price: z.string().regex(/^\d{1,8}(\.\d{1,8})?$/),
        validFrom: z.iso.datetime(),
        source: z
          .url()
          .max(500)
          .refine((value) => value.startsWith('https://')),
      })
      .parse(req.body);
    const rate = await db.tariff.create({
      data: { companyId: req.actor.companyId, ...b, validFrom: new Date(b.validFrom) },
    });
    await audit(req.actor.companyId, req.actor.id, 'tariff.create', rate.id);
    return rate;
  });
  app.get('/api/usage', async (req) => {
    needManager(req.actor);
    const q = z
      .object({
        month: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
          .default(new Date().toISOString().slice(0, 7)),
      })
      .parse(req.query);
    const start = new Date(q.month + '-01T00:00:00Z'),
      end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const rows = await db.message.findMany({
      where: {
        companyId: req.actor.companyId,
        direction: 'outgoing',
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        conversationId: true,
        status: true,
        cost: true,
        currency: true,
        category: true,
        billable: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const totals: Record<string, string> = {};
    for (const m of rows)
      if (m.cost && m.currency)
        totals[m.currency] = new (await import('@prisma/client')).Prisma.Decimal(
          totals[m.currency] ?? '0',
        )
          .plus(m.cost)
          .toFixed(8);
    const company = await db.company.findUniqueOrThrow({ where: { id: req.actor.companyId } });
    return {
      month: q.month,
      total: rows.length,
      pending: rows.filter((x) => x.cost === null).length,
      demoFree: rows.filter((x) => x.cost?.equals(0) && x.currency === null).length,
      totals,
      budget: company.budget,
      rows: rows.slice(0, 500),
      note: 'Estimativas por tarifa manual BR, sem franquias/faixas/câmbio. Não é fatura Meta. Orçamento é aviso, sem bloqueio.',
    };
  });
  app.get('/api/audit', async (req) => {
    needAdmin(req.actor);
    return db.audit.findMany({
      where: { companyId: req.actor.companyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });
}
