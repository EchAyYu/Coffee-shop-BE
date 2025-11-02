// src/routes/loyalty.js
import { Router } from "express";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Import thêm hàm redeemVoucher
import { getMyPoints, redeemVoucher } from "../controllers/loyalty.controller.js";

const router = Router();

// Route bạn đã có
router.get("/me/points", requireAuth, authorizeRoles("customer"), asyncHandler(getMyPoints));

export default router;