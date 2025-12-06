import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 🌟 1. IMPORT HTTP VÀ SOCKET 🌟
import http from "http";
import { initSocket } from "./socket.js";

// --- Config & Utils ---
import { config } from "./config/config.js";
import sequelize from "./utils/db.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { swaggerDocs } from "./config/swagger.js";

// --- Middleware bảo vệ ---
import {
  requireAuth,
  requireAdmin,
  authorizeRoles,
} from "./middlewares/authMiddleware.js";
import { globalLimiter } from "./middlewares/rateLimit.js";

// --- Routers (bắt buộc phải có) ---
import authRouter from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import reservationsRouter from "./routes/reservations.js";
import categoriesRouter from "./routes/categories.js";
import customersRouter from "./routes/customers.js";
import employeesRouter from "./routes/employees.js";
import reviewsRouter from "./routes/reviews.js";
import adminRouter from "./routes/admin.js";
import statsRouter from "./routes/stats.js";
import tablesRouter from "./routes/tables.js";
import homeContentRoutes from "./routes/homeContentRoutes.js";
import customerProfileRoutes from "./routes/customerProfileRoutes.js";
import profileRoutes from "./routes/profile.js";
import Review from "./models/Reviews.js";
import adminReviewsRouter from "./routes/admin.reviews.js";
import chatbotRouter from "./routes/chatbot.js";
import promotionsRoutes from "./routes/promotions.js";

import { initCleanupJobs } from "./job/cleanupOldData.js";
import uploadRouter from "./routes/uploads.js";

// --- Khởi tạo Express ---
const app = express();
app.set("trust proxy", 1);

// ===============================
// 🧩 GLOBAL MIDDLEWARES
// ===============================
app.use(helmet({ crossOriginResourcePolicy: false }));
if (config.env === "development") {
  app.use(morgan("dev"));
}

// ===============================
// 🌐 CORS + COOKIE CONFIG
// ===============================
const ALLOW_ORIGINS = [
  config.corsOrigin,
  config.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return callback(null, true);
      console.warn("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ===============================
// 📦 BODY PARSERS & COOKIES
// ===============================
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// 🚦 RATE LIMIT
// ===============================
app.use("/api/", globalLimiter);

// ===============================
// 🚀 ROUTES BẮT BUỘC
// ===============================
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/tables", tablesRouter);
app.use("/api/home-content", homeContentRoutes);
app.use("/api/customer-profile", customerProfileRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/orders", ordersRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/employees", employeesRouter);

// Admin Orders (cho admin + employee)
app.use("/api/admin/orders", requireAuth, authorizeRoles("admin", "employee"), ordersRouter);

// Admin Reviews
app.use(
  "/api/admin/reviews",
  requireAuth,
  authorizeRoles("admin", "employee"),
  adminReviewsRouter
);

// Admin main router (đã bao gồm: customers, products, categories, employees,
// orders-stats, orders/export, reservations, reservations/stats, reservations/export, vouchers, stats, promotions...)
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

app.use("/api/chatbot", chatbotRouter);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/uploads", uploadRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===============================
// 📦 ROUTES TÙY CHỌN (IMPORT ĐỘNG)
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mountIfExists(urlPrefix, relModulePath, middlewares = []) {
  const absPath = path.resolve(__dirname, relModulePath.replace("./", ""));
  if (!fs.existsSync(absPath)) {
    console.warn(`ℹ️  Route file not found, skip mounting: ${relModulePath}`);
    return;
  }
  try {
    const mod = await import(relModulePath);
    const router = mod.default;
    if (!router) {
      console.warn(
        `ℹ️  Route "${relModulePath}" không export default, bỏ qua.`
      );
      return;
    }
    if (middlewares.length) {
      app.use(urlPrefix, ...middlewares, router);
    } else {
      app.use(urlPrefix, router);
    }
    console.log(`✅ Mounted route ${urlPrefix} from ${relModulePath}`);
  } catch (e) {
    console.error(
      `❌ Lỗi import route ${relModulePath}:`,
      e?.message || e
    );
  }
}

await mountIfExists("/api/loyalty", "./routes/loyalty.js");
await mountIfExists("/api/vouchers", "./routes/vouchers.js", [
  requireAuth,
  authorizeRoles("customer"),
]);
await mountIfExists(
  "/api/voucher-redemptions",
  "./routes/voucherRedemptions.js",
  [requireAuth, authorizeRoles("customer")]
);
await mountIfExists("/api/notifications", "./routes/notifications.js", [
  requireAuth,
]);

// ===============================
// 📜 Swagger API docs
// ===============================
swaggerDocs(app);

// ===============================
// 🧱 ERROR HANDLERS
// ===============================
app.use(notFound);
app.use(errorHandler);

// ===============================
// 🔌 START SERVER FUNCTION
// ===============================
export const startServer = async () => {
  const PORT = config.port || 4000;

  try {
    await sequelize.authenticate();
    console.log("✅ Connected to MySQL successfully!");

    await sequelize.sync({ alter: true });
    console.log("✅ Database synced (alter: true)");

    const httpServer = http.createServer(app);
    initSocket(httpServer, ALLOW_ORIGINS);

    httpServer.listen(PORT, () => {
      console.log(`☕ Server is running on http://localhost:${PORT}`);
      console.log(`🔌 Socket.io initialized.`);
      console.log(`🌐 Allowed Origins: ${ALLOW_ORIGINS.join(", ")}`);
    });
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
};

initCleanupJobs();
export default app;

startServer();
