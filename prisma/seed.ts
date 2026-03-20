import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@gasstore.com' },
    update: {},
    create: {
      name: 'Quản Trị Viên',
      email: 'admin@gasstore.com',
      password: hashedPassword,
      role: 'admin',
    },
  })
  console.log('✅ Admin user: admin@gasstore.com / admin123')

  await prisma.product.upsert({
    where: { id: 'prod-gas-12kg' },
    update: {},
    create: {
      id: 'prod-gas-12kg',
      name: 'Gas 12kg',
      type: 'gas',
      unit: 'bình',
      priceRetail: 480000,
      priceWhole: 460000,
      stock: 50,
      minStock: 10,
    },
  })

  await prisma.product.upsert({
    where: { id: 'prod-gas-45kg' },
    update: {},
    create: {
      id: 'prod-gas-45kg',
      name: 'Gas 45kg',
      type: 'gas',
      unit: 'bình',
      priceRetail: 1600000,
      priceWhole: 1550000,
      stock: 20,
      minStock: 5,
    },
  })

  await prisma.product.upsert({
    where: { id: 'prod-rice-st25' },
    update: {},
    create: {
      id: 'prod-rice-st25',
      name: 'Gạo ST25',
      type: 'rice',
      unit: 'kg',
      priceRetail: 30000,
      priceWhole: 28000,
      stock: 500,
      minStock: 100,
    },
  })

  await prisma.product.upsert({
    where: { id: 'prod-rice-jasmine' },
    update: {},
    create: {
      id: 'prod-rice-jasmine',
      name: 'Gạo Jasmine',
      type: 'rice',
      unit: 'kg',
      priceRetail: 25000,
      priceWhole: 23000,
      stock: 300,
      minStock: 80,
    },
  })
  console.log('✅ Products created')

  const customerData = [
    {
      id: 'cust-001',
      name: 'Nguyễn Văn An',
      phone: '0901234567',
      address: '12 Lê Lợi, Q.1',
      gasAvgDays: 30,
      gasLastBuyDate: new Date('2026-02-15'),
      gasLastQty: 12,
      gasCylinderQty: 1,
      gasPredictedDate: new Date('2026-03-17'),
      urgencyScore: 90,
      debtBalance: 0,
    },
    {
      id: 'cust-002',
      name: 'Trần Thị Bình',
      phone: '0912345678',
      address: '45 Nguyễn Huệ, Q.1',
      riceAvgDays: 14,
      riceLastBuyDate: new Date('2026-03-05'),
      riceLastQty: 10,
      ricePredictedDate: new Date('2026-03-19'),
      urgencyScore: 75,
      debtBalance: 200000,
    },
    {
      id: 'cust-003',
      name: 'Lê Hoàng Cường',
      phone: '0923456789',
      address: '8 Trần Hưng Đạo, Q.5',
      gasAvgDays: 45,
      gasLastBuyDate: new Date('2026-02-01'),
      gasLastQty: 45,
      gasCylinderQty: 2,
      riceAvgDays: 21,
      riceLastBuyDate: new Date('2026-02-25'),
      riceLastQty: 20,
      gasPredictedDate: new Date('2026-03-18'),
      ricePredictedDate: new Date('2026-03-18'),
      urgencyScore: 85,
      debtBalance: 500000,
    },
  ]

  for (const c of customerData) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    })
  }
  console.log('✅ Sample customers created')

  await prisma.supplier.upsert({
    where: { id: 'sup-001' },
    update: {},
    create: {
      id: 'sup-001',
      name: 'Petrolimex Gas',
      phone: '0281234567',
      address: '100 Đinh Tiên Hoàng, Q.Bình Thạnh',
      type: 'gas',
    },
  })
  console.log('✅ Supplier created')

  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
