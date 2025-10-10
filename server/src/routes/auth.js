import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  me,
  changePassword,
  refreshToken,
  logout,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { loginLimiter } from "../middlewares/rateLimit.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API xác thực và quản lý người dùng
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - ten_dn
 *         - mat_khau
 *       properties:
 *         ten_dn:
 *           type: string
 *           example: "khachhang01"
 *         mat_khau:
 *           type: string
 *           example: "123456"
 *         ho_ten:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         email:
 *           type: string
 *           example: "vana@gmail.com"
 *         sdt:
 *           type: string
 *           example: "0909123456"
 *         dia_chi:
 *           type: string
 *           example: "123 Lê Lợi, Cần Thơ"
 *     LoginRequest:
 *       type: object
 *       required:
 *         - ten_dn
 *         - mat_khau
 *       properties:
 *         ten_dn:
 *           type: string
 *           example: "admin"
 *         mat_khau:
 *           type: string
 *           example: "123456"
 *     RefreshRequest:
 *       type: object
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - oldPassword
 *         - newPassword
 *       properties:
 *         oldPassword:
 *           type: string
 *           example: "123456"
 *         newPassword:
 *           type: string
 *           example: "654321"
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản khách hàng mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Thiếu hoặc sai thông tin
 */
router.post(
  "/register",
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").isLength({ min: 6 }).withMessage("Mật khẩu tối thiểu 6 ký tự"),
    body("email").optional().isEmail().withMessage("Email không hợp lệ"),
  ],
  register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập (Admin hoặc Customer)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Sai tài khoản hoặc mật khẩu
 *       429:
 *         description: Quá nhiều lần đăng nhập sai
 */
router.post(
  "/login",
  loginLimiter,
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").notEmpty().withMessage("Mật khẩu là bắt buộc"),
  ],
  login
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Cấp lại access token bằng refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       200:
 *         description: Cấp token mới thành công
 *       401:
 *         description: Refresh token không hợp lệ
 */
router.post(
  "/refresh",
  [body("refreshToken").notEmpty().withMessage("Thiếu refreshToken")],
  refreshToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất và hủy refresh token hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post("/logout", requireAuth, logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin tài khoản từ token hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get("/me", requireAuth, me);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu tài khoản
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu cũ không đúng hoặc sai định dạng
 */
router.put(
  "/change-password",
  requireAuth,
  [
    body("oldPassword").notEmpty().withMessage("Thiếu mật khẩu cũ"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu mới phải tối thiểu 6 ký tự"),
  ],
  changePassword
);

export default router;
