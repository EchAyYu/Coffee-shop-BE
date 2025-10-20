// ===============================
// ☕ Coffee Shop Backend - Tables Routes
// ===============================
import express from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
  updateTableStatus,
} from "../controllers/tables.controller.js";

const router = express.Router();

// Lấy danh sách bàn
router.get("/", asyncHandler(getAllTables));

/**
 * @swagger
 * tags:
 *   name: Tables
 *   description: API quản lý bàn
 */

/**
 * @swagger
 * /api/tables:
 *   get:
 *     summary: Lấy danh sách bàn (public)
 *     tags: [Tables]
 *     parameters:
 *       - in: query
 *         name: khu_vuc
 *         schema:
 *           type: string
 *         description: Lọc theo khu vực (main, vip, outdoor, rooftop)
 *       - in: query
 *         name: trang_thai
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái (available, occupied, reserved, maintenance)
 *       - in: query
 *         name: suc_chua_min
 *         schema:
 *           type: integer
 *         description: Số người tối thiểu
 */
router.get("/", asyncHandler(getAllTables));

/**
 * @swagger
 * /api/tables/{id}:
 *   get:
 *     summary: Lấy chi tiết 1 bàn
 *     tags: [Tables]
 */
router.get(
  "/:id",
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(getTableById)
);

/**
 * @swagger
 * /api/tables:
 *   post:
 *     summary: Tạo bàn mới (admin)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  [
    body("so_ban").notEmpty().withMessage("Thiếu số bàn"),
    body("khu_vuc").optional().isString(),
    body("suc_chua").optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(createTable)
);

/**
 * @swagger
 * /api/tables/{id}:
 *   put:
 *     summary: Cập nhật bàn (admin)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(updateTable)
);

/**
 * @swagger
 * /api/tables/{id}:
 *   delete:
 *     summary: Xóa bàn (admin)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(deleteTable)
);

/**
 * @swagger
 * /api/tables/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái bàn (admin/employee)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/status",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [
    param("id").isInt().toInt(),
    body("trang_thai")
      .isIn(["available", "occupied", "reserved", "maintenance"])
      .withMessage("Trạng thái không hợp lệ"),
  ],
  validate,
  asyncHandler(updateTableStatus)
);

export default router;