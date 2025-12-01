// File: src/routes/promotions.js

import { Router } from "express";
import { 
  // Thay thế getAllPromotions bằng getPublicPromotions trong import
  getPublicPromotions, 
  createPromotion, 
  updatePromotion, 
  deletePromotion,
  // Nếu bạn muốn giữ getAllPromotions để Admin dùng, thì import cả hai
} from "../controllers/promotions.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// Public: ai cũng có thể xem danh sách khuyến mãi
// Dùng hàm mới chỉ lấy những khuyến mãi công khai
r.get("/", getPublicPromotions); 

// Admin-only: thêm, sửa, xóa (Giữ nguyên)
r.post("/", requireAuth, authorizeRoles("admin"), createPromotion);
r.put("/:id", requireAuth, authorizeRoles("admin"), updatePromotion);
r.delete("/:id", requireAuth, authorizeRoles("admin"), deletePromotion);

export default r;