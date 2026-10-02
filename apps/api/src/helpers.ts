import { db } from '../../../packages/database/src.js';
import { manager, messageVisible } from '../../../packages/domain/src/security.js';
import type { User, Prisma } from '@prisma/client';
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode: status });
}
export function needManager(u: User) {
  if (!manager(u.role)) fail(403, 'Permissão de gestão necessária');
}
export function needAdmin(u: User) {
  if (!['owner', 'admin'].includes(u.role)) fail(403, 'Permissão administrativa necessária');
}
export async function conversationFor(u: User, id: string) {
  const c = await db.conversation.findFirst({
    where: { id, companyId: u.companyId },
    include: { contact: true, account: true },
  });
  if (!c || (!manager(u.role) && c.assignedUserId !== u.id)) fail(404, 'Conversa não encontrada');
  return c;
}
export async function audit(
  companyId: string,
  actorId: string | null,
  action: string,
  resourceId?: string,
  details: object = {},
) {
  await db.audit.create({
    data: { companyId, actorId, action, resourceId, details: JSON.stringify(details) },
  });
}
export const visibility = (
  u: User,
  c: {
    assignedUserId: string | null;
    visibleFrom: number;
    notesFrom: number;
    contextStartedAt?: Date | null;
  },
  m: { sequence: number; direction: string; originAt?: Date | null },
) =>
  !manager(u.role) && c.contextStartedAt && m.originAt && m.originAt < c.contextStartedAt
    ? false
    : messageVisible(u.role, c.assignedUserId, u.id, c.visibleFrom, c.notesFrom, m);
export async function fileFor(u: User, id: string) {
  const f = await db.upload.findFirst({ where: { id, companyId: u.companyId } });
  if (!f) fail(404, 'Arquivo não encontrado');
  if (manager(u.role)) return f;
  const refs = await db.message.findMany({
    where: { fileId: id, companyId: u.companyId },
    include: { conversation: true },
  });
  if (refs.length ? refs.some((m) => visibility(u, m.conversation, m)) : f.ownerId === u.id)
    return f;
  fail(404, 'Arquivo não encontrado');
}
export async function append(
  tx: Prisma.TransactionClient,
  companyId: string,
  conversationId: string,
  data: Omit<Prisma.MessageUncheckedCreateInput, 'companyId' | 'conversationId' | 'sequence'>,
) {
  const c = await tx.conversation.update({
    where: { companyId_id: { companyId, id: conversationId } },
    data: { lastSequence: { increment: 1 }, version: { increment: 1 } },
  });
  return tx.message.create({
    data: { ...data, companyId, conversationId, sequence: c.lastSequence },
  });
}
