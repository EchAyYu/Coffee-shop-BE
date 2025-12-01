import { Router } from "express";
import { body } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  listCatalog,
  redeemVoucher,
  myVouchers,
  validateCode,
} from "../controllers/voucher.controller.js";

const router = Router();

// Danh mục voucher (public cho FE dùng tab Đổi thưởng)
router.get("/catalog", asyncHandler(listCatalog));

// Đổi điểm lấy voucher
router.post(
  "/redeem",
  requireAuth,
  authorizeRoles("customer"),
  [body("voucher_id").isInt({ min: 1 })],
  validate,
  asyncHandler(redeemVoucher)
);

// Voucher cá nhân
router.get(
  "/my",
  requireAuth,
  authorizeRoles("customer"),
  asyncHandler(myVouchers)
);

// Kiểm tra mã khi checkout
router.post(
  "/validate",
  requireAuth,
  authorizeRoles("customer"),
  [body("code").notEmpty(), body("order_total").isFloat({ min: 0 })],
  validate,
  asyncHandler(validateCode)
);

export default router;
