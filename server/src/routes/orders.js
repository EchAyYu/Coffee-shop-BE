import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createOrder,
  getOrderById,
} from "../controllers/orders.controller.js";

const router = Router();

// Customer tạo đơn hàng
router.post("/", requireAuth, createOrder);

// Customer xem chi tiết đơn hàng của mình
router.get("/:id", requireAuth, getOrderById);

export default router;
