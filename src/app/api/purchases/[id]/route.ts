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

      // 4. Xóa vỏ bình tự động tạo từ sản phẩm gas (serial: purchaseNo-I...)
      const autoGasCylinders = await prisma.cylinder.findMany({
        where: {
          serial: { startsWith: `${purchase.purchaseNo}-I` },
          status: 'at_store_full', // chỉ xóa nếu chưa xuất đơn
        },
      })
      for (const c of autoGasCylinders) {
        await prisma.cylinder.delete({ where: { id: c.id } })
      }

      // 5. Hoàn tác vỏ bình từ cylinderTxType (exchange/buy vỏ riêng)
      const cylQty = purchase.cylinderQty ?? 0
      const cylinderTxType = purchase.cylinderTxType

      if (cylQty > 0 && cylinderTxType) {
        if (cylinderTxType === 'buy') {
          // Xóa các bình vỏ trống đã tạo riêng (serial: purchaseNo-VOT-...)
          const toDelete = await prisma.cylinder.findMany({
            where: {
              serial: { startsWith: `${purchase.purchaseNo}-VOT-` },
              status: 'at_store_full',
            },
            take: cylQty,
          })
          for (const c of toDelete) {
            await prisma.cylinder.delete({ where: { id: c.id } })
          }
        } else if (cylinderTxType === 'exchange') {
          // Hoàn tác: chuyển bình đầy → rỗng lại
          const toRevert = await prisma.cylinder.findMany({
            where: { status: 'at_store_full' },
            take: cylQty,
            orderBy: { updatedAt: 'desc' },
          })
          for (const c of toRevert) {
            await prisma.cylinder.update({
              where: { id: c.id },
              data: { status: 'at_store_empty' },
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
