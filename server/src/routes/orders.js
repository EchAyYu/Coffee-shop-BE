import express from "express";
import { body, param, query } from "express-validator";
import { requireAuth, authorizeRoles, loadUserIfAuthenticated } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  createOrder,
  getOrdersAdmin,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getMyOrders,
} from "../controllers/orders.controller.js";

const router = express.Router();

// --- CLIENT ROUTES ---
router.post(
  "/",
  asyncHandler(loadUserIfAuthenticated),
  [
    body("ho_ten_nhan").notEmpty(),
    body("sdt_nhan").notEmpty(),
    body("dia_chi_nhan").notEmpty(),
    body("pttt").isIn(["COD", "BANK_TRANSFER"]),
    body("items").isArray({ min: 1 }),
  ],
  validate,
  asyncHandler(createOrder)
);

router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  asyncHandler(getMyOrders)
);

router.get(
  "/:id(\\d+)", 
  requireAuth, 
  // Cho phép customer xem đơn của mình, admin/employee xem mọi đơn
  // Logic này thường nằm trong controller getOrderById
  asyncHandler(getOrderById)
);

// --- ADMIN & EMPLOYEE ROUTES ---

// 1. Lấy danh sách đơn hàng
router.get(
  "/list", // Hoặc "/" tùy vào cách bạn mount route trong server.js (thường là /api/admin/orders hoặc /api/orders/list)
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  asyncHandler(getOrdersAdmin)
);

// 2. Cập nhật trạng thái đơn hàng
router.put(
  "/:id(\\d+)/status", 
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  [
    param("id").isInt({ min: 1 }).toInt(),
    body("trang_thai").isIn(["pending", "pending_payment", "confirmed", "completed", "cancelled", "done", "paid", "shipped"]),
  ],
  validate,
  asyncHandler(updateOrderStatus) 
);

// 3. Xóa đơn hàng
router.delete(
  "/:id(\\d+)",
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(deleteOrder)
);

// Route đặc biệt cho admin lấy danh sách (nếu bạn dùng route riêng này)
router.get(
  "/", // Nếu adminApi gọi /api/admin/orders trỏ vào đây
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  asyncHandler(getOrdersAdmin)
);

export default router;