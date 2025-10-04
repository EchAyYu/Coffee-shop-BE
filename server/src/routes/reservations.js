import { Router } from "express";
import {
  createReservation,
  getMyReservations,
  getAllReservations,
  updateReservationStatus,
  deleteReservation,
} from "../controllers/reservations.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// ==================== CUSTOMER ====================
// Tạo đặt bàn (customer)
r.post("/", requireAuth, authorizeRoles("customer"), createReservation);

// Xem lịch sử đặt bàn của chính mình
r.get("/my", requireAuth, authorizeRoles("customer"), getMyReservations);

// ==================== ADMIN ====================
// Xem toàn bộ đặt bàn
r.get("/", requireAuth, authorizeRoles("admin"), getAllReservations);

// Cập nhật trạng thái (CONFIRMED, CANCELLED, DONE…)
r.put("/:id", requireAuth, authorizeRoles("admin"), updateReservationStatus);

// Xóa đặt bàn
r.delete("/:id", requireAuth, authorizeRoles("admin"), deleteReservation);

export default r;
