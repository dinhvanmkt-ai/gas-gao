import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, unit, priceRetail, priceWhole, minStock, costPrice } = body

  // Lấy sản phẩm cũ trước khi cập nhật (để biết tên cũ)
  const oldProduct = await prisma.product.findUnique({ where: { id: params.id } })

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      name,
      type,
      unit,
      priceRetail: Number(priceRetail) || 0,
      priceWhole: priceWhole != null ? Number(priceWhole) : null,
      minStock: Number(minStock) || 0,
      costPrice: costPrice != null ? Number(costPrice) : null,
    },
  })

  // ── Tự động đồng bộ CylinderType khi đổi tên / loại sản phẩm gas ─
  if (oldProduct) {
    const oldIsGas = oldProduct.type === 'gas'
    const newIsGas = product.type === 'gas'
    const nameChanged = oldProduct.name !== product.name

    if (newIsGas) {
      // Đảm bảo CylinderType với tên mới tồn tại
      const existing = await prisma.cylinderType.findUnique({ where: { name: product.name } })
      if (!existing) {
        await prisma.cylinderType.create({ data: { name: product.name, fullQty: 0 } })
      }

      // Nếu tên đã đổi và loại vẫn là gas → đổi tên CylinderType cũ (nếu có)
      if (nameChanged && oldIsGas) {
        const oldType = await prisma.cylinderType.findUnique({ where: { name: oldProduct.name } })
        if (oldType) {
          // Chuyển fullQty sang tên mới rồi xóa tên cũ
          await prisma.cylinderType.update({
            where: { name: product.name },
            data: { fullQty: { increment: oldType.fullQty } },
          })
          await prisma.cylinderType.delete({ where: { id: oldType.id } })
        }
      }
    } else if (oldIsGas && !newIsGas) {
      // Sản phẩm không còn là gas nữa → CylinderType cũ để nguyên (không tự xóa, tránh mất dữ liệu)
      // Người dùng tự quản lý trong tab Vỏ Bình nếu cần xóa
    }
  }
  // ──────────────────────────────────────────────────────────────────

  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if product has orders or purchase items
  const orderCount = await prisma.orderItem.count({ where: { productId: params.id } })
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `Không thể xóa — sản phẩm đang có ${orderCount} đơn hàng liên quan` },
      { status: 400 }
    )
  }

  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
