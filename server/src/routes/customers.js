import { Router } from "express";
import {
  getAllCustomers,
  getCustomerById,
  // createCustomer, // Bỏ import nếu không dùng route tạo customer ở đây
  updateCustomer,
  deleteCustomer,
  updateMyInfo, // Hàm cập nhật của chính user
  getMyInfo,    // Hàm lấy thông tin của chính user
} from "../controllers/customers.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { param, body } from "express-validator"; // Import thêm validator
import { validate } from "../utils/validate.js"; // Import middleware validate
import { asyncHandler } from "../utils/asyncHandler.js";

const r = Router();

// ===========================
// 👤 CUSTOMER SELF ROUTES (Ưu tiên định nghĩa trước)
// ===========================

/**
 * @swagger
 * /api/customers/me:
 *   get:
 *     summary: Lấy thông tin khách hàng đang đăng nhập
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Thông tin chi tiết của khách hàng.
 *       '401':
 *         description: Chưa đăng nhập.
 *       '404':
 *         description: Không tìm thấy thông tin khách hàng tương ứng với tài khoản.
 */

r.get(
    "/me",
    requireAuth, // Chỉ cần đăng nhập
    asyncHandler(getMyInfo)
);

/**
 * @swagger
 * /api/customers/me:
 *   put:
 *     summary: Cập nhật thông tin khách hàng đang đăng nhập
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ho_ten:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               sdt:
 *                 type: string
 *               dia_chi:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Cập nhật thành công.
 *       '400':
 *         description: Dữ liệu không hợp lệ.
 *       '401':
 *         description: Chưa đăng nhập.
 *       '403':
 *         description: Không có quyền (không phải customer).
 *       '404':
 *         description: Không tìm thấy khách hàng để cập nhật.
 */

r.put(
    "/me",
    requireAuth,
    authorizeRoles("customer"), // Chỉ role 'customer' mới được cập nhật
    [ // Thêm validation cho body nếu muốn
        body('ho_ten').optional().trim().notEmpty().withMessage('Họ tên không được rỗng'),
        body('email').optional().trim().isEmail().withMessage('Email không hợp lệ'),
        body('sdt').optional().trim().notEmpty().withMessage('Số điện thoại không được rỗng'),
        body('dia_chi').optional().trim().notEmpty().withMessage('Địa chỉ không được rỗng'),
    ],
    validate,
    asyncHandler(updateMyInfo)
);


// ===========================
// 🧑‍💼 ADMIN ROUTES (Định nghĩa sau các route /me)
// ===========================

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Lấy danh sách khách hàng (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên, email, sdt.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Danh sách khách hàng.
 *       '401':
 *         description: Chưa đăng nhập.
 *       '403':
 *         description: Không có quyền truy cập.
 */

r.get(
    "/",
    requireAuth,
    authorizeRoles("admin"), // Chỉ Admin
    asyncHandler(getAllCustomers)
);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Lấy chi tiết khách hàng theo ID (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Chi tiết khách hàng.
 *       '404':
 *         description: Không tìm thấy khách hàng.
 */

r.get(
    "/:id(\\d+)", // Regex để phân biệt với /me
    requireAuth,
    authorizeRoles("admin"), // Chỉ Admin
    [ param("id", "ID không hợp lệ").isInt({ min: 1 }).toInt() ],
    validate,
    asyncHandler(getCustomerById)
);

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Cập nhật khách hàng theo ID (Admin only)
 *     tags: [Customers]
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
 *             properties:
 *               ho_ten:
 *                 type: string
 *               email:
 *                 type: string
 *               sdt:
 *                 type: string
 *               dia_chi:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Cập nhật thành công.
 *       '404':
 *         description: Không tìm thấy khách hàng.
 */

r.put(
    "/:id(\\d+)",
    requireAuth,
    authorizeRoles("admin"), // Chỉ Admin
    [ param("id", "ID không hợp lệ").isInt({ min: 1 }).toInt() ],
    // Thêm validation cho body nếu cần
    validate,
    asyncHandler(updateCustomer)
);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Xóa khách hàng theo ID (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Xóa thành công.
 *       '404':
 *         description: Không tìm thấy khách hàng.
 */

r.delete(
    "/:id(\\d+)",
    requireAuth,
    authorizeRoles("admin"), // Chỉ Admin
    [ param("id", "ID không hợp lệ").isInt({ min: 1 }).toInt() ],
    validate,
    asyncHandler(deleteCustomer)
);

export default r;
