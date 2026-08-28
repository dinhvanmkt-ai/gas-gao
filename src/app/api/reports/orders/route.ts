export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/reports/orders
 * Trat ve TAT CA don hang trong khoang thoi gian (khong gioi han 50)
 * Dung rieng cho trang bao cao -- chi tra ve cac truong can thiet de tinh toan
 *
 * Query params:
 *   from  -- ISO date string (bat dau)
 *   to    -- ISO date string (ket thuc)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam + "T23:59:59.999") : defaultTo;

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNo: true,
      status: true,
      paymentMethod: true,
      totalAmount: true,
      paidAmount: true,
      debtAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
      items: {
        select: {
          qty: true,
          unitPrice: true,
          subtotal: true,
          product: { select: { id: true, name: true, type: true, unit: true } },
        },
      },
    },
  });

  return NextResponse.json(orders);
}
