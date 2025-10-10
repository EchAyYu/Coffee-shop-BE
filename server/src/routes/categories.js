import express from "express";
import { body, param } from "express-validator";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import db from "../models/index.js";

const { Category } = db;
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: API quản lý danh mục sản phẩm
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Lấy danh sách danh mục (public)
 *     tags: [Categories]
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await Category.findAll({ order: [["id", "ASC"]] });
    res.json({ success: true, data: categories });
  })
);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Thêm danh mục mới (chỉ admin)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  [body("name").trim().notEmpty().withMessage("Tên danh mục là bắt buộc")],
  asyncHandler(async (req, res) => {
    const cat = await Category.create({ name: req.body.name });
    res.status(201).json({ success: true, data: cat });
  })
);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Cập nhật danh mục (chỉ admin)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("name").trim().notEmpty().withMessage("Tên danh mục là bắt buộc"),
  ],
  asyncHandler(async (req, res) => {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    await cat.update({ name: req.body.name });
    res.json({ success: true, data: cat });
  })
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Xóa danh mục (chỉ admin)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  [param("id").isInt().toInt()],
  asyncHandler(async (req, res) => {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    await cat.destroy();
    res.json({ success: true, message: "Đã xóa danh mục" });
  })
);

export default router;
