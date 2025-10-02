import { Router } from "express";
import { 
  getAllEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from "../controllers/employees.controller.js";
import { requireAuth, authorizeRoles } from "../middlewares/authMiddleware.js";

const r = Router();

// Tất cả đều yêu cầu admin
r.use(requireAuth, authorizeRoles("admin"));

r.get("/", getAllEmployees);
r.get("/:id", getEmployeeById);
r.post("/", createEmployee);
r.put("/:id", updateEmployee);
r.delete("/:id", deleteEmployee);

export default r;
