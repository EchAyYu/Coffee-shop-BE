import { Router } from "express";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMyPoints } from "../controllers/loyalty.controller.js";

const router = Router();
router.get("/me/points", requireAuth, authorizeRoles("customer"), asyncHandler(getMyPoints));

export default router;
