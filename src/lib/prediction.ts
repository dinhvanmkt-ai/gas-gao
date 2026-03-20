/**
 * Prediction algorithm for customer purchase cycles
 * Uses exponential moving average of inter-purchase intervals
 */
import { prisma } from './prisma'

interface PurchaseRecord {
  date: Date
  qty: number
}

export function predictNextPurchase(history: PurchaseRecord[]): {
  predictedDate: Date | null
  avgDays: number | null
} {
  if (history.length < 2) return { predictedDate: null, avgDays: null }

  // Sort ascending
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Compute intervals in days
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
    intervals.push(diff)
  }

  // Exponential moving average (alpha = 0.3 → more weight to recent data)
  const alpha = 0.3
  let ema = intervals[0]
  for (let i = 1; i < intervals.length; i++) {
    ema = alpha * intervals[i] + (1 - alpha) * ema
  }

  const avgDays = Math.round(ema)
  const lastDate = sorted[sorted.length - 1].date
  const predictedDate = new Date(lastDate.getTime() + avgDays * 24 * 60 * 60 * 1000)

  return { predictedDate, avgDays }
}

export function calcUrgencyScore(predictedDate: Date | null): number {
  if (!predictedDate) return 0
  const today = new Date()
  const daysUntil = (predictedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)

  if (daysUntil < 0) return 100 // overdue
  if (daysUntil <= 1) return 90
  if (daysUntil <= 3) return 75
  if (daysUntil <= 7) return 50
  if (daysUntil <= 14) return 25
  return 10
}

/**
 * Tính và lưu thống kê mua hàng + dự đoán lần mua tiếp theo cho khách hàng.
 * Gọi sau khi tạo hoặc xóa đơn hàng để cập nhật các trường dự đoán.
 */
export async function updateCustomerPrediction(customerId: string) {
  // Lấy tất cả đơn hàng của khách, sắp xếp theo ngày
  const allOrders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        include: { product: { select: { type: true } } },
      },
    },
  })

  const customerUpdate: any = {}

  // ── GAS ──────────────────────────────────────────────────────────
  const gasOrders = allOrders.filter(o => o.items.some(i => i.product.type === 'gas'))

  if (gasOrders.length > 0) {
    const lastGasOrder = gasOrders[gasOrders.length - 1]
    customerUpdate.gasLastBuyDate = lastGasOrder.createdAt
    customerUpdate.gasLastQty = lastGasOrder.items
      .filter(i => i.product.type === 'gas')
      .reduce((s, i) => s + i.qty, 0)

    const { predictedDate, avgDays } = predictNextPurchase(
      gasOrders.map(o => ({ date: new Date(o.createdAt), qty: 1 }))
    )
    if (avgDays !== null) customerUpdate.gasAvgDays = avgDays
    if (predictedDate !== null) customerUpdate.gasPredictedDate = predictedDate
  }

  // ── GẠO ──────────────────────────────────────────────────────────
  const riceOrders = allOrders.filter(o => o.items.some(i => i.product.type === 'rice'))

  if (riceOrders.length > 0) {
    const lastRiceOrder = riceOrders[riceOrders.length - 1]
    customerUpdate.riceLastBuyDate = lastRiceOrder.createdAt
    customerUpdate.riceLastQty = lastRiceOrder.items
      .filter(i => i.product.type === 'rice')
      .reduce((s, i) => s + i.qty, 0)

    const { predictedDate, avgDays } = predictNextPurchase(
      riceOrders.map(o => ({ date: new Date(o.createdAt), qty: 1 }))
    )
    if (avgDays !== null) customerUpdate.riceAvgDays = avgDays
    if (predictedDate !== null) customerUpdate.ricePredictedDate = predictedDate
  }

  // ── URGENCY SCORE ─────────────────────────────────────────────────
  const gasPred = customerUpdate.gasPredictedDate ?? null
  const ricePred = customerUpdate.ricePredictedDate ?? null
  const gasScore = calcUrgencyScore(gasPred)
  const riceScore = calcUrgencyScore(ricePred)
  customerUpdate.urgencyScore = Math.max(gasScore, riceScore)

  if (Object.keys(customerUpdate).length > 0) {
    await prisma.customer.update({
      where: { id: customerId },
      data: customerUpdate,
    })
  }
}

