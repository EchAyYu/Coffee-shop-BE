import { Router } from "express";
import { body } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import { listCatalog, redeemVoucher, myVouchers, validateCode } from "../controllers/voucher.controller.js";
//import { redeemVoucher } from "../controllers/loyalty.controller.js";

const router = Router();

// Danh mục mở (có thể public hoặc bắt customer – tuỳ bạn)
router.get("/catalog", asyncHandler(listCatalog));

// Đổi điểm
router.post(
  "/redeem",
  requireAuth,
  authorizeRoles("customer"),
  [body("voucher_id").isInt({ min: 1 })],
  validate,
  asyncHandler(redeemVoucher)
);

// Mã của tôi
router.get("/my", requireAuth, authorizeRoles("customer"), asyncHandler(myVouchers));

// Kiểm tra mã
router.post(
  "/validate",
  requireAuth,
  authorizeRoles("customer"),
  [body("code").notEmpty(), body("order_total").isFloat({ min: 0 })],
  validate,
  asyncHandler(validateCode)
);

router.post("/redeem", requireAuth, authorizeRoles("customer"), asyncHandler(redeemVoucher));

export default router;
