import { Router } from "express";
import { getMyInfo, updateMyInfo } from "../controllers/customerProfileController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Lấy thông tin cá nhân
router.get("/me", requireAuth, getMyInfo);

// Cập nhật thông tin cá nhân
router.put("/me", requireAuth, updateMyInfo);

export default router;
