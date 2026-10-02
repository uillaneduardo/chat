import { db } from '../../../packages/database/src.js';
import { decrypt, windowOpen } from '../../../packages/domain/src/security.js';
import { config } from '../../../packages/config/src/index.js';
let running = false;
export async function dispatch() {
  if (running) return;
  running = true;
  try {
    const pending = await db.message.findMany({
      where: { status: 'queued', direction: 'outgoing' },
      include: { conversation: { include: { account: true, contact: true } } },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });
    for (const m of pending) {
      const lock = await db.message.updateMany({
        where: { id: m.id, status: 'queued' },
        data: { status: 'sending' },
      });
      if (!lock.count) continue;
      const a = m.conversation.account;
      try {
        if (a.mode === 'demo') {
          await db.message.update({
            where: { id: m.id },
            data: { status: 'delivered', billable: false, cost: '0', currency: null },
          });
          continue;
        }
        if (!a.tokenEncrypted || !a.graphVersion || !a.phoneNumberId)
          throw Object.assign(new Error(), { safeCode: 'ACCOUNT_CONFIG' });
        if (m.type !== 'template' && !windowOpen(m.conversation.lastCustomerAt))
          throw Object.assign(new Error(), { safeCode: 'WINDOW_CLOSED' });
        const payload =
          m.type === 'template' ? JSON.parse(m.payload!) : { type: 'text', text: { body: m.body } };
        const response = await fetch(
          `https://graph.facebook.com/${a.graphVersion}/${a.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${decrypt(a.tokenEncrypted, config.ENCRYPTION_KEY)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: m.conversation.contact.waId,
              ...payload,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: { code?: number } };
          await db.message.update({
            where: { id: m.id },
            data: {
              status: response.status >= 500 ? 'uncertain' : 'failed',
              errorCode: String(data.error?.code ?? response.status),
            },
          });
          continue;
        }
        const result = (await response.json()) as { messages?: { id: string }[] };
        if (!result.messages?.[0]?.id) throw new Error('Uncertain result');
        await db.message.update({
          where: { id: m.id },
          data: { status: 'accepted', providerId: result.messages[0].id },
        });
      } catch (e) {
        const safe = (e as { safeCode?: string }).safeCode;
        await db.message.update({
          where: { id: m.id },
          data: { status: safe ? 'failed' : 'uncertain', errorCode: safe ?? 'NETWORK_UNCERTAIN' },
        });
      }
    }
  } finally {
    running = false;
  }
}
export async function recoverSending() {
  await db.message.updateMany({
    where: { status: 'sending' },
    data: { status: 'uncertain', errorCode: 'RESTART_UNCERTAIN' },
  });
}
