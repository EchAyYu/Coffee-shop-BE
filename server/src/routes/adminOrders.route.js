// src/routes/adminOrders.route.js
import express from "express";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { getOrdersAdmin, updateOrderStatus, deleteOrder, getOrderById } from "../controllers/orders.controller.js";

const router = express.Router();

// Chỉ cho phép admin hoặc nhân viên
router.use(requireAuth, authorizeRoles("admin", "employee"));

// GET tất cả đơn hàng
router.get("/", getOrdersAdmin);

// GET 1 đơn hàng chi tiết
router.get("/:id", getOrderById);

// PUT cập nhật trạng thái
router.put("/:id/status", updateOrderStatus);

// DELETE xoá đơn
router.delete("/:id", deleteOrder);

export default router;
