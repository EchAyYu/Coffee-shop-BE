// src/routes/reviews.js

import express from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  createReview,
  getProductReviews,
  getReviewStatusForOrder,
} from "../controllers/reviews.controller.js"; 

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Reviews
 *     description: API quản lý đánh giá món ăn
 */

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Tạo một đánh giá mới
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_mon:
 *                 type: integer
 *               id_don:
 *                 type: integer
 *               diem:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               noi_dung:
 *                 type: string
 *                 maxLength: 250
 *             required: [id_mon, id_don, diem]
 *     responses:
 *       '201':
 *         description: Đánh giá thành công
 *       '400':
 *         description: Đơn hàng chưa hoàn thành
 *       '403':
 *         description: Không thể đánh giá món chưa mua
 *       '409':
 *         description: Đã đánh giá món này rồi
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("customer"),
  [
    body("id_mon").isInt({ min: 1 }).withMessage("ID món ăn là bắt buộc"),
    body("id_don").isInt({ min: 1 }).withMessage("ID đơn hàng là bắt buộc"),
    body("diem").isInt({ min: 1, max: 5 }).withMessage("Điểm phải từ 1 đến 5"),
    body("noi_dung").optional().isString().trim().isLength({ max: 250 }).withMessage("Nội dung quá dài (tối đa 250 ký tự)"),
  ],
  validate,
  asyncHandler(createReview)
);

/**
 * @swagger
 * /api/reviews/product/{id_mon}:
 *   get:
 *     summary: Lấy tất cả đánh giá của 1 món ăn
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id_mon
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Danh sách đánh giá
 */
router.get(
  "/product/:id_mon",
  [param("id_mon").isInt({ min: 1 }).withMessage("ID món ăn không hợp lệ")],
  validate,
  asyncHandler(getProductReviews)
);

/**
 * @swagger
 * /api/reviews/order-status/{id_don}:
 *   get:
 *     summary: (User) Kiểm tra các món đã đánh giá trong 1 đơn hàng
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_don
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: 'Object map { "id_mon": true/false }'  # ✅ Bọc trong nháy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: boolean
 *               example:
 *                 success: true
 *                 data:
 *                   "16": true
 *                   "18": false
 */
router.get(
  "/order-status/:id_don",
  requireAuth,
  authorizeRoles("customer"),
  [param("id_don").isInt({ min: 1 }).withMessage("ID đơn hàng không hợp lệ")],
  validate,
  asyncHandler(getReviewStatusForOrder)
);

export default router;
