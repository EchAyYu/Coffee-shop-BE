import { Router } from "express";
const r = Router();

import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
import { getStats } from "../controllers/stats.controller.js";
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from "../controllers/customers.controller.js";
import {
  getOrdersAdmin, // Đổi tên này cho đúng với export
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orders.controller.js";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/products.controller.js";

r.use(requireAuth, requireAdmin);

// Quản lý khách hàng
r.get("/customers", getAllCustomers);
r.get("/customers/:id", getCustomerById);
r.post("/customers", createCustomer);
r.put("/customers/:id", updateCustomer);
r.delete("/customers/:id", deleteCustomer);

// Quản lý sản phẩm
r.get("/products", getAllProducts);
r.get("/products/:id", getProductById);
r.post("/products", createProduct);
r.put("/products/:id", updateProduct);
r.delete("/products/:id", deleteProduct);

// Quản lý đơn hàng
r.get("/orders", getOrdersAdmin); // Đổi tên handler cho đúng
r.get("/orders/:id", getOrderById);
r.put("/orders/:id", updateOrderStatus);
r.delete("/orders/:id", deleteOrder);

export default r;
