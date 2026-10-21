const prisma = require("../config/prisma");

const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/razorpay/ifsc/master/src/banknames.json";
const SOURCE = "RAZORPAY_IFSC";
const BATCH_SIZE = 50;

async function fetchBanks() {
  const sourceUrl = process.env.BANK_SYNC_SOURCE_URL || DEFAULT_SOURCE_URL;
  const response = await fetch(sourceUrl, {
    headers: { Accept: "application/json", "User-Agent": "DigiMandal/1.0" },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Bank dataset returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new Error("Bank dataset has an invalid format");
  }

  const banks = Object.entries(data)
    .map(([code, label]) => ({
      code: String(code).trim().toUpperCase(),
      label: String(label).trim(),
    }))
    .filter(({ code, label }) => /^[A-Z0-9]{4,11}$/.test(code) && label);

  if (banks.length < 50) {
    throw new Error("Bank dataset contains too few valid records");
  }

  return { banks, sourceUrl };
}

async function syncBanks() {
  const startedAt = new Date();
  const { banks, sourceUrl } = await fetchBanks();
  const sourceCodes = new Set(banks.map((bank) => bank.code));
  let created = 0;
  let updated = 0;

  const existing = await prisma.masterOption.findMany({
    where: { type: "BANK" },
    select: { code: true, metadata: true, isOther: true },
  });
  const existingCodes = new Set(existing.map((bank) => bank.code));

  for (let index = 0; index < banks.length; index += BATCH_SIZE) {
    const batch = banks.slice(index, index + BATCH_SIZE);
    await Promise.all(
      batch.map((bank) =>
        prisma.masterOption.upsert({
          where: { type_code: { type: "BANK", code: bank.code } },
          create: {
            type: "BANK",
            code: bank.code,
            label: bank.label,
            metadata: { source: SOURCE },
            sortOrder: 0,
          },
          update: {
            label: bank.label,
            metadata: { source: SOURCE },
            isActive: true,
            isOther: false,
            sortOrder: 0,
          },
        })
      )
    );
    for (const bank of batch) {
      if (existingCodes.has(bank.code)) updated += 1;
      else created += 1;
    }
  }

  const staleCodes = existing
    .filter(
      (bank) =>
        !bank.isOther &&
        bank.metadata?.source === SOURCE &&
        !sourceCodes.has(bank.code)
    )
    .map((bank) => bank.code);

  if (staleCodes.length) {
    await prisma.masterOption.updateMany({
      where: { type: "BANK", code: { in: staleCodes } },
      data: { isActive: false },
    });
  }

  await prisma.masterOption.upsert({
    where: { type_code: { type: "BANK", code: "OTHER" } },
    create: {
      type: "BANK",
      code: "OTHER",
      label: "Other",
      isOther: true,
      sortOrder: 999999,
    },
    update: { label: "Other", isOther: true, isActive: true, sortOrder: 999999 },
  });

  return {
    source: SOURCE,
    sourceUrl,
    total: banks.length,
    created,
    updated,
    disabled: staleCodes.length,
    startedAt,
    completedAt: new Date(),
  };
}

let syncInProgress = null;

function runBankSync() {
  if (!syncInProgress) {
    syncInProgress = syncBanks().finally(() => {
      syncInProgress = null;
    });
  }
  return syncInProgress;
}

function startBankSyncScheduler() {
  if (String(process.env.BANK_SYNC_ENABLED || "true").toLowerCase() === "false") {
    console.log("Bank synchronization is disabled");
    return;
  }

  const hours = Math.max(Number(process.env.BANK_SYNC_INTERVAL_HOURS) || 24, 1);
  const interval = setInterval(() => {
    runBankSync()
      .then((result) => console.log(`Bank sync completed: ${result.total} banks`))
      .catch((error) => console.error("Bank sync failed:", error.message));
  }, hours * 60 * 60 * 1000);
  interval.unref();

  runBankSync()
    .then((result) => console.log(`Bank sync completed: ${result.total} banks`))
    .catch((error) => console.error("Bank sync failed:", error.message));
}

module.exports = { runBankSync, startBankSyncScheduler };
