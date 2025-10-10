// ===============================
// ☕ Coffee Shop Backend - App.js
// ===============================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import dotenv from "dotenv";
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

// ===============================
// 🧩 GLOBAL MIDDLEWARES
// ===============================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Cho phép ảnh từ Cloudinary
}));

// Logger (chỉ hiện log khi dev)
if (config.env === "development") {
  app.use(morgan("dev"));
}

// CORS cho frontend (5173 hoặc 3000)
app.use(cors({
  origin: config.corsOrigin || config.clientUrl,
  credentials: true,
}));

// Giới hạn JSON body
app.use(express.json({ limit: "1mb" }));

app.use("/api/", globalLimiter);

// ===============================
// 🚀 ROUTES
// ===============================

// Tài khoản & xác thực
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

// Dashboard quản trị (bảo vệ bằng JWT)
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Swagger API docs (http://localhost:4000/api-docs)
swaggerDocs(app);

// ===============================
// 🧱 ERROR HANDLERS
// ===============================
app.use(notFound);
app.use(errorHandler);  


// ===============================
// 🔌 DATABASE CONNECTION
// ===============================
const PORT = config.port || 4000;

sequelize.authenticate()
  .then(() => {
    console.log("✅ Connected to MySQL successfully!");
    app.listen(PORT, () => {
      console.log(`☕ Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
  });

  app.use(cors({
  origin: "http://localhost:5173", // FE chạy ở port 5173 (Vite)
  credentials: true,
}));