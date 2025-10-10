// src/routes/stats.routes.js
import express from "express";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStats } from "../controllers/stats.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: API thống kê tổng quan hệ thống (chỉ admin)
 */

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Lấy thống kê tổng quan (chỉ admin)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thống kê tổng quan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCustomers:
 *                       type: integer
 *                       example: 152
 *                     totalProducts:
 *                       type: integer
 *                       example: 32
 *                     totalOrders:
 *                       type: integer
 *                       example: 210
 *                     totalReservations:
 *                       type: integer
 *                       example: 48
 *                     totalRevenue:
 *                       type: number
 *                       example: 15820000
 *                     todayRevenue:
 *                       type: number
 *                       example: 320000
 */
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  asyncHandler(getStats)
);

export default router;
