import express from "express";
import {
  getAllContents,
  createContent,
  updateContent,
  deleteContent,
} from "../controllers/homeContentController.js";
import { requireAdmin, requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🔹 Lấy tất cả nội dung (public)
router.get("/", getAllContents);

// 🔹 Thêm mới (admin)
router.post("/", requireAuth, requireAdmin, createContent);

// 🔹 Cập nhật nội dung theo ID (admin)
router.put("/:id", requireAuth, requireAdmin, updateContent);

// 🔹 Xóa nội dung theo ID (admin)
router.delete("/:id", requireAuth, requireAdmin, deleteContent);

export default router;
