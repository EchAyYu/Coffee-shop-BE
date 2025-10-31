import { Router } from "express";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { myNotifications, markAsRead, markAllRead } from "../controllers/notification.controller.js";

const router = Router();
router.get("/my", requireAuth, authorizeRoles("customer"), asyncHandler(myNotifications));
router.put("/:id/read", requireAuth, authorizeRoles("customer"), asyncHandler(markAsRead));
router.put("/read-all", requireAuth, authorizeRoles("customer"), asyncHandler(markAllRead));
export default router;
