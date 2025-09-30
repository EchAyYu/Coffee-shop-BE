import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const r = Router();

r.post("/register", register);
r.post("/login", login);
r.get("/me", authMiddleware, me);

export default r;
