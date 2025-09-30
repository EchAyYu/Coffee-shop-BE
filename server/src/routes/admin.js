import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

import { getAllCustomers } from "../controllers/customers.controller.js";
import { getAllOrders } from "../controllers/orders.controller.js";
import { getAllProducts } from "../controllers/products.controller.js";

const r = Router();

r.use(requireAuth, requireAdmin);

// Quản lý khách hàng
r.get("/customers", getAllCustomers);

// Quản lý sản phẩm
r.get("/products", getAllProducts);

// Quản lý đơn hàng
r.get("/orders", getAllOrders);

export default r;
