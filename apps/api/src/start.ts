import { createApp } from './app.js';
import { config } from '../../../packages/config/src/index.js';
import { db } from '../../../packages/database/src.js';
import { dispatch, recoverSending } from '../../worker/src/dispatcher.js';
import { processStatuses } from '../../worker/src/status.js';
import { cleanupUploads } from './storage.js';
await db.$connect();
await recoverSending();
const app = await createApp();
let working = false;
const timer = setInterval(async () => {
  if (working) return;
  working = true;
  try {
    await processStatuses();
    await dispatch();
    await cleanupUploads();
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    console.error(JSON.stringify({ level: 'error', code: 'WORKER_ERROR' }));
  } finally {
    working = false;
  }
}, 2000);
await app.listen({ port: config.API_PORT, host: config.HOST });
console.log(`WappHub Chat 0.1.1: port ${config.API_PORT}`);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, async () => {
    clearInterval(timer);
    await app.close();
    await db.$disconnect();
    process.exit(0);
  });
