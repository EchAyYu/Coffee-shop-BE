import { Router } from "express";
import { register, login, me, changePassword } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const r = Router();

// Auth routes
r.post("/register", register);          // Đăng ký khách hàng
r.post("/login", login);                // Đăng nhập (admin + customer)
r.get("/me", requireAuth, me);          // Lấy thông tin từ token
r.put("/change-password", requireAuth, changePassword); // Đổi mật khẩu

export default r;
