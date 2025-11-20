import express from "express";
import { handleChatbotMessage } from "../controllers/chatbot.controller.js";
// Nếu bạn muốn cho cả khách vãng lai dùng: KHÔNG cần requireAuth.
// Nếu muốn cá nhân hoá theo user: dùng loadUserIfAuthenticated.

const router = express.Router();

// Cho phép cả khách vãng lai & khách đăng nhập đều chat được
router.post("/", handleChatbotMessage);

export default router;
