import express from "express";
import { body, param } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import { 
  getAllReviews, 
  replyToReview, 
  deleteReview 
} from "../controllers/admin.review.controller.js";

// Lưu ý: Route này đã được bảo vệ bởi requireAuth và authorizeRoles trong app.js

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Reviews
 *     description: API quản lý đánh giá cho Admin
 */

/**
 * @swagger
 * /api/admin/reviews:
 *   get:
 *     summary: (Admin) Lấy tất cả đánh giá (có phân trang)
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Trang hiện tại (mặc định 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Số bản ghi mỗi trang (mặc định 10–20)
 *     responses:
 *       '200':
 *         description: Danh sách đánh giá (có phân trang)
 */

router.get("/", asyncHandler(getAllReviews));

/**
 * @swagger
 * /api/admin/reviews/{id_danh_gia}/reply:
 *   post:
 *     summary: (Admin) Phản hồi một đánh giá
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_danh_gia
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               noi_dung:
 *                 type: string
 *             required: [noi_dung]
 *     responses:
 *       '201':
 *         description: Phản hồi thành công
 */
router.post(
  "/:id_danh_gia/reply",
  [
    param("id_danh_gia").isInt({ min: 1 }).withMessage("ID đánh giá không hợp lệ"),
    body("noi_dung").notEmpty().withMessage("Nội dung phản hồi là bắt buộc"),
  ],
  validate,
  asyncHandler(replyToReview)
);

/**
 * @swagger
 * /api/admin/reviews/{id_danh_gia}:
 *   delete:
 *     summary: (Admin) Xóa một đánh giá
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_danh_gia
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Xóa thành công
 */
router.delete(
  "/:id_danh_gia",
  [ param("id_danh_gia").isInt({ min: 1 }).withMessage("ID đánh giá không hợp lệ") ],
  validate,
  asyncHandler(deleteReview)
);

export default router;