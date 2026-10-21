require("dotenv").config();
const prisma = require("../src/config/prisma");

async function main() {
  const mobile = process.argv[2];
  if (!/^\d{10}$/.test(mobile || "")) throw new Error("Usage: npm run superadmin:grant -- 9876543210");
  const user = await prisma.user.update({ where: { mobile }, data: { platformRole: "SUPER_ADMIN" }, select: { id: true, mobile: true, platformRole: true } });
  console.log(`Granted ${user.platformRole} to ${user.mobile}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
