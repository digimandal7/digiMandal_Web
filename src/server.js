require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const prisma = require("./config/prisma");
const authRoutes = require("./routes/auth.routes");
const mandalRoutes = require("./routes/mandal.routes");
const invitationRoutes = require("./routes/invitation.routes");
const memberRoutes = require("./routes/member.routes");
const documentRoutes = require("./routes/document.routes");
const interestRoutes = require("./routes/interest.routes");
const locationRoutes = require("./routes/location.routes");
const catalogRoutes = require("./routes/catalog.routes");
const roleRoutes = require("./routes/role.routes");
const rateLimit = require("express-rate-limit");
const { errorHandler } = require("./middlewares/error.middleware");
const { startBankSyncScheduler } = require("./services/bank-sync.service");

const app = express();
const homeTelemetry = require("./home/telemetry");
homeTelemetry.instrument(prisma);
require("./home/core").config();
app.use(require("compression")());

app.use(cors());
const jsonParser = express.json({ limit: "64kb" });
app.use((req,res,next) => req.path.startsWith("/api/v1") ? next() : jsonParser(req,res,next));
app.use(morgan("dev", { skip: req => req.originalUrl.startsWith("/api/v1") }));

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Shared across send/resend/verify — keep generous for local testing.
  limit: process.env.NODE_ENV === "production" ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many OTP requests. Please try again later.",
  },
});
app.use("/api/auth/send-otp", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/mandal", mandalRoutes);
app.use("/api/invitation", invitationRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/interests", interestRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/v1", require("./home/routes"));
app.get("/health/live", (req,res) => res.json({ status:"ok" }));
app.get("/health/ready", async (req,res) => {
  let timer;
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error("timeout")),1000); })]);
    res.json({ status:"ready" });
  } catch { res.status(503).json({ status:"unavailable" }); }
  finally { clearTimeout(timer); }
});

app.use(errorHandler);

/* -------------------- DB CONNECTION CHECK -------------------- */
async function connectDatabase() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ MySQL Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
}

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 3000;

let server;
if (require.main === module) connectDatabase().then(() => {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startBankSyncScheduler();
  });
});

/* -------------------- GRACEFUL SHUTDOWN -------------------- */
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing server...`);
  if (server) await new Promise(resolve => {
    const timer=setTimeout(()=>{ server.closeAllConnections(); resolve(); },10000);
    server.close(()=>{ clearTimeout(timer); resolve(); });
  });
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
module.exports = app;
