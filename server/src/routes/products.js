// src/routes/products.js
import express from "express";
import { body, param, query } from "express-validator";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../utils/validate.js";
import db from "../models/index.js";
import { Op } from "sequelize";

const { Product } = db;
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API quản lý sản phẩm
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm (public, có tìm kiếm & phân trang)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Số trang (mặc định = 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Số sản phẩm trên 1 trang (mặc định = 12)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên sản phẩm
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Lọc theo ID danh mục
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm với thông tin phân trang
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("q").optional().isString().trim(),
    query("categoryId").optional().isInt().toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;
    const offset = (page - 1) * limit;

    // ✅ Dùng đúng tên cột trong DB: ten_mon
    // ✅ Bộ lọc nâng cao
    const where = {};
    
    if (q) {
      where.ten_mon = { [Op.like]: `%${q}%` };
    }
    
    if (req.query.categoryId) {
      where.id_dm = req.query.categoryId; // lọc theo danh mục
    }

    // ✅ FIX: Thêm query database
    const { rows, count } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [["id_mon", "DESC"]], // Sản phẩm mới nhất trước
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  })
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm (public)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get(
  "/:id",
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    res.json({ success: true, data: prod });
  })
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Thêm sản phẩm mới (chỉ admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ten_mon
 *               - gia
 *               - id_dm
 *             properties:
 *               ten_mon:
 *                 type: string
 *                 description: Tên sản phẩm
 *               gia:
 *                 type: number
 *                 description: Giá sản phẩm
 *               id_dm:
 *                 type: integer
 *                 description: ID danh mục
 *               mo_ta:
 *                 type: string
 *                 description: Mô tả sản phẩm
 *               anh:
 *                 type: string
 *                 description: URL hình ảnh
 *               trang_thai:
 *                 type: boolean
 *                 description: Trạng thái (true=hiển thị, false=ẩn)
 *     responses:
 *       201:
 *         description: Tạo sản phẩm thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền admin
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  [
    // ✅ Map đúng schema bảng "mon"
    body("ten_mon").notEmpty().withMessage("Tên sản phẩm là bắt buộc"),
    body("gia").isFloat({ min: 0 }).withMessage("Giá phải lớn hơn 0"),
    body("id_dm").isInt().withMessage("Danh mục không hợp lệ"),
    body("mo_ta").optional().isString(),
    body("anh").optional().isString(),
    body("trang_thai").optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.create(req.body);
    res.status(201).json({ success: true, data: prod });
  })
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Cập nhật thông tin sản phẩm (chỉ admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ten_mon:
 *                 type: string
 *               gia:
 *                 type: number
 *               id_dm:
 *                 type: integer
 *               mo_ta:
 *                 type: string
 *               anh:
 *                 type: string
 *               trang_thai:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("ten_mon").optional().isString().notEmpty(),
    body("gia").optional().isFloat({ min: 0 }),
    body("id_dm").optional().isInt().toInt(),
    body("mo_ta").optional().isString(),
    body("anh").optional().isString(),
    body("trang_thai").optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    await prod.update(req.body);
    res.json({ success: true, data: prod });
  })
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Xóa sản phẩm (chỉ admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    await prod.destroy();
    res.json({ success: true, message: "Đã xóa sản phẩm" });
  })
);

export default router;