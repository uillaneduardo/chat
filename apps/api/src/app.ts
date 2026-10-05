import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { User } from '@prisma/client';
import { ZodError } from 'zod';
import { db } from '../../../packages/database/src.js';
import { config } from '../../../packages/config/src/index.js';
import { hash, token, passwordMatches } from '../../../packages/domain/src/security.js';
import { loginSchema } from '../../../packages/contracts/src/index.js';
import { audit, fail } from './helpers.js';
import { registerInbox } from './inbox.js';
import { registerAdmin } from './admin.js';
import { registerStorage } from './storage.js';
import { registerWebhook } from './webhook.js';
import { safeError } from './diagnostics.js';
declare module 'fastify' {
  interface FastifyRequest {
    actor: User;
    csrfToken: string;
  }
}
export async function createApp() {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, trustProxy: false });
  app.decorateRequest('actor', null as unknown as User);
  app.decorateRequest('csrfToken', '');
  await app.register(cookie);
  await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = e instanceof ZodError ? 422 : (e.statusCode ?? 500);
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          requestId: req.id,
          method: req.method,
          path: req.routeOptions.url ?? '/unmatched',
          code: 'SERVER_ERROR',
          ...safeError(error),
        }),
      );
    reply.code(status).send({
      message:
        status >= 500
          ? 'Erro interno. Consulte os logs pelo identificador.'
          : e instanceof ZodError
            ? 'Entrada inválida'
            : e.message,
      requestId: req.id,
    });
  });
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY')
      .header('Cache-Control', 'no-store');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    const path = req.routeOptions.url ?? req.url.split('?')[0];
    if (path.startsWith('/api/') && !['/api/health', '/api/auth/login'].includes(path)) {
      const raw = req.cookies.chat_session;
      if (!raw) fail(401, 'Entre na plataforma');
      const s = await db.session.findUnique({ where: { id: hash(raw) }, include: { user: true } });
      if (!s || s.expiresAt < new Date() || !s.user.active) fail(401, 'Sessão expirada');
      req.actor = s.user;
      req.csrfToken = s.csrf;
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== s.csrf)
        fail(403, 'Proteção CSRF: atualize a página');
    }
    if (path.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      const origins = [
        new URL(config.PUBLIC_BASE_URL).origin,
        ...(config.NODE_ENV === 'development'
          ? ['http://localhost:5173', 'http://127.0.0.1:5173']
          : []),
      ];
      if (origin && !origins.includes(origin)) fail(403, 'Origem inválida');
      if (path === '/api/auth/login' && config.NODE_ENV === 'production' && !origin)
        fail(403, 'Origem necessária');
    }
  });
  app.get('/api/health', async () => {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok', version: '0.1.1' };
  });
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = loginSchema.parse(req.body);
      const u = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
      const dummy = '0123456789abcdef0123456789abcdef:' + '00'.repeat(64);
      const valid = await passwordMatches(body.password, u?.passwordHash ?? dummy);
      if (!u || !u.active || !valid) fail(401, 'E-mail ou senha inválidos');
      const raw = token(),
        csrf = token();
      if (req.cookies.chat_session)
        await db.session.deleteMany({ where: { id: hash(req.cookies.chat_session) } });
      await db.session.create({
        data: { id: hash(raw), userId: u.id, csrf, expiresAt: new Date(Date.now() + 8 * 3600000) },
      });
      reply.setCookie('chat_session', raw, {
        httpOnly: true,
        secure: config.PUBLIC_BASE_URL.startsWith('https://'),
        sameSite: 'strict',
        path: '/',
        maxAge: 8 * 3600,
      });
      await audit(u.companyId, u.id, 'auth.login');
      return { ok: true };
    },
  );
  app.get('/api/me', async (req) => ({
    id: req.actor.id,
    name: req.actor.name,
    email: req.actor.email,
    role: req.actor.role,
    companyId: req.actor.companyId,
    csrfToken: req.csrfToken,
    demoEnabled: config.ENABLE_DEMO === 'true',
  }));
  app.post('/api/auth/logout', async (req, reply) => {
    await db.session.deleteMany({ where: { id: hash(req.cookies.chat_session!) } });
    reply.clearCookie('chat_session', { path: '/' });
    return { ok: true };
  });
  await registerInbox(app);
  await registerAdmin(app);
  await registerStorage(app);
  await registerWebhook(app);
  const root = resolve('dist/web');
  if (existsSync(root)) {
    await app.register(staticFiles, { root, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (
        req.method === 'GET' &&
        !req.url.startsWith('/api/') &&
        !req.url.startsWith('/files/') &&
        !req.url.startsWith('/webhooks/')
      )
        return reply.sendFile('index.html');
      reply.code(404).send({ message: 'Não encontrado' });
    });
  }
  return app;
}
