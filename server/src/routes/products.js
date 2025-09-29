import { Router } from "express";
import { getAllProducts, getProductById } from "../controllers/products.controller.js";
const r = Router();
r.get("/", getAllProducts);
r.get("/:id", getProductById);
export default r;