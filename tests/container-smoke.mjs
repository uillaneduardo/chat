import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8300';
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
const page = await fetch(base);
assert.equal(page.status, 200);
assert.match(await page.text(), /<html/);
const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:8300' },
  body: JSON.stringify({ email: 'owner@example.invalid', password: 'synthetic-ci-password' }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie);
const me = await fetch(`${base}/api/me`, { headers: { cookie } });
assert.equal(me.status, 200);
assert.equal((await me.json()).email, 'owner@example.invalid');
console.log('Imagem: saúde, frontend, login e proprietário persistido OK.');
