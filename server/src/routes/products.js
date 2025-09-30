import { Router } from "express";
import { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } from "../controllers/products.controller.js";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

r.get("/", getAllProducts);
r.get("/:id", getProductById);
r.post("/", authMiddleware, authorizeRoles("admin"), createProduct);
r.put("/:id", authMiddleware, authorizeRoles("admin"), updateProduct);
r.delete("/:id", authMiddleware, authorizeRoles("admin"), deleteProduct);


export default r;
