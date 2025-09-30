import { Router } from "express";
import { createOrder, getOrders, getOrderById, updateOrderStatus } from "../controllers/orders.controller.js";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// 🟢 API Đơn hàng
r.post("/", createOrder); // khách đặt hàng
r.get("/", authMiddleware, authorizeRoles("admin", "employee"), getOrders);
r.get("/:id", authMiddleware, authorizeRoles("admin", "employee"), getOrderById);
r.put("/:id", authMiddleware, authorizeRoles("admin", "employee"), updateOrderStatus);

export default r;
