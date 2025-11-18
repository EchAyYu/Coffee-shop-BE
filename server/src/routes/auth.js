// ===============================
// ☕ Coffee Shop Backend - Auth Routes
// ===============================
import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  me,
  changePassword,
  refreshToken,
  logout,
  forgotPassword,       
  resetPasswordWithOtp,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Đăng ký
router.post(
  "/register",
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").isLength({ min: 6 }).withMessage("Mật khẩu tối thiểu 6 ký tự"),
    body("email").optional().isEmail().withMessage("Email không hợp lệ"),
  ],
  register
);

// Đăng nhập
router.post(
  "/login",
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").notEmpty().withMessage("Mật khẩu là bắt buộc"),
  ],
  login
);

// Refresh: đọc refresh_token từ cookie httpOnly
router.post("/refresh", refreshToken);

// Logout
router.post("/logout", requireAuth, logout);

// Lấy thông tin người dùng hiện tại
router.get("/me", requireAuth, me);

// Đổi mật khẩu
router.put(
  "/change-password",
  requireAuth,
  [
    body("oldPassword").notEmpty(),
    body("newPassword").isLength({ min: 6 }),
  ],
  changePassword
);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password-otp", resetPasswordWithOtp);
export default router;
