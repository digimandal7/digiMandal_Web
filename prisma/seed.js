const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const INTERESTS = [
  "Festivals",
  "Sports",
  "Music",
  "Volunteering",
  "Civic Issues",
  "Health & Fitness",
  "Education",
  "Local Alerts",
  "Arts",
  "Entrepreneurship",
  "Social Welfare",
  "Culture & Traditions",
  "Travel",
  "Events",
  "Personal Development",
  "Animal Welfare",
  "Environment",
  "Food",
];

async function main() {
  for (const name of INTERESTS) {
    await prisma.interest.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const count = await prisma.interest.count();
  console.log(`✅ Seeded interests. Total in DB: ${count}`);
}

main()
  .catch((error) => {
    console.error("❌ Interest seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
