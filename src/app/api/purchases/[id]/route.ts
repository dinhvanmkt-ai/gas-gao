import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  })
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(purchase)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { paymentStatus, note } = body
  const purchase = await prisma.purchase.update({
    where: { id: params.id },
    data: {
      ...(paymentStatus !== undefined ? { paymentStatus } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  })
  return NextResponse.json(purchase)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        items: true,
      },
    })

    if (!purchase) return NextResponse.json({ error: 'Không tìm thấy phiếu nhập' }, { status: 404 })

    // Chỉ hoàn tác kho nếu đã "received" (đã nhập kho thật)
    if (purchase.status === 'received') {
      // 1. Hoàn tác tồn kho sản phẩm
      for (const item of purchase.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        })
      }

      // 2. Xóa stock audit liên quan
      await prisma.stockAudit.deleteMany({ where: { refId: purchase.id } })

      // 3. Xóa price history liên quan
      await prisma.priceHistory.deleteMany({ where: { purchaseId: purchase.id } })

      // 4. Hoàn tác tồn kho bình cho sản phẩm gas (non-exchange)
      for (const item of purchase.items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        if (product?.type === 'gas' && purchase.cylinderTxType !== 'exchange') {
          const matchingType = await prisma.cylinderType.findFirst({
            where: { name: { contains: product.name } },
            orderBy: { name: 'asc' },
          })
          const targetType = matchingType ?? await prisma.cylinderType.findFirst({ orderBy: { name: 'asc' } })
          if (targetType) {
            await prisma.cylinderType.update({
              where: { id: targetType.id },
              data: { fullQty: { decrement: item.qty } },
            })
          }
        }
      }

      // 5. Hoàn tác vỏ bình từ cylinderTxType (exchange/buy vỏ riêng với NCC)
      const cylQty = purchase.cylinderQty ?? 0
      const cylinderTxType = purchase.cylinderTxType

      if (cylQty > 0 && cylinderTxType) {
        const firstType = await prisma.cylinderType.findFirst({ orderBy: { name: 'asc' } })
        if (cylinderTxType === 'buy') {
          // Hoàn tác: giảm fullQty đã tăng khi mua
          if (firstType) {
            await prisma.cylinderType.update({
              where: { id: firstType.id },
              data: { fullQty: { decrement: cylQty } },
            })
          }
        } else if (cylinderTxType === 'exchange') {
          // Hoàn tác: giảm fullQty và tăng lại emptyQty
          if (firstType) {
            await prisma.cylinderType.update({
              where: { id: firstType.id },
              data: { fullQty: { decrement: cylQty } },
            })
          }
          const emptyRow = await prisma.cylinderEmpty.findFirst()
          if (emptyRow) {
            await prisma.cylinderEmpty.update({
              where: { id: emptyRow.id },
              data: { qty: { increment: cylQty } },
            })
          }
        }
      }
    }

    // 5. Xóa purchase items trước, rồi xóa purchase
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } })
    await prisma.purchase.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Delete purchase error:', e)
    return NextResponse.json({ error: 'Lỗi xóa phiếu: ' + (e.message ?? 'Unknown') }, { status: 500 })
  }
}
