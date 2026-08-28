export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.ricePurchase.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { purchaseDate, supplierName, riceType, totalKg, pricePerKg, note } = body;
  const totalCost = Number(totalKg) * Number(pricePerKg);
  const record = await prisma.ricePurchase.update({
    where: { id: params.id },
    data: {
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      supplierName: supplierName || null,
      riceType,
      totalKg: Number(totalKg),
      pricePerKg: Number(pricePerKg),
      totalCost,
      note: note || null,
    },
  });
  return NextResponse.json(record);
}