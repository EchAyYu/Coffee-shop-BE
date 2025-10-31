import db from "../models/index.js";
const { Customer } = db;

export async function getMyPoints(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const c = await Customer.findOne({ where: { id_tk }, attributes: ["id_kh", "diem"] });
    if (!c) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    res.json({ success: true, data: { points: c.diem || 0 } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy điểm." });
  }
}
