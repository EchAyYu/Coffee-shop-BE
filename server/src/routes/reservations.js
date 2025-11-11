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

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: API quản lý đặt bàn
 */

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Tạo đặt bàn (customer)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2025-10-10"
 *               time:
 *                 type: string
 *                 example: "18:30"
 *               numberOfPeople:
 *                 type: integer
 *                 example: 4
 */
// BE - reservations.routes.js

router.post(
  "/",
  requireAuth,
  authorizeRoles("customer"),
  [
    // SỬA Ở ĐÂY: 'date' -> 'ngay_dat'
    body("ngay_dat").notEmpty().withMessage("Thiếu ngày đặt bàn"),
    
    // SỬA Ở ĐÂY: 'time' -> 'gio_dat'
    body("gio_dat").notEmpty().withMessage("Thiếu giờ đặt bàn"),
    
    // SỬA Ở ĐÂY: 'numberOfPeople' -> 'so_nguoi'
    body("so_nguoi")
      .isInt({ min: 1 })
      .withMessage("Số lượng người phải hợp lệ"),
  ],
  asyncHandler(createReservation)
);
/**
 * @swagger
 * /api/reservations/my:
 *   get:
 *     summary: Xem danh sách đặt bàn của chính mình
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  asyncHandler(getMyReservations)
);

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Xem tất cả đặt bàn (admin)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  asyncHandler(getAllReservations)
);

/**
 * @swagger
 * /api/reservations/{id}:
 *   put:
 *     summary: Cập nhật trạng thái đặt bàn (admin)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CONFIRMED, CANCELLED, DONE]
 *                 example: CONFIRMED
 */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("status")
      .isIn(["CONFIRMED", "CANCELLED", "DONE"])
      .withMessage("Trạng thái không hợp lệ"),
  ],
  asyncHandler(updateReservationStatus)
);

/**
 * @swagger
 * /api/reservations/{id}:
 *   delete:
 *     summary: Xóa đặt bàn (admin)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  asyncHandler(deleteReservation)
);

// 💡💡💡 THÊM ROUTE MỚI 💡💡💡
/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Xem chi tiết đặt bàn (admin)
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  asyncHandler(getReservationById)
);

export default router;
