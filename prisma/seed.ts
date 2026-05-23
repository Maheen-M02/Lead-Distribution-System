import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Services
  const service1 = await prisma.service.upsert({
    where: { name: 'Service 1' },
    update: {},
    create: { id: 1, name: 'Service 1' },
  });

  const service2 = await prisma.service.upsert({
    where: { name: 'Service 2' },
    update: {},
    create: { id: 2, name: 'Service 2' },
  });

  const service3 = await prisma.service.upsert({
    where: { name: 'Service 3' },
    update: {},
    create: { id: 3, name: 'Service 3' },
  });

  console.log('Services created:', service1.name, service2.name, service3.name);

  // Create 8 Providers
  for (let i = 1; i <= 8; i++) {
    await prisma.provider.upsert({
      where: { name: `Provider ${i}` },
      update: {},
      create: {
        id: i,
        name: `Provider ${i}`,
        monthlyQuota: 10,
        leadsReceivedCount: 0,
        allocationIndex: 0,
      },
    });
  }

  console.log('8 Providers created');

  // Initialize AllocationState for each service
  for (let serviceId = 1; serviceId <= 3; serviceId++) {
    await prisma.allocationState.upsert({
      where: { serviceId },
      update: {},
      create: { serviceId, nextIndex: 0 },
    });
  }

  console.log('Allocation states initialized');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
