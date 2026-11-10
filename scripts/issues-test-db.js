require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");
async function main() {
  const source = new URL(process.env.DATABASE_URL);
  const database = "digimandal_issues_test_v2";
  const admin = new PrismaClient();
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await admin.$disconnect();
  }
  source.pathname = "/" + database;
  const env = {
    ...process.env,
    DATABASE_URL: source.toString(),
    ISSUE_TEST_DATABASE: database,
    TEMP: require("node:path").resolve("tmp"),
    TMP: require("node:path").resolve("tmp"),
  };
  const target = new PrismaClient({
    datasources: { db: { url: source.toString() } },
  });
  try {
    const tables = await target.$queryRaw`SHOW TABLES LIKE 'User'`;
    if (!tables.length) {
      const sql = require("node:fs").readFileSync(
        "tests/issues/baseline.sql",
        "utf8",
      );
      for (const statement of sql.split(";").filter((s) => s.trim()))
        await target.$executeRawUnsafe(statement);
      const historical = require("node:fs")
        .readdirSync("prisma/migrations")
        .filter((n) => /^\d/.test(n) && n < "20261110120000_mandal_issues");
      for (const migration of historical) {
        const result = spawnSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "resolve",
            "--applied",
            migration,
          ],
          { env, stdio: "pipe" },
        );
        if (result.status !== 0)
          throw new Error(
            "Unable to baseline historical migration " + migration,
          );
      }
    }
  } finally {
    await target.$disconnect();
  }
  for (const args of [
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    ["--test", "tests/issues/integration.test.js"],
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      return;
    }
  }
}
main().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
