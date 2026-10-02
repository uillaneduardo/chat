import 'dotenv/config';
import { z } from 'zod';
import { db } from '../packages/database/src.js';
import { passwordHash } from '../packages/domain/src/security.js';
const input = z
  .object({
    BOOTSTRAP_COMPANY: z.string().min(1).max(100),
    BOOTSTRAP_NAME: z.string().min(1).max(100),
    BOOTSTRAP_EMAIL: z.email(),
    BOOTSTRAP_PASSWORD: z.string().min(12).max(200),
  })
  .parse(process.env);
try {
  const email = input.BOOTSTRAP_EMAIL.toLowerCase();
  if (await db.user.findUnique({ where: { email } }))
    throw new Error('Usuário já existe; bootstrap não altera contas existentes');
  await db.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: input.BOOTSTRAP_COMPANY } });
    await tx.user.create({
      data: {
        companyId: company.id,
        name: input.BOOTSTRAP_NAME,
        email,
        passwordHash: await passwordHash(input.BOOTSTRAP_PASSWORD),
        role: 'owner',
      },
    });
    if (process.env.ENABLE_DEMO === 'true')
      await tx.account.create({
        data: { companyId: company.id, name: 'Demonstração (sem envio externo)', mode: 'demo' },
      });
  });
  console.log('Empresa e proprietário criados. Entre com o e-mail informado.');
} finally {
  await db.$disconnect();
}
