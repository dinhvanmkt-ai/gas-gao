const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
async function main() {
  // 1. Chuyen "Sai Gon Petro" (1 binh) -> "Sai Gon Petro" (dung ten)
  var oldSGP = await p.cylinderType.findFirst({ where: { name: "Sai Gon Petro" } });
  var newSGP = await p.cylinderType.findFirst({ where: { name: "Sai Gon Petro".replace("Sai Gon Petro", "Sai Gon Petro") } });
  // Tim chinh xac
  oldSGP = await p.cylinderType.findFirst({ where: { name: "Sai Gon Petro" } });
  newSGP = await p.cylinderType.findFirst({ where: { name: "S\u00e0i G\u00f2n Petro" } });
  if (oldSGP && newSGP) {
    await p.cylinderType.update({ where: { id: newSGP.id }, data: { fullQty: { increment: oldSGP.fullQty } } });
    await p.cylinderType.delete({ where: { id: oldSGP.id } });
    console.log("Merged Sai Gon Petro (" + oldSGP.fullQty + " binh) -> Sai Gon Petro (dung ten)");
  }

  // 2. Chuyen "Van Chup" (1 binh) -> "Van Chup Xin"
  var oldVC = await p.cylinderType.findFirst({ where: { name: "Van Chup" } });
  var newVCX = await p.cylinderType.findFirst({ where: { name: "Van Ch\u1ee5p X\u1ecbn" } });
  if (oldVC && newVCX) {
    await p.cylinderType.update({ where: { id: newVCX.id }, data: { fullQty: { increment: oldVC.fullQty } } });
    await p.cylinderType.delete({ where: { id: oldVC.id } });
    console.log("Merged Van Chup (" + oldVC.fullQty + " binh) -> Van Chup Xin");
  }

  // Ket qua cuoi
  var final = await p.cylinderType.findMany({ orderBy: { name: "asc" } });
  console.log("Final cylinder types:");
  final.forEach(function(t) { console.log(" -", t.name, ":", t.fullQty, "binh"); });
  await p.$disconnect();
}
main().catch(function(e) { console.error(e.message); });