import { Router } from "express";
import { getAllCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller.js";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

r.get("/", getAllCategories);
r.post("/", authMiddleware, authorizeRoles("admin"), createCategory);
r.put("/:id", authMiddleware, authorizeRoles("admin"), updateCategory);
r.delete("/:id", authMiddleware, authorizeRoles("admin"), deleteCategory);

export default r;
