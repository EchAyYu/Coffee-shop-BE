import express from "express";
import multer from "multer";
import {
  handleChatbotMessage,
  handleChatbotImageMessage,
} from "../controllers/chatbot.controller.js";
import { loadUserIfAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Lưu file ảnh tạm trong RAM (đủ cho gửi lên Groq)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Chat text (có thể có user nếu đã đăng nhập)
router.post("/", loadUserIfAuthenticated, handleChatbotMessage);

// Chat kèm hình ảnh (cũng nhận user nếu có)
router.post(
  "/image",
  loadUserIfAuthenticated,
  upload.single("image"),
  handleChatbotImageMessage
);

export default router;
