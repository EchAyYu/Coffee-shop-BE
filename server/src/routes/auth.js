import { Router } from "express";
import { register, login, me, changePassword } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Auth routes
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.put("/change-password", requireAuth, changePassword);

export default router;
