import express from "express";
import { handleChatbotMessage } from "../controllers/chatbot.controller.js";

const router = express.Router();

router.post("/", handleChatbotMessage);

export default router;
