export const dynamic = "force-dynamic"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { name, description, active } = body
  const product = await prisma.riceProduct.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  })
  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const count = await prisma.ricePurchaseItem.count({ where: { riceProductId: params.id } })
  if (count > 0) {
    return NextResponse.json({ error: `Khong the xoa - loai gao nay da co ${count} phieu nhap` }, { status: 400 })
  }
  await prisma.riceProduct.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}