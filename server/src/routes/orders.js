import { Router } from "express";
import { createOrder, getOrders, getOrderById } from "../controllers/orders.controller.js";

const r = Router();
r.post("/", createOrder);
r.get("/", getOrders);
r.get("/:id", getOrderById);

export default r;
