// src/routes/employees.js
import { Router } from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employees.controller.js";

const router = Router();

// === BẢO VỆ TẤT CẢ CÁC ROUTE BÊN DƯỚI ===
// Chỉ có ADMIN mới được truy cập các API này
router.use(requireAuth, authorizeRoles("admin"));

// Lấy tất cả nhân viên
router.get(
    "/", 
    asyncHandler(getAllEmployees)
);

// Thêm nhân viên mới
router.post(
  "/",
  [
    body("ten_dn")
        .notEmpty().withMessage("Tên đăng nhập là bắt buộc")
        .isLength({ min: 4 }).withMessage("Tên đăng nhập phải có ít nhất 4 ký tự"),
    body("mat_khau")
        .notEmpty().withMessage("Mật khẩu là bắt buộc")
        .isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
  ],
  validate, // Hàm validate này bạn đã có từ file orders.js
  asyncHandler(createEmployee)
);

// Lấy 1 nhân viên
router.get(
  "/:id",
  [ param("id").isInt({ min: 1 }).withMessage("ID không hợp lệ") ],
  validate,
  asyncHandler(getEmployeeById)
);

// Cập nhật nhân viên (VD: reset mật khẩu)
router.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("ID không hợp lệ"),
    body("ten_dn").optional().isLength({ min: 4 }).withMessage("Tên đăng nhập phải có ít nhất 4 ký tự"),
    body("mat_khau").optional().isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự")
  ],
  validate,
  asyncHandler(updateEmployee)
);

// Xóa nhân viên
router.delete(
  "/:id",
  [ param("id").isInt({ min: 1 }).withMessage("ID không hợp lệ") ],
  validate,
  asyncHandler(deleteEmployee)
);

export default router;