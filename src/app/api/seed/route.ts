import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    const products = [
      { id: 'prod-gas-12kg', name: 'Gas 12kg', type: 'gas', unit: 'bình', priceRetail: 480000, priceWhole: 460000, stock: 50, minStock: 10 },
      { id: 'prod-gas-45kg', name: 'Gas 45kg', type: 'gas', unit: 'bình', priceRetail: 1600000, priceWhole: 1550000, stock: 20, minStock: 5 },
      { id: 'prod-rice-st25', name: 'Gạo ST25', type: 'rice', unit: 'kg', priceRetail: 30000, priceWhole: 28000, stock: 500, minStock: 100 },
      { id: 'prod-rice-jasmine', name: 'Gạo Jasmine', type: 'rice', unit: 'kg', priceRetail: 25000, priceWhole: 23000, stock: 300, minStock: 80 },
    ]

    for (const p of products) {
      await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p })
    }

    return NextResponse.json({ success: true, message: 'Database seeded successfully on Vercel!' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
