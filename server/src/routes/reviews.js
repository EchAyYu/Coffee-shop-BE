// src/routes/reviews.routes.js
import express from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createReview,
  getReviewsByProduct,
  getAllReviews,
} from "../controllers/reviews.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: API quản lý đánh giá sản phẩm
 */

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Gửi đánh giá sản phẩm (customer)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("customer"),
  [
    body("id_mon").isInt().withMessage("id_mon phải là số"),
    body("diem").isInt({ min: 1, max: 5 }).withMessage("Điểm từ 1 đến 5"),
    body("noi_dung").optional().isString(),
  ],
  asyncHandler(createReview)
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   get:
 *     summary: Xem danh sách đánh giá theo sản phẩm
 *     tags: [Reviews]
 */
router.get(
  "/:id",
  [param("id").isInt().withMessage("id phải là số")],
  asyncHandler(getReviewsByProduct)
);

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Xem tất cả đánh giá (chỉ admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", requireAuth, authorizeRoles("admin"), asyncHandler(getAllReviews));

export default router;
