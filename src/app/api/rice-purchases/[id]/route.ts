export const dynamic = "force-dynamic"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const record = await prisma.ricePurchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: { select: { id: true, name: true, phone: true } },
      items: { include: { riceProduct: true } },
    },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(record)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { paymentStatus, note } = body
  const record = await prisma.ricePurchase.update({
    where: { id: params.id },
    data: {
      ...(paymentStatus !== undefined ? { paymentStatus } : {}),
      ...(note !== undefined ? { note } : {}),
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { riceProduct: true } },
    },
  })
  return NextResponse.json(record)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await prisma.ricePurchase.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}