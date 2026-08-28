const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
async function main() {
  // Lay danh sach gas products
  const gasProds = await p.product.findMany({ where: { type: "gas" }, select: { name: true } });
  const existingTypes = await p.cylinderType.findMany();
  const existingNames = existingTypes.map(function(t) { return t.name; });
  
  console.log("Gas products:", gasProds.map(function(g) { return g.name; }));
  console.log("Existing cylinder types:", existingNames);
  
  // Them cac loai binh chua co
  for (var i = 0; i < gasProds.length; i++) {
    var name = gasProds[i].name;
    if (!existingNames.includes(name)) {
      await p.cylinderType.create({ data: { name: name, fullQty: 0 } });
      console.log("ADDED:", name);
    } else {
      console.log("EXISTS:", name);
    }
  }
  
  // Giu lai cac loai binh khong co trong gas products (vi co the co du lieu cu)
  // Khong xoa de khong mat du lieu
  
  console.log("Done!");
  await p.$disconnect();
}
main().catch(function(e) { console.error(e.message); });