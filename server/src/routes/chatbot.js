import express from "express";
import multer from "multer";
import {
  handleChatbotMessage,
  handleChatbotImageMessage,
} from "../controllers/chatbot.controller.js";

const router = express.Router();

// Lưu file ảnh tạm trong RAM (đủ cho gửi lên Groq)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Chat text như cũ
router.post("/", handleChatbotMessage);

// 🔥 Chat kèm hình ảnh
router.post("/image", upload.single("image"), handleChatbotImageMessage);

export default router;
