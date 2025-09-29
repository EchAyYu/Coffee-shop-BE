const reservations = [];
let nextId = 1;

export function createReservation(req, res) {
  const { name, phone, date, people } = req.body;
  if (!name || !phone || !date) return res.status(400).json({ message: "Missing fields" });
  const r = { id: nextId++, name, phone, date, people: people || 2, status: "PENDING" };
  reservations.push(r);
  res.status(201).json(r);
}

export function listReservations(req, res) {
  res.json(reservations);
}