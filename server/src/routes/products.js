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
 *         name: q
 *         schema: { type: string }
 *         description: Từ khoá tìm theo tên
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: OK }
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;
    const offset = (page - 1) * limit;

    const where = q
      ? {
          name: { [Op.like]: `%${q}%` },
        }
      : {};

    const { rows, count } = await Product.findAndCountAll({
      where,
      offset,
      limit,
      order: [["createdAt", "DESC"]],
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
 */
router.get(
  "/:id",
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    res.json({ success: true, data: prod });
  })
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Thêm sản phẩm mới (chỉ admin)
 *     tags: [Products]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, categoryId]
 *             properties:
 *               name:        { type: string }
 *               price:       { type: number }
 *               description: { type: string }
 *               categoryId:  { type: integer }
 *               imageUrl:    { type: string }
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("admin"),
  [
    body("name").notEmpty().withMessage("Tên sản phẩm là bắt buộc"),
    body("price").isFloat({ min: 0 }).withMessage("Giá phải lớn hơn 0"),
    body("description").optional().isString(),
    body("categoryId").isInt().withMessage("Danh mục không hợp lệ"),
    body("imageUrl").optional().isString(),
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
 *     security: [ { bearerAuth: [] } ]
 */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("name").optional().isString().notEmpty(),
    body("price").optional().isFloat({ min: 0 }),
    body("description").optional().isString(),
    body("categoryId").optional().isInt().toInt(),
    body("imageUrl").optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
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
 *     security: [ { bearerAuth: [] } ]
 */
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  validate,
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    await prod.destroy();
    res.json({ success: true, message: "Đã xóa sản phẩm" });
  })
);

export default router;
