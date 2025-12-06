// src/routes/admin.js
import { Router } from "express";
const r = Router();
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";

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
  getAdminOrderStats,     
  exportAdminOrdersCsv,   
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
import {
  getAllReservations,
  updateReservationStatus,
  deleteReservation,
  getReservationStats,   
  exportReservationStatsCsv,     // 💥 MỚI
} from "../controllers/reservations.controller.js";
import {
  createVoucher,
  getAllVouchersAdmin,
  updateVoucher,
  deleteVoucher
} from "../controllers/voucher.controller.js";
import { getAdminStats } from "../controllers/admin.stats.controller.js";
import {
  getAdminPromotions,
  createAdminPromotion,
  updateAdminPromotion,
  deleteAdminPromotion,
} from "../controllers/promotions.controller.js";

// Middleware: chỉ admin mới vào được
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
r.post("/products", asyncHandler(createProduct));
r.put("/products/:id", asyncHandler(updateProduct));
r.delete("/products/:id", deleteProduct);

// Quản lý đơn hàng
r.get("/orders-stats", getAdminOrderStats); 
r.get("/orders/export", exportAdminOrdersCsv); 
r.get("/orders", getOrdersAdmin);
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
r.delete("/employees/:id", deleteEmployee);

// Quản lý đặt bàn (Admin)
r.get("/reservations", getAllReservations);
r.get("/reservations/stats", getReservationStats); 
r.get("/reservations/export", exportReservationStatsCsv);
r.put("/reservations/:id", updateReservationStatus);
r.delete("/reservations/:id", deleteReservation);


// QUẢN LÝ VOUCHER (Admin)
r.get("/vouchers", asyncHandler(getAllVouchersAdmin));
r.post("/vouchers", asyncHandler(createVoucher));
r.put("/vouchers/:id", asyncHandler(updateVoucher));
r.delete("/vouchers/:id", asyncHandler(deleteVoucher));

// Thống kê Admin
r.get("/stats", asyncHandler(getAdminStats));

// QUẢN LÝ KHUYẾN MÃI (Admin)
r.get("/promotions", getAdminPromotions);
r.post("/promotions", createAdminPromotion);
r.put("/promotions/:id", updateAdminPromotion);
r.delete("/promotions/:id", deleteAdminPromotion);

export default r;
