import express from "express";
import { body, param } from "express-validator";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import db from "../models/index.js";

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
 *     summary: Lấy danh sách sản phẩm (public)
 *     tags: [Products]
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.max(parseInt(req.query.limit || "12"), 1);
    const offset = (page - 1) * limit;

    const { rows, count } = await Product.findAndCountAll({
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
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  [
    body("name").notEmpty().withMessage("Tên sản phẩm là bắt buộc"),
    body("price").isFloat({ min: 0 }).withMessage("Giá phải lớn hơn 0"),
    body("description").optional().isString(),
    body("categoryId").isInt().withMessage("Danh mục không hợp lệ"),
    body("imageUrl").optional().isString(),
  ],
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
 */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("name").optional().isString().notEmpty(),
    body("price").optional().isFloat({ min: 0 }),
    body("description").optional().isString(),
    body("categoryId").optional().isInt().toInt(),
    body("imageUrl").optional().isString(),
  ],
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
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  asyncHandler(async (req, res) => {
    const prod = await Product.findByPk(req.params.id);
    if (!prod) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    await prod.destroy();
    res.json({ success: true, message: "Đã xóa sản phẩm" });
  })
);

export default router;
