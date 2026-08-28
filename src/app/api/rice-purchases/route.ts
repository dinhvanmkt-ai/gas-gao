export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/rice-purchases — danh sach phieu nhap gao, filter theo from/to
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (fromParam || toParam) {
    where.purchaseDate = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam + "T23:59:59.999") } : {}),
    };
  }

  const records = await prisma.ricePurchase.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
  });

  return NextResponse.json(records);
}

// POST /api/rice-purchases — tao phieu nhap gao moi
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { purchaseDate, supplierName, riceType, totalKg, pricePerKg, note } = body;

  if (!riceType || !totalKg || !pricePerKg) {
    return NextResponse.json({ error: "Thieu thong tin bat buoc" }, { status: 400 });
  }

  const totalCost = Number(totalKg) * Number(pricePerKg);

  const record = await prisma.ricePurchase.create({
    data: {
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      supplierName: supplierName || null,
      riceType,
      totalKg: Number(totalKg),
      pricePerKg: Number(pricePerKg),
      totalCost,
      note: note || null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
