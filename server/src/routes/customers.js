import { Router } from "express";
import { 
  getAllCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer 
} from "../controllers/customers.controller.js";
import { authMiddleware, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

r.get("/", authMiddleware, authorizeRoles("admin"), getAllCustomers);
r.get("/:id", authMiddleware, authorizeRoles("admin"), getCustomerById);
r.put("/:id", authMiddleware, authorizeRoles("admin"), updateCustomer);
r.delete("/:id", authMiddleware, authorizeRoles("admin"), deleteCustomer);

export default r;
