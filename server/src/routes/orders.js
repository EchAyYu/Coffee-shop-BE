import express from "express";
import { body, param, query } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
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
  *     summary: Tạo đơn hàng mới
  *     tags: [Orders]
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - ho_ten_nhan
  *               - sdt_nhan
  *               - dia_chi_nhan
  *               - pttt
  *               - items
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
  *                 items:
  *                   type: object
  *                   required:
  *                     - id_mon
  *                     - so_luong
  *                   properties:
  *                     id_mon:
  *                       type: integer
  *                     so_luong:
  *                       type: integer
  *     responses:
  *       201:
  *         description: Tạo đơn hàng thành công
  *       400:
  *         description: Dữ liệu không hợp lệ
  *       500:
  *         description: Lỗi máy chủ
  */
router.post(
  "/",
  // Không cần requireAuth ở đây nếu cho phép khách vãng lai
  [
    // Validation như đã định nghĩa ở câu trả lời trước
    body("ho_ten_nhan").notEmpty().withMessage("Thiếu họ tên người nhận"),
    body("sdt_nhan").notEmpty().withMessage("Thiếu số điện thoại người nhận"),
    body("dia_chi_nhan").notEmpty().withMessage("Thiếu địa chỉ người nhận"),
    body("email_nhan").optional({ checkFalsy: true }).isEmail().withMessage("Email không hợp lệ"), // checkFalsy để cho phép chuỗi rỗng
    body("pttt").isIn(["COD", "BANK_TRANSFER"]).withMessage("Phương thức thanh toán không hợp lệ"),
    body("ghi_chu").optional().isString(),
    body("items").isArray({ min: 1 }).withMessage("Giỏ hàng không được rỗng"),
    body("items.*.id_mon").isInt({ min: 1 }).withMessage("ID món không hợp lệ"),
    body("items.*.so_luong").isInt({ min: 1 }).withMessage("Số lượng phải lớn hơn 0"),
  ],
  validate,
  asyncHandler(createOrder) // Sử dụng hàm createOrder từ controller
);


/**
  * @swagger
  * /api/orders/{id}:
  *   get:
  *     summary: Xem chi tiết đơn hàng (Admin/Employee hoặc chủ đơn hàng)
  *     tags: [Orders]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: integer
  *     responses:
  *       200:
  *         description: Chi tiết đơn hàng
  *       403:
  *         description: Không có quyền xem
  *       404:
  *         description: Không tìm thấy đơn hàng
  */
router.get(
  "/:id(\\d+)", // Regex (\\d+) để đảm bảo id là số, tránh xung đột với /list
  requireAuth, // Cần đăng nhập để xem đơn hàng
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(getOrderById) // Sử dụng hàm getOrderById từ controller
);


// ==========================
// ADMIN/EMPLOYEE ROUTES
// ==========================

/**
  * @swagger
  * /api/orders/list:
  *   get:
  *     summary: Lấy danh sách đơn hàng cho Admin/Employee (có phân trang, lọc)
  *     tags: [Orders]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: query
  *         name: status
  *         schema:
  *           type: string
  *           enum: [pending, pending_payment, confirmed, completed, cancelled]
  *       - in: query
  *         name: from
  *         schema:
  *           type: string
  *           format: date
  *       - in: query
  *         name: to
  *         schema:
  *           type: string
  *           format: date
  *       - in: query
  *         name: q
  *         schema:
  *           type: string
  *       - in: query
  *         name: page
  *         schema:
  *           type: integer
  *           default: 1
  *       - in: query
  *         name: limit
  *         schema:
  *           type: integer
  *           default: 10
  *     responses:
  *       200:
  *         description: Danh sách đơn hàng
  */
router.get(
  "/list", // Sử dụng /list để lấy danh sách cho admin
  requireAuth,
  authorizeRoles("admin", "employee"), // Chỉ admin hoặc employee
  asyncHandler(getOrdersAdmin) // Sử dụng hàm getOrdersAdmin từ controller
);

/**
  * @swagger
  * /api/orders/{id}/status:
  *   put:
  *     summary: Cập nhật trạng thái đơn hàng (Admin/Employee)
  *     tags: [Orders]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: integer
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - trang_thai
  *             properties:
  *               trang_thai:
  *                 type: string
  *                 enum: [pending, pending_payment, confirmed, completed, cancelled]
  *     responses:
  *       200:
  *         description: Cập nhật thành công
  *       400:
  *         description: Trạng thái không hợp lệ
  *       404:
  *         description: Không tìm thấy đơn hàng
  */
router.put(
  "/:id(\\d+)/status", // Endpoint riêng để cập nhật trạng thái
  requireAuth,
  authorizeRoles("admin", "employee"),
  [
    param("id").isInt({ min: 1 }).toInt(),
    body("trang_thai")
      .notEmpty().withMessage("Thiếu trạng thái")
      .isIn(["pending", "pending_payment", "confirmed", "completed", "cancelled"]) // Trạng thái hợp lệ (chữ thường)
      .withMessage("Trạng thái không hợp lệ"),
  ],
  validate,
  asyncHandler(updateOrderStatus) // Sử dụng hàm updateOrderStatus từ controller
);

 /**
  * @swagger
  * /api/orders/{id}:
  *   delete:
  *     summary: Xóa đơn hàng (Admin/Employee)
  *     tags: [Orders]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: integer
  *     responses:
  *       200:
  *         description: Xóa thành công
  *       404:
  *         description: Không tìm thấy đơn hàng
  */
router.delete(
  "/:id(\\d+)", // Endpoint xóa đơn hàng
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt({ min: 1 }).toInt()],
  validate,
  asyncHandler(deleteOrder) // Sử dụng hàm deleteOrder từ controller
);

router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  [
    query("status").optional().isString(), // vd: completed,cancelled
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  asyncHandler(getMyOrders)
);


export default router;

