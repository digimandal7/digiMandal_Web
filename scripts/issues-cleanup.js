require("dotenv").config();
const { cleanup } = require("../src/issues/storage");
const { prisma } = require("../src/issues/repository");
cleanup()
  .then(console.log)
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
