import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { getMyCheckoutProfile, updateMyCheckoutProfile } from "../controllers/profile.controller.js";

const router = Router();

router.get("/me/checkout-profile", requireAuth, getMyCheckoutProfile);
router.put("/me/checkout-profile", requireAuth, updateMyCheckoutProfile);

export default router;
