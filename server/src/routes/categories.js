import { Router } from "express";
import { getAllCategories } from "../controllers/categories.controller.js";

const r = Router();
r.get("/", getAllCategories);

export default r;
