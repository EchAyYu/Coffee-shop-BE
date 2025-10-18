// server/src/routes/orders.js
import express from "express";
import { body, param } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import db from "../models/index.js";
import { Op } from "sequelize";
import { getOrdersAdmin } from "../controllers/orders.controller.js";

const { Product, Order, Customer } = db;
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: API quản lý đơn hàng
 */

/**
 * Tạo đơn hàng (khách đã đăng nhập)
 */
router.post(
  "/",
  requireAuth,
  [
    body("items").isArray({ min: 1 }).withMessage("Thiếu danh sách items"),
    body("items.*.id_mon").isInt().withMessage("id_mon không hợp lệ"),
    body("items.*.so_luong").isInt({ min: 1 }).withMessage("so_luong phải >= 1"),
    body("pttt").optional().isString(),
    body("ho_ten_nhan").optional().isString(),
    body("sdt_nhan").optional().isString(),
    body("dia_chi_nhan").optional().isString(),
    body("id_kh").optional().isInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { items, pttt = "COD" } = req.body;

    // ---- 1) Xác định accountId từ token (nhiều key dự phòng) ----
    const accountId =
      req.user?.id_tk ??
      req.user?.id ??
      req.user?.userId ??
      req.user?.accountId;

    if (!accountId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản từ token",
      });
    }

    // ---- 2) Xác định khách hàng ----
    let { id_kh, ho_ten_nhan, sdt_nhan, dia_chi_nhan } = req.body;

    let customer = null;
    if (id_kh) {
      customer = await Customer.findByPk(id_kh);
      if (!customer) {
        return res.status(400).json({ success: false, message: "id_kh không tồn tại" });
      }
    } else {
      customer = await Customer.findOne({ where: { id_tk: accountId } });
      if (!customer) {
        return res.status(400).json({ success: false, message: "Không tìm thấy khách hàng cho tài khoản này" });
      }
      id_kh = customer.id_kh;
    }

    // ---- 3) Bảo đảm 3 trường bắt buộc của model Order ----
    ho_ten_nhan = ho_ten_nhan || customer.ho_ten || "Khách hàng";
    sdt_nhan     = sdt_nhan     || customer.sdt   || "000000000";
    dia_chi_nhan = dia_chi_nhan || customer.dia_chi || "Chưa cập nhật";

    // ---- 4) (Tuỳ chọn) kiểm tra sản phẩm hợp lệ ----
    const ids = items.map(i => i.id_mon);
    const products = await Product.findAll({ where: { id_mon: { [Op.in]: ids } } });
    if (products.length !== items.length) {
      return res.status(400).json({ success: false, message: "Có sản phẩm không tồn tại" });
    }

    // ---- 5) Tạo đơn: KHÔNG ghi 'tong_tien' vì model không có ----
    const order = await Order.create({
      id_kh,
      pttt,
      ho_ten_nhan,
      sdt_nhan,
      dia_chi_nhan,
      trang_thai: "pending",
      // ngay_dat tự default
    });

    // (Nếu có bảng chi tiết đơn hàng thì ghi items ở đây)

    return res.status(201).json({ success: true, data: order });
  })
);

/** Xem tất cả đơn (admin/employee) */
router.get(
  "/",
  requireAuth,
  authorizeRoles("admin", "employee"),
  asyncHandler(async (_req, res) => {
    const rows = await Order.findAll({ order: [["id_don", "DESC"]] });
    res.json({ success: true, data: rows });
  })
);

/** Xem 1 đơn (admin/employee hoặc chính chủ) */
router.get(
  "/:id",
  requireAuth,
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const od = await Order.findByPk(req.params.id);
    if (!od) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const role = (req.user?.role || "").toLowerCase();
    const canSeeAll = role === "admin" || role === "employee";

    if (!canSeeAll) {
      const accountId = req.user?.id_tk ?? req.user?.id ?? req.user?.userId;
      const cus = await Customer.findOne({ where: { id_tk: accountId } });
      if (!cus || cus.id_kh !== od.id_kh) {
        return res.status(403).json({ success: false, message: "Không có quyền xem đơn này" });
      }
    }

    res.json({ success: true, data: od });
  })
);

/** Cập nhật đơn (admin/employee) */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const od = await Order.findByPk(req.params.id);
    if (!od) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    await od.update(req.body);
    res.json({ success: true, data: od });
  })
);

/** Xoá đơn (admin/employee) */
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin", "employee"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const od = await Order.findByPk(req.params.id);
    if (!od) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    await od.destroy();
    res.json({ success: true, message: "Đã xoá đơn hàng" });
  })
);


export default router;
