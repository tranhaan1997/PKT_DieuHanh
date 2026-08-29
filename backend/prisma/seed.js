'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        fullName: 'Administrator',
        email: 'admin@dh.local',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash('Admin@123', 10),
        active: true,
      },
    });
    console.log('Seeded admin user: admin / Admin@123');
  }

  const supervisorExists = await prisma.user.findUnique({ where: { username: 'dieuhanh' } });
  if (!supervisorExists) {
    await prisma.user.create({
      data: {
        username: 'dieuhanh',
        fullName: 'Nguyễn Điều Hành',
        email: 'dieuhanh@dh.local',
        role: 'SUPERVISOR',
        passwordHash: await bcrypt.hash('Dieuhanh@123', 10),
        active: true,
      },
    });
    console.log('Seeded supervisor user: dieuhanh / Dieuhanh@123');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
