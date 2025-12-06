// src/routes/orders.js
import express from "express";
import { body, param } from "express-validator";
import {
  requireAuth,
  authorizeRoles,
  loadUserIfAuthenticated,
} from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  createOrder,
  getOrdersAdmin,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getMyOrders,
  exportAdminOrdersCsv, // Export CSV
  getAdminOrderStats,   // Thống kê (nếu dùng /stats)
} from "../controllers/orders.controller.js";

const router = express.Router();

/* ============================
 * 👤 CLIENT ROUTES
 * ============================ */

// Tạo đơn hàng (khách, có thể chưa login, nhưng có load user nếu có token)
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

// Lịch sử đơn hàng của tôi
router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  asyncHandler(getMyOrders)
);

// Xem chi tiết đơn (customer chỉ xem được đơn của mình, admin/employee xem tất cả)
router.get(
  "/:id(\\d+)",
  requireAuth,
  asyncHandler(getOrderById)
);

/* ============================
 * 🛠 ADMIN & EMPLOYEE ROUTES
 * Các route này sẽ được bảo vệ bằng:
 *  - requireAuth + authorizeRoles ngay tại đây
 *  - Và/hoặc khi mount ở /api/admin/orders
 * ============================ */

// 1. Lấy danh sách đơn hàng (Admin & Employee)
router.get(
  "/list",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(getOrdersAdmin)
);

// 2. Cập nhật trạng thái đơn hàng
router.put(
  "/:id(\\d+)/status",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [
    param("id").isInt({ min: 1 }).toInt(),
    body("trang_thai").isIn([
      "pending",
      "pending_payment",
      "confirmed",
      "completed",
      "cancelled",
      "done",
      "paid",
      "shipped",
    ]),
  ],
  validate,
  asyncHandler(updateOrderStatus)
);

// 3. Xóa đơn hàng
router.delete(
  "/:id(\\d+)",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(deleteOrder)
);

// 4. Export đơn hàng ra CSV (tuần / tháng)
// FE gọi: GET /api/admin/orders/export?period=week|month
router.get(
  "/export",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(exportAdminOrdersCsv)
);

// 5. (tuỳ chọn) Thống kê theo route /api/admin/orders/stats
router.get(
  "/stats",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(getAdminOrderStats)
);

// 6. Route đặc biệt cho admin lấy danh sách (nếu FE gọi /api/admin/orders)
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(getOrdersAdmin)
);

export default router;
