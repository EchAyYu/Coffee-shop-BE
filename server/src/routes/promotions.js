import { Router } from "express";
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion } from "../controllers/promotions.controller.js";

const r = Router();
r.get("/", getAllPromotions);
r.post("/", createPromotion);
r.put("/:id", updatePromotion);
r.delete("/:id", deletePromotion);

export default r;
