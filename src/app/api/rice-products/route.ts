export const dynamic = "force-dynamic"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const products = await prisma.riceProduct.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseItems: true } },
      purchaseItems: { select: { totalKg: true, subtotal: true } },
    },
  })
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { name, description } = body
  if (!name?.trim()) return NextResponse.json({ error: "Ten loai gao khong duoc trong" }, { status: 400 })
  const product = await prisma.riceProduct.create({
    data: { name: name.trim(), description: description || null },
  })
  return NextResponse.json(product, { status: 201 })
}