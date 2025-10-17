// ===============================
// ☕ Coffee Shop Backend - Entry Point
// ===============================
import dotenv from "dotenv";
dotenv.config();

import app, { startServer } from "./app.js";

// ✅ Chạy server (tách riêng khỏi app.js để test dễ hơn)
startServer();

// Có thể export app để dùng cho test
export default app;
