import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
dotenv.config();

import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import reservationsRouter from "./routes/reservations.js";
import authRouter from "./routes/auth.js";
import customersRouter from "./routes/customers.js";
import employeesRouter from "./routes/employees.js";
import promotionsRouter from "./routes/promotions.js";
import reviewsRouter from "./routes/reviews.js";
import categoriesRouter from "./routes/categories.js";
import adminRouter from "./routes/admin.js";

import sequelize from "./utils/db.js";
import { requireAuth, requireAdmin } from "./middlewares/authMiddleware.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api/", limiter);

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/customers", customersRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/promotions", promotionsRouter);
app.use("/api/reviews", reviewsRouter);

// BẢO VỆ ADMIN
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
sequelize.authenticate()
  .then(() => {
    console.log("✅ Connected to MySQL");
    app.listen(PORT, () => console.log("☕ Backend on http://localhost:" + PORT));
  })
  .catch(err => console.error("❌ DB connect error:", err));
