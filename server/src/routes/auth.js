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

const router = Router();

router.post(
  "/register",
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").isLength({ min: 6 }).withMessage("Mật khẩu tối thiểu 6 ký tự"),
    body("email").optional().isEmail().withMessage("Email không hợp lệ"),
  ],
  register
);

router.post(
  "/login",
  [
    body("ten_dn").notEmpty().withMessage("Tên đăng nhập là bắt buộc"),
    body("mat_khau").notEmpty().withMessage("Mật khẩu là bắt buộc"),
  ],
  login
);

// Refresh: BE đọc refresh_token từ cookie httpOnly
router.post("/refresh", refreshToken);

router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

router.put(
  "/change-password",
  requireAuth,
  [
    body("oldPassword").notEmpty(),
    body("newPassword").isLength({ min: 6 }),
  ],
  changePassword
);

export default router;
