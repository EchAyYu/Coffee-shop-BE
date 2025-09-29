import { Router } from "express";
import { createReservation, listReservations } from "../controllers/reservations.controller.js";
const r = Router();
r.get("/", listReservations);
r.post("/", createReservation);
export default r;