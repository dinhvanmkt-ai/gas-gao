const { PrismaClient } = require("./node_modules/@prisma/client");
const p = new PrismaClient();
p.cylinder.groupBy({ by: ["type"], where: { status: "at_store_full" }, _count: { _all: true } })
  .then(function(full) {
    return p.cylinder.count({ where: { status: "at_store_empty" } })
      .then(function(empty) {
        console.log("FULL:" + JSON.stringify(full));
        console.log("EMPTY:" + empty);
        return p.$disconnect();
      });
  })
  .catch(function(e) { console.error(e.message); });