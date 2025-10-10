import express from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import db from "../models/index.js";

const { Order } = db;
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: API quản lý đơn hàng
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Tạo đơn hàng (chỉ customer)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalPrice:
 *                 type: number
 *                 example: 159000
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: integer
 *                       example: 2
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("customer"),
  [
    body("totalPrice")
      .isFloat({ min: 0 })
      .withMessage("Tổng tiền phải hợp lệ"),
    body("items").isArray({ min: 1 }).withMessage("Phải có ít nhất 1 sản phẩm"),
  ],
  asyncHandler(async (req, res) => {
    const { totalPrice, items } = req.body;

    const order = await Order.create({
      customerId: req.user.id_tk,
      totalPrice,
      status: "PENDING",
    });

    // (nếu bạn có bảng OrderItem, tạo chi tiết ở đây)
    // await OrderItem.bulkCreate(items.map(i => ({ ...i, orderId: order.id })));

    res.status(201).json({
      success: true,
      message: "Đơn hàng đã được tạo thành công",
      data: order,
    });
  })
);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Xem chi tiết đơn hàng (của chính mình)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  requireAuth,
  authorizeRoles("customer", "admin"),
  [param("id").isInt().toInt()],
  asyncHandler(async (req, res) => {
    const order = await Order.findByPk(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    // Kiểm tra quyền truy cập (customer chỉ xem đơn của mình)
    if (
      req.user.role === "customer" &&
      order.customerId !== req.user.id_tk
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này",
      });
    }

    res.json({ success: true, data: order });
  })
);

export default router;
