import { Router } from "express";
import { 
  getAllPromotions, 
  createPromotion, 
  updatePromotion, 
  deletePromotion 
} from "../controllers/promotions.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// Public: ai cũng có thể xem danh sách khuyến mãi
r.get("/", getAllPromotions);

// Admin-only: thêm, sửa, xóa
r.post("/", requireAuth, authorizeRoles("admin"), createPromotion);
r.put("/:id", requireAuth, authorizeRoles("admin"), updatePromotion);
r.delete("/:id", requireAuth, authorizeRoles("admin"), deletePromotion);

export default r;
