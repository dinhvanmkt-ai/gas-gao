import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.cylinder.deleteMany({
    where: {
      serial: {
        in: ['NH00001-001', 'NH00001-VOT-001']
      }
    }
  })
  console.log(`Deleted ${result.count} cylinders.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
