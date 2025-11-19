import express from "express";
import { body, param } from "express-validator";
import {
  createReservation,
  getMyReservations,
  getAllReservations,
  getReservationById,
  updateReservationStatus,
  deleteReservation,
  getBusySlots
} from "../controllers/reservations.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";


const router = express.Router();

// ==========================
// 💡 PUBLIC / COMMON ROUTES (Ai cũng truy cập được)
// ==========================

// 1. Lấy khung giờ đã đặt (Để khách xem lịch tránh trùng)
// Đặt lên đầu để tránh xung đột với các route có param :id
router.get(
  "/busy-slots",
  requireAuth, // Cần đăng nhập (bất kể role nào: customer/admin/employee đều được)
  asyncHandler(getBusySlots)
);


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

// 2. Lấy danh sách (Admin + Employee)
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(getAllReservations)
);

// 3. Xem chi tiết (Admin + Employee)
router.get(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt({min: 1}).toInt()],
  validate,
  asyncHandler(getReservationById)
);

// 4. Cập nhật trạng thái (Admin + Employee)
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [
    param("id").isInt({min: 1}).toInt(),
    // Validation tùy chọn nếu cần
  ],
  validate,
  asyncHandler(updateReservationStatus)
);

// 5. Xóa đặt bàn (Admin + Employee)
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt({min: 1}).toInt()],
  validate,
  asyncHandler(deleteReservation)
);

export default router;