import express from "express";
import cors from "cors";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import reservationsRouter from "./routes/reservations.js";
import sequelize from "./utils/db.js";
import authRouter from "./routes/auth.js";
import customersRouter from "./routes/customers.js";
import employeesRouter from "./routes/employees.js";
import promotionsRouter from "./routes/promotions.js";
import reviewsRouter from "./routes/reviews.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/promotions", promotionsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reservations", reservationsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

sequelize.authenticate()
  .then(() => {
    console.log("✅ Connected to MySQL");
    app.listen(PORT, () => console.log("☕ Backend running on http://localhost:" + PORT));
  })
  .catch(err => console.error("❌ Unable to connect:", err));
