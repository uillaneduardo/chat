import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import {
  conversationSchema,
  transferSchema,
  messageSchema,
} from '../../../packages/contracts/src/index.js';
import { hash, manager, decrypt, windowOpen } from '../../../packages/domain/src/security.js';
import {
  append,
  audit,
  conversationFor,
  fileFor,
  fail,
  needManager,
  visibility,
} from './helpers.js';
const param = (p: unknown) => z.object({ id: z.string().uuid() }).parse(p).id;
export async function registerInbox(app: FastifyInstance) {
  app.get('/api/conversations', async (req) => {
    const rows = await db.conversation.findMany({
      where: {
        companyId: req.actor.companyId,
        ...(!manager(req.actor.role) ? { assignedUserId: req.actor.id } : {}),
      },
      include: { contact: true, account: { select: { id: true, name: true, mode: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return rows.map((c) => ({ ...c, windowOpen: windowOpen(c.lastCustomerAt) }));
  });
  app.post('/api/conversations', async (req) => {
    needManager(req.actor);
    const b = conversationSchema.parse(req.body);
    const a = await db.account.findFirst({
      where: { id: b.accountId, companyId: req.actor.companyId },
    });
    if (!a) fail(404, 'Conta não encontrada');
    const c = await db.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: { companyId_waId: { companyId: req.actor.companyId, waId: b.waId } },
        create: { companyId: req.actor.companyId, waId: b.waId, name: b.name },
        update: { name: b.name },
      });
      return tx.conversation.upsert({
        where: {
          companyId_accountId_contactId: {
            companyId: req.actor.companyId,
            accountId: a.id,
            contactId: contact.id,
          },
        },
        create: {
          companyId: req.actor.companyId,
          accountId: a.id,
          contactId: contact.id,
          assignedUserId: req.actor.id,
        },
        update: {},
      });
    });
    await audit(req.actor.companyId, req.actor.id, 'conversation.create', c.id);
    return c;
  });
  app.get('/api/conversations/:id', async (req) => {
    const c = await conversationFor(req.actor, param(req.params));
    const q = z.object({ before: z.coerce.number().int().positive().optional() }).parse(req.query);
    const rows = await db.message.findMany({
      where: {
        companyId: req.actor.companyId,
        conversationId: c.id,
        ...(!manager(req.actor.role)
          ? {
              OR: [
                {
                  direction: { not: 'note' },
                  sequence: { gte: c.visibleFrom },
                  ...(c.contextStartedAt
                    ? { OR: [{ originAt: null }, { originAt: { gte: c.contextStartedAt } }] }
                    : {}),
                },
                { direction: 'note', sequence: { gte: c.notesFrom } },
              ],
            }
          : {}),
        ...(q.before ? { sequence: { lt: q.before } } : {}),
      },
      include: { file: { select: { id: true, name: true, size: true, state: true } } },
      orderBy: { sequence: 'desc' },
      take: 200,
    });
    const visible = rows.filter((m) => visibility(req.actor, c, m)).reverse();
    const transfer = await db.transfer.findFirst({
      where: {
        companyId: req.actor.companyId,
        conversationId: c.id,
        toUserId: c.assignedUserId ?? '',
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      id: c.id,
      status: c.status,
      contact: c.contact,
      account: { id: c.account.id, name: c.account.name, mode: c.account.mode },
      assignedUserId: c.assignedUserId,
      version: c.version,
      visibleFrom: manager(req.actor.role) ? 1 : c.visibleFrom,
      windowOpen: windowOpen(c.lastCustomerAt),
      lastCustomerAt: c.lastCustomerAt,
      summary: transfer?.summary ?? '',
      messages: visible.map((m) => ({
        ...m,
        file: m.file ? { ...m.file, size: m.file.size.toString() } : null,
      })),
      nextBefore: rows.length === 200 ? rows[rows.length - 1].sequence : null,
    };
  });
  app.post('/api/conversations/:id/messages', async (req) => {
    const id = param(req.params),
      b = messageSchema.parse(req.body),
      u = req.actor;
    const key = z.string().min(8).max(120).parse(req.headers['idempotency-key']);
    const requestHash = hash(JSON.stringify(b));
    const c = await conversationFor(u, id);
    if (c.status === 'closed') fail(409, 'Reabra o atendimento antes de enviar');
    if (
      b.direction === 'incoming' &&
      (c.account.mode !== 'demo' || config.ENABLE_DEMO !== 'true' || !manager(u.role))
    )
      fail(403, 'Simulação disponível apenas em conta demo para gestores');
    if (b.fileId) {
      const f = await fileFor(u, b.fileId);
      if (f.state !== 'ready') fail(409, 'Arquivo ainda não está liberado');
      if (b.direction !== 'note')
        fail(422, 'Anexo local é interno. Para WhatsApp, crie link e envie o texto.');
    }
    let templatePayload: string | undefined;
    if (b.direction === 'outgoing' && c.account.mode === 'meta') {
      if (!b.template && !windowOpen(c.lastCustomerAt))
        fail(409, 'Janela encerrada: selecione template aprovado');
      if (b.template) {
        if (!c.account.tokenEncrypted || !c.account.graphVersion || !c.account.wabaId)
          fail(422, 'Conta incompleta');
        const url = `https://graph.facebook.com/${c.account.graphVersion}/${c.account.wabaId}/message_templates?name=${encodeURIComponent(b.template.name)}&limit=100`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${decrypt(c.account.tokenEncrypted, config.ENCRYPTION_KEY)}`,
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) fail(502, 'Não foi possível validar template na Meta');
        const list = (await response.json()) as {
          data?: {
            name: string;
            language: string;
            status: string;
            category: string;
            components?: { type: string; text?: string }[];
          }[];
        };
        const t = list.data?.find(
          (t) =>
            t.name === b.template!.name &&
            t.language === b.template!.language &&
            t.status === 'APPROVED',
        );
        if (!t) fail(422, 'Template não aprovado para este nome/idioma');
        if (t.components?.some((x) => x.text?.includes('{{')))
          fail(422, 'Templates com parâmetros ainda não são suportados');
        templatePayload = JSON.stringify({
          type: 'template',
          template: { name: b.template.name, language: { code: b.template.language } },
        });
      }
    }
    try {
      return await db.$transaction(async (tx) => {
        // Lock conversation, then revalidate assignment after any concurrent transfer.
        const current = await tx.conversation.update({
          where: { companyId_id: { companyId: u.companyId, id } },
          data: { version: { increment: 1 } },
        });
        if (!manager(u.role) && current.assignedUserId !== u.id)
          fail(404, 'Conversa não encontrada');
        if (current.status === 'closed') fail(409, 'Conversa encerrada');
        const old = await tx.message.findUnique({
          where: { conversationId_idempotencyKey: { conversationId: id, idempotencyKey: key } },
        });
        if (old) {
          if (old.requestHash !== requestHash) fail(409, 'Chave repetida com conteúdo diferente');
          return { id: old.id, status: old.status };
        }
        const m = await append(tx, u.companyId, id, {
          body: b.body,
          direction: b.direction,
          originAt: b.direction === 'incoming' ? new Date() : undefined,
          authorId: u.id,
          type: b.template ? 'template' : b.fileId ? 'file' : 'text',
          payload: templatePayload,
          status:
            b.direction === 'outgoing'
              ? 'queued'
              : b.direction === 'note'
                ? 'internal'
                : 'received',
          fileId: b.fileId,
          idempotencyKey: key,
          requestHash,
        });
        if (b.direction === 'incoming')
          await tx.conversation.update({ where: { id }, data: { lastCustomerAt: new Date() } });
        await tx.audit.create({
          data: {
            companyId: u.companyId,
            actorId: u.id,
            action: 'message.create',
            resourceId: m.id,
          },
        });
        return { id: m.id, status: m.status };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        fail(409, 'Requisição concorrente. Consulte a conversa antes de tentar novamente.');
      throw e;
    }
  });
  app.post('/api/conversations/:id/transfers', async (req) => {
    needManager(req.actor);
    const id = param(req.params),
      b = transferSchema.parse(req.body);
    const c = await conversationFor(req.actor, id);
    const u = await db.user.findFirst({
      where: { id: b.userId, companyId: req.actor.companyId, active: true },
    });
    if (!u) fail(404, 'Atendente não encontrado');
    return db.$transaction(async (tx) => {
      const won = await tx.conversation.updateMany({
        where: { id, companyId: req.actor.companyId, version: b.version },
        data: { version: { increment: 1 } },
      });
      if (!won.count) fail(409, 'A conversa mudou. Atualize antes de transferir.');
      const current = await tx.conversation.findUniqueOrThrow({ where: { id } });
      let boundary = 1;
      if (b.mode === 'future') boundary = current.lastSequence + 1;
      if (b.mode === 'last') {
        const last = await tx.message.findMany({
          where: { conversationId: id, direction: { not: 'note' } },
          orderBy: { sequence: 'desc' },
          take: b.count ?? 10,
        });
        boundary = last.at(-1)?.sequence ?? current.lastSequence + 1;
      }
      if (b.mode === 'from') {
        if (!b.fromSequence) fail(422, 'Informe a sequência inicial');
        const selected = await tx.message.findUnique({
          where: { conversationId_sequence: { conversationId: id, sequence: b.fromSequence } },
        });
        if (!selected) fail(422, 'Mensagem não encontrada');
        boundary = b.fromSequence;
      }
      await tx.conversation.update({
        where: { id },
        data: {
          assignedUserId: u.id,
          contextStartedAt:
            b.mode === 'future' ? new Date(Math.floor(Date.now() / 1000) * 1000) : null,
          visibleFrom: boundary,
          notesFrom: b.includeNotes ? boundary : current.lastSequence + 1,
        },
      });
      await tx.transfer.create({
        data: {
          companyId: c.companyId,
          conversationId: id,
          actorId: req.actor.id,
          fromUserId: current.assignedUserId,
          toUserId: u.id,
          mode: b.mode,
          boundary,
          summary: b.summary,
          reason: b.reason,
        },
      });
      if (b.mode !== 'full') {
        const messages = await tx.message.findMany({
          where: { conversationId: id, fileId: { not: null } },
          select: { fileId: true },
        });
        await tx.share.updateMany({
          where: { companyId: c.companyId, fileId: { in: messages.map((x) => x.fileId!) } },
          data: { revoked: true },
        });
      }
      await tx.audit.create({
        data: {
          companyId: c.companyId,
          actorId: req.actor.id,
          action: 'conversation.transfer',
          resourceId: id,
          details: JSON.stringify({ mode: b.mode, boundary, to: u.id }),
        },
      });
      return { ok: true };
    });
  });
  app.patch('/api/conversations/:id', async (req) => {
    const c = await conversationFor(req.actor, param(req.params));
    const b = z.object({ status: z.enum(['open', 'closed']) }).parse(req.body);
    await db.$transaction(async (tx) => {
      const current = await tx.conversation.update({
        where: { id: c.id },
        data: { version: { increment: 1 } },
      });
      if (!manager(req.actor.role) && current.assignedUserId !== req.actor.id)
        fail(404, 'Conversa não encontrada');
      await tx.conversation.update({ where: { id: c.id }, data: { status: b.status } });
      await tx.audit.create({
        data: {
          companyId: c.companyId,
          actorId: req.actor.id,
          action: `conversation.${b.status}`,
          resourceId: c.id,
        },
      });
    });
    return { ok: true };
  });
}
