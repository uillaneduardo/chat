import { db } from '../../../packages/database/src.js';
import { nextStatus } from '../../../packages/domain/src/security.js';
export async function processStatuses() {
  const events = await db.providerStatus.findMany({
    where: { applied: false, nextAttemptAt: { lte: new Date() } },
    take: 100,
    orderBy: { nextAttemptAt: 'asc' },
  });
  for (const e of events) {
    await db.$transaction(async (tx) => {
      const m = await tx.message.findUnique({
        where: { providerId: e.providerId },
        include: { conversation: { include: { contact: true } } },
      });
      if (!m) {
        await tx.providerStatus.update({
          where: { id: e.id },
          data: { nextAttemptAt: new Date(Date.now() + 60000) },
        });
        return;
      }
      if (m.conversation.accountId !== e.accountId) {
        await tx.providerStatus.update({ where: { id: e.id }, data: { applied: true } });
        return;
      }
      const data: {
        status: string;
        billable?: boolean | null;
        category?: string | null;
        cost?: string;
        currency?: string | null;
        errorCode?: string | null;
      } = { status: nextStatus(m.status, e.status), errorCode: e.errorCode ?? m.errorCode };
      if (e.category) data.category = e.category;
      if (e.billable !== null) data.billable = e.billable;
      if (['delivered', 'read'].includes(e.status) && m.cost === null) {
        if (e.billable === false) {
          data.cost = '0';
          data.currency = null;
        } else if (
          e.billable === true &&
          e.category &&
          m.conversation.contact.waId.startsWith('55')
        ) {
          const rate = await tx.tariff.findFirst({
            where: {
              companyId: m.companyId,
              market: 'BR',
              category: e.category,
              validFrom: { lte: e.occurredAt },
            },
            orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
          });
          if (rate) {
            data.cost = rate.price.toFixed(8);
            data.currency = rate.currency;
          }
        }
      }
      await tx.message.update({ where: { id: m.id }, data });
      await tx.providerStatus.update({ where: { id: e.id }, data: { applied: true } });
    });
  }
}
