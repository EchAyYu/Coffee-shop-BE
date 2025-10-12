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
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await Category.findAll({ order: [["id_dm", "ASC"]] }); // ✅
    res.json({ success: true, data: categories });
  })
);

router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  [body("ten_dm").trim().notEmpty().withMessage("Tên danh mục là bắt buộc")],
  asyncHandler(async (req, res) => {
    const cat = await Category.create({ ten_dm: req.body.ten_dm, anh: req.body.anh });
    res.status(201).json({ success: true, data: cat });
  })
);

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  [
    param("id").isInt().toInt(),
    body("ten_dm").trim().notEmpty().withMessage("Tên danh mục là bắt buộc"),
  ],
  asyncHandler(async (req, res) => {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    await cat.update({ ten_dm: req.body.ten_dm, anh: req.body.anh });
    res.json({ success: true, data: cat });
  })
);

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
