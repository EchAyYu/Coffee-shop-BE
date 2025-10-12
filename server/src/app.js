// ===============================
// ☕ Coffee Shop Backend - App.js
// ===============================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
dotenv.config();

// --- Config & Utils ---
import { config } from "./config/config.js";
import sequelize from "./utils/db.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { swaggerDocs } from "./config/swagger.js";

// --- Middleware bảo vệ ---
import { requireAuth, requireAdmin } from "./middlewares/authMiddleware.js";
import { globalLimiter } from "./middlewares/rateLimit.js";

// --- Routers ---
import authRouter from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import reservationsRouter from "./routes/reservations.js";
import categoriesRouter from "./routes/categories.js";
import customersRouter from "./routes/customers.js";
import employeesRouter from "./routes/employees.js";
import promotionsRouter from "./routes/promotions.js";
import reviewsRouter from "./routes/reviews.js";
import adminRouter from "./routes/admin.js";
import statsRouter from "./routes/stats.js";

// --- Khởi tạo Express ---
const app = express();

// Cho reverse proxy (Nginx/Render/Heroku) hiểu IP thật của client
app.set("trust proxy", 1);

// ===============================
// 🧩 GLOBAL MIDDLEWARES
// ===============================

// Bảo mật header
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Cho phép ảnh (Cloudinary,...)
  })
);

// Logger khi dev
if (config.env === "development") {
  app.use(morgan("dev"));
}

// CORS cho frontend (đa nguồn) + credentials (cookie refresh)
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
      if (!origin) return callback(null, true); // Postman, Swagger (no origin)
      if (ALLOW_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser (để đọc refresh_token httpOnly)
app.use(cookieParser());

// Rate limit toàn cục cho /api
app.use("/api/", globalLimiter);

// ===============================
// 🚀 ROUTES
// ===============================

// Auth
app.use("/api/auth", authRouter);

// Public routes
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/stats", statsRouter);

// Private user routes
app.use("/api/orders", ordersRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/customers", customersRouter);

// Employee / Admin routes
app.use("/api/employees", employeesRouter);
app.use("/api/promotions", promotionsRouter);

// Dashboard quản trị (yêu cầu JWT + ADMIN)
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Swagger API docs (vd: http://localhost:4000/api-docs)
swaggerDocs(app);

// ===============================
// 🧱 ERROR HANDLERS
// ===============================
app.use(notFound);
app.use(errorHandler);

// ===============================
// 🔌 DATABASE & SERVER
// ===============================
const PORT = config.port || 4000;

sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Connected to MySQL successfully!");
    app.listen(PORT, () => {
      console.log(`☕ Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
  });

export default app;
