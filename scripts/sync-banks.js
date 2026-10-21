require("dotenv").config();
const prisma = require("../src/config/prisma");
const { runBankSync } = require("../src/services/bank-sync.service");

async function main() {
  const result = await runBankSync();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Bank synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
