import { db } from '../packages/database/src.js';
try {
  if (!(await db.user.count({ where: { role: 'owner' } })))
    throw new Error('Sem proprietário: configure o bootstrap conforme docs/14-installation.md.');
  console.log('Instalação contém proprietário.');
} finally {
  await db.$disconnect();
}
