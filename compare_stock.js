const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
async function main() {
  const gasProds = await p.product.findMany({ where: { type: "gas" }, select: { name: true, stock: true }, orderBy: { name: "asc" } });
  const cylTypes = await p.cylinderType.findMany({ orderBy: { name: "asc" } });
  console.log("\nSo sanh Product.stock vs CylinderType.fullQty:");
  console.log("Ten san pham".padEnd(25) + "| stock | fullQty | Lech");
  console.log("-".repeat(55));
  gasProds.forEach(function(g) {
    var ct = cylTypes.find(function(c) { return c.name === g.name; });
    var diff = ct ? g.stock - ct.fullQty : "N/A";
    var warn = diff !== "N/A" && diff !== 0 ? " <<<" : "";
    console.log(g.name.padEnd(25) + "| " + String(g.stock).padEnd(6) + "| " + String(ct ? ct.fullQty : "?").padEnd(8) + "| " + diff + warn);
  });
  await p.$disconnect();
}
main().catch(function(e) { console.error(e.message); });