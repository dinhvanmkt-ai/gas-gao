const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
async function main() {
  const gasProds = await p.product.findMany({ where: { type: "gas" }, select: { name: true, stock: true } });
  const cylTypes = await p.cylinderType.findMany({ select: { name: true, fullQty: true } });
  console.log("GAS PRODUCTS:", JSON.stringify(gasProds));
  console.log("CYLINDER TYPES:", JSON.stringify(cylTypes));
  await p.$disconnect();
}
main().catch(function(e) { console.error(e.message); });