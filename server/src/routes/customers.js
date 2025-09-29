import { Router } from "express";
import { getAllCustomers, getCustomerById, updateCustomer } from "../controllers/customers.controller.js";

const r = Router();
r.get("/", getAllCustomers);
r.get("/:id", getCustomerById);
r.put("/:id", updateCustomer);

export default r;
