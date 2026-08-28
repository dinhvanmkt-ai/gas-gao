export const dynamic = "force-dynamic"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const where: Record<string, unknown> = {}
  if (fromParam || toParam) {
    where.purchaseDate = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam + "T23:59:59.999") } : {}),
    }
  }
  const records = await prisma.ricePurchase.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { riceProduct: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json(records)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { supplierId, purchaseDate, paymentStatus, note, items } = body
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Vui long them it nhat 1 loai gao" }, { status: 400 })
  }
  const last = await prisma.ricePurchase.findFirst({ orderBy: { purchaseNo: "desc" }, select: { purchaseNo: true } })
  const nextNum = last ? (parseInt(last.purchaseNo.replace("RG", "")) || 0) + 1 : 1
  const purchaseNo = `RG${String(nextNum).padStart(5, "0")}`
  let totalCost = 0
  const itemsWithSubtotal = items.map((i: { riceProductId: string; totalKg: number; pricePerKg: number }) => {
    const subtotal = Number(i.totalKg) * Number(i.pricePerKg)
    totalCost += subtotal
    return { ...i, subtotal }
  })
  const record = await prisma.ricePurchase.create({
    data: {
      purchaseNo,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      supplierId: supplierId || null,
      paymentStatus: paymentStatus || "paid",
      totalCost,
      note: note || null,
      items: {
        create: itemsWithSubtotal.map((i: { riceProductId: string; totalKg: number; pricePerKg: number; subtotal: number }) => ({
          riceProductId: i.riceProductId,
          totalKg: Number(i.totalKg),
          pricePerKg: Number(i.pricePerKg),
          subtotal: i.subtotal,
        })),
      },
    },
    include: {
      items: { include: { riceProduct: true } },
      supplier: { select: { name: true } },
    },
  })
  for (const item of itemsWithSubtotal) {
    await prisma.riceProduct.update({
      where: { id: item.riceProductId },
      data: { lastPricePerKg: Number(item.pricePerKg) },
    })
  }
  return NextResponse.json(record, { status: 201 })
}