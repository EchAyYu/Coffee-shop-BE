import express from "express";
import { body, param } from "express-validator";
import {
  createReservation,
  getMyReservations,
  getAllReservations,
  getReservationById,
  updateReservationStatus,
  deleteReservation,
} from "../controllers/reservations.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";

const router = express.Router();

// ==========================
// CLIENT ROUTES (Khách hàng)
// ==========================
router.post(
  "/",
  requireAuth,
  authorizeRoles("customer"),
  [
    body("ngay_dat").notEmpty().withMessage("Thiếu ngày đặt bàn"),
    body("gio_dat").notEmpty().withMessage("Thiếu giờ đặt bàn"),
    body("so_nguoi").isInt({ min: 1 }).withMessage("Số lượng người phải hợp lệ"),
  ],
  validate,
  asyncHandler(createReservation)
);

router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  asyncHandler(getMyReservations)
);

// ==========================
// ADMIN & EMPLOYEE ROUTES
// ==========================

// 1. Lấy danh sách (Admin + Employee)
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  asyncHandler(getAllReservations)
);

// 2. Xem chi tiết (Admin + Employee)
router.get(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  [param("id").isInt({min: 1}).toInt()],
  validate,
  asyncHandler(getReservationById)
);

// 3. Cập nhật trạng thái (Admin + Employee - để nhân viên "tiếp nhận")
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  [
    param("id").isInt({min: 1}).toInt(),
    body("status")
      .isIn(["CONFIRMED", "CANCELLED", "DONE"]) // Các trạng thái hợp lệ
      .withMessage("Trạng thái không hợp lệ"),
  ],
  validate,
  asyncHandler(updateReservationStatus)
);

// 4. Xóa đặt bàn (Chỉ Admin nên được xóa? Hoặc cả nhân viên tùy bạn)
// Ở đây tôi để cả Employee để họ quản lý toàn diện
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"), // 💡 THÊM "employee"
  [param("id").isInt({min: 1}).toInt()],
  validate,
  asyncHandler(deleteReservation)
);

export default router;