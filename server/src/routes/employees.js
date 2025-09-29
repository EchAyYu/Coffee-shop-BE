import { Router } from "express";
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from "../controllers/employees.controller.js";

const r = Router();
r.get("/", getAllEmployees);
r.get("/:id", getEmployeeById);
r.post("/", createEmployee);
r.put("/:id", updateEmployee);
r.delete("/:id", deleteEmployee);

export default r;
