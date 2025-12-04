import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPublicPromotions } from "../controllers/promotions.controller.js";

const router = express.Router();

// GET /api/promotions
router.get("/", asyncHandler(getPublicPromotions));

export default router;
