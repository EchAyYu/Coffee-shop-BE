import { Router } from "express";
import {
  getAllCustomers,
  getCustomerById,
  // createCustomer is imported but not used, you can remove it if you wish
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateMyInfo, // This is the correct function to use
  getMyInfo,
} from "../controllers/customers.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// A small inconsistency fix: Use 'requireAuth' everywhere instead of 'authMiddleware'
// to avoid confusion. I've updated it below.

// 🧑‍💼 Admin routes
r.get("/", requireAuth, authorizeRoles("admin"), getAllCustomers);
r.get("/:id", requireAuth, authorizeRoles("admin"), getCustomerById);
r.put("/:id", requireAuth, authorizeRoles("admin"), updateCustomer);
r.delete("/:id", requireAuth, authorizeRoles("admin"), deleteCustomer);

// 👤 Customer self routes
r.get("/me", requireAuth, getMyInfo);

// BUG FIX: The controller function was named incorrectly. It should be 'updateMyInfo'.
r.put("/me", requireAuth, authorizeRoles("customer"), updateMyInfo);

export default r;