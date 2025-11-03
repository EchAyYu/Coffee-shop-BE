// src/routes/orders.js (ĐÃ CẬP NHẬT)

import express from "express";
import { body, param, query } from "express-validator";
// 💡 SỬA LỖI 1: Import thêm "loadUserIfAuthenticated"
import { requireAuth, authorizeRoles, loadUserIfAuthenticated } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";

// Import chính xác các hàm từ controller
import {
  createOrder,
  getOrdersAdmin,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getMyOrders,
} from "../controllers/orders.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: API quản lý đơn hàng
 */

// ==========================
// CLIENT/PUBLIC ROUTES
// ==========================

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Tạo đơn hàng mới (khách vãng lai hoặc đã đăng nhập)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ho_ten_nhan, sdt_nhan, dia_chi_nhan, pttt, items]
 *             properties:
 *               ho_ten_nhan:
 *                 type: string
 *               sdt_nhan:
 *                 type: string
 *               dia_chi_nhan:
 *                 type: string
 *               email_nhan:
 *                 type: string
 *                 format: email
 *               pttt:
 *                 type: string
 *                 enum: [COD, BANK_TRANSFER]
 *               ghi_chu:
 *                 type: string
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [id_mon, so_luong]
 *                   properties:
 *                     id_mon:
 *                       type: integer
 *                       minimum: 1
 *                     so_luong:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Tạo đơn hàng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */

router.post(
  "/",
  // 💡 SỬA LỖI 2: Thêm middleware "loadUserIfAuthenticated" vào đây
  // Nó sẽ cố gắng tải req.user nếu có token,
  // hoặc bỏ qua nếu là khách vãng lai.
  asyncHandler(loadUserIfAuthenticated),
  
  // Validation (giữ nguyên)
  [
    body("ho_ten_nhan").notEmpty().withMessage("Thiếu họ tên người nhận"),
    body("sdt_nhan").notEmpty().withMessage("Thiếu số điện thoại người nhận"),
    body("dia_chi_nhan").notEmpty().withMessage("Thiếu địa chỉ người nhận"),
    body("email_nhan").optional({ checkFalsy: true }).isEmail().withMessage("Email không hợp lệ"),
    body("pttt").isIn(["COD", "BANK_TRANSFER"]).withMessage("Phương thức thanh toán không hợp lệ"),
    body("ghi_chu").optional().isString(),
    body("items").isArray({ min: 1 }).withMessage("Giỏ hàng không được rỗng"),
    body("items.*.id_mon").isInt({ min: 1 }).withMessage("ID món không hợp lệ"),
    body("items.*.so_luong").isInt({ min: 1 }).withMessage("Số lượng phải lớn hơn 0"),
  ],
  validate,
  asyncHandler(createOrder) // Bây giờ 'createOrder' sẽ nhận được req.user (nếu có)
);


/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Xem chi tiết đơn hàng (Admin/Employee hoặc chủ đơn hàng)
 *     tags: [Orders]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Chi tiết đơn hàng
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.get(
  "/:id(\\d+)", 
  requireAuth, // Giữ nguyên
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(getOrderById)
);

// ==========================
// ADMIN/EMPLOYEE ROUTES
// ==========================

/**
 * @swagger
 * /api/orders/list:
 *   get:
 *     summary: Lấy danh sách đơn hàng (Admin/Employee)
 *     tags: [Orders]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 */

router.get(
  "/list",
  requireAuth,
  authorizeRoles("admin", "employee"), 
  asyncHandler(getOrdersAdmin)
);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái đơn hàng (Admin/Employee)
 *     tags: [Orders]
 *     parameters:
 *       - name: id
 *         in: path
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
 *             required: [trang_thai]
 *             properties:
 *               trang_thai:
 *                 type: string
 *                 enum: [pending, pending_payment, confirmed, completed, cancelled, done, paid, shipped]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.put(
  "/:id(\\d+)/status", 
  requireAuth,
  authorizeRoles("admin", "employee"),
  [
    param("id").isInt({ min: 1 }).toInt(),
    body("trang_thai")
      .notEmpty().withMessage("Thiếu trạng thái")
      // 💡 SỬA LỖI 3: Đảm bảo TẤT CẢ trạng thái (cả chữ hoa) đều hợp lệ
      .isIn(["pending", "pending_payment", "confirmed", "completed", "cancelled", "done", "paid", "shipped"]) 
      .withMessage("Trạng thái không hợp lệ"),
  ],
  validate,
  asyncHandler(updateOrderStatus) 
);

 /**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     summary: Xóa đơn hàng (Admin/Employee)
 *     tags: [Orders]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Đã xóa
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */

router.delete(
  "/:id(\\d+)",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(deleteOrder)
);

// Route lấy đơn hàng CỦA TÔI (customer)
router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  [
    query("status").optional().isString(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  asyncHandler(getMyOrders)
);


export default router;