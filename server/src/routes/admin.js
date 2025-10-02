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
  getOrdersAdmin, 
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

import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categories.controller.js";

import { 
  getAllEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from "../controllers/employees.controller.js";

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

// Quản lý danh mục
r.get("/categories", getAllCategories);
r.get("/categories/:id", getCategoryById);
r.post("/categories", createCategory);
r.put("/categories/:id", updateCategory);
r.delete("/categories/:id", deleteCategory);

// Quản lý nhân viên
r.get("/employees", getAllEmployees);
r.get("/employees/:id", getEmployeeById);
r.post("/employees", createEmployee);
r.put("/employees/:id", updateEmployee);
r.delete("/employees/:id", deleteEmployee)

export default r;
