const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
async function main() {
  // Lay tat ca order items chua co unitCost
  const items = await p.orderItem.findMany({
    where: { unitCost: null },
    include: {
      order: { select: { createdAt: true } },
      product: { select: { costPrice: true } }
    }
  });
  console.log("Tong order items can back-fill:", items.length);

  let filled = 0, skipped = 0;
  for (const item of items) {
    const saleDate = item.order.createdAt;
    let unitCost = null;

    // 1. costPrice nhat tay
    if (item.product.costPrice != null && item.product.costPrice > 0) {
      unitCost = item.product.costPrice;
    }

    // 2. BQ gia quyen cac lo nhap truoc ngay ban
    if (unitCost === null) {
      const purchaseItems = await p.purchaseItem.findMany({
        where: {
          productId: item.productId,
          purchase: { status: "received", purchaseDate: { lte: saleDate } }
        },
        select: { qty: true, unitCost: true }
      });
      if (purchaseItems.length > 0) {
        const totalQty = purchaseItems.reduce(function(s, i) { return s + i.qty; }, 0);
        const totalVal = purchaseItems.reduce(function(s, i) { return s + i.qty * i.unitCost; }, 0);
        unitCost = totalQty > 0 ? totalVal / totalQty : null;
      }
    }

    // 3. BQ gia quyen tat ca lich su nhap (fallback)
    if (unitCost === null) {
      const allItems = await p.purchaseItem.findMany({
        where: { productId: item.productId, purchase: { status: "received" } },
        select: { qty: true, unitCost: true }
      });
      if (allItems.length > 0) {
        const totalQty = allItems.reduce(function(s, i) { return s + i.qty; }, 0);
        const totalVal = allItems.reduce(function(s, i) { return s + i.qty * i.unitCost; }, 0);
        unitCost = totalQty > 0 ? totalVal / totalQty : null;
      }
    }

    if (unitCost !== null) {
      await p.orderItem.update({ where: { id: item.id }, data: { unitCost: unitCost } });
      filled++;
    } else {
      skipped++;
    }
  }

  console.log("Da back-fill:", filled, "don");
  console.log("Khong co gia von:", skipped, "don (de null)");
  await p.$disconnect();
}
main().catch(function(e) { console.error(e.message); });