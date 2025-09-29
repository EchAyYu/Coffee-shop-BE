import { Router } from "express";
import { getReviewsByProduct, createReview } from "../controllers/reviews.controller.js";

const r = Router();
r.get("/:productId", getReviewsByProduct);
r.post("/", createReview);

export default r;
