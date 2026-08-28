const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();

async function migrate() {
  // Tạo CylinderType từ dữ liệu đã đọc trước đó:
  // Gas siamgas 12kg = 5, Sai Gon Petro = 1, Van Chup = 1
  const types = [
    { name: "Gas siamgas 12kg", fullQty: 5 },
    { name: "Sai Gon Petro", fullQty: 1 },
    { name: "Van Chup", fullQty: 1 },
  ];

  for (const t of types) {
    const existing = await p.cylinderType.findUnique({ where: { name: t.name } });
    if (!existing) {
      await p.cylinderType.create({ data: t });
      console.log("Created type:", t.name, "fullQty:", t.fullQty);
    } else {
      console.log("Exists:", t.name);
    }
  }

  // Tạo CylinderEmpty với 11 bình rỗng
  const emptyRow = await p.cylinderEmpty.findFirst();
  if (!emptyRow) {
    await p.cylinderEmpty.create({ data: { qty: 11 } });
    console.log("Created empty row: qty=11");
  } else {
    await p.cylinderEmpty.update({ where: { id: emptyRow.id }, data: { qty: 11 } });
    console.log("Updated empty row: qty=11");
  }

  console.log("Migration done!");
  await p.$disconnect();
}

migrate().catch(function(e) { console.error(e.message); p.$disconnect(); });