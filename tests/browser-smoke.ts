import 'dotenv/config';
import { chromium } from 'playwright';
const base = process.env.SMOKE_BASE_URL,
  email = process.env.SMOKE_EMAIL,
  password = process.env.SMOKE_PASSWORD;
if (!base || !email || !password)
  throw new Error(
    'Provide SMOKE_BASE_URL, SMOKE_EMAIL and SMOKE_PASSWORD for an isolated pilot installation',
  );
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH
    ? {
        executablePath: process.env.BROWSER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      }
    : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('heading', { name: 'Entrar na plataforma' }).waitFor();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('heading', { name: 'Inbox', exact: true }).waitFor();
  const account = await page.evaluate(async () => {
    const r = await fetch('/api/accounts');
    if (!r.ok) throw new Error('Smoke requires manager account');
    const list = (await r.json()) as { id: string; mode: string }[];
    return list.find((a) => a.mode === 'demo');
  });
  if (!account)
    throw new Error('Smoke requires an existing demo account; never use Meta for this test');
  const contact = 'Synthetic ' + Date.now();
  await page.getByRole('button', { name: 'Novo atendimento' }).click();
  await page.getByLabel('Nome', { exact: true }).fill(contact);
  await page.getByLabel('Número WhatsApp').fill('5581' + String(Date.now()).slice(-9));
  await page.getByLabel('Conta', { exact: true }).selectOption(account.id);
  await page.getByRole('button', { name: 'Criar ou abrir conversa' }).click();
  await page.getByRole('heading', { name: contact, exact: true }).waitFor();
  await page.getByLabel('Tipo de mensagem').selectOption('incoming');
  await page.getByLabel('Mensagem', { exact: true }).fill('Synthetic inbound');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByText('Synthetic inbound', { exact: true }).waitFor();
  await page.getByLabel('Tipo de mensagem').selectOption('outgoing');
  await page.getByLabel('Mensagem', { exact: true }).fill('Synthetic reply');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByText('Synthetic reply', { exact: true }).waitFor();
  for (const name of ['Equipe', 'WhatsApp', 'Consumo', 'Configurações', 'Auditoria']) {
    await page.locator('nav').getByRole('button', { name, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.locator('.card').first().waitFor();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('nav').getByRole('button', { name: 'Inbox', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(contact) }).click();
  await page.getByRole('heading', { name: contact, exact: true }).waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    throw new Error('Mobile overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Browser smoke passed (synthetic contact remains in demo installation).');
} finally {
  await browser.close();
}
