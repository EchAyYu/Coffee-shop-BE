import Customer from "../models/Customer.js";

export async function getMyInfo(req, res) {
  try {
    const { id_tk } = req.user;
    if (!id_tk) return res.status(401).json({ message: "Không xác định được người dùng" });

    const customer = await Customer.findOne({ where: { id_tk } });
    if (!customer) return res.status(404).json({ message: "Không tìm thấy thông tin khách hàng" });

    res.json({ success: true, data: customer });
  } catch (err) {
    console.error("[getMyInfo]", err);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin khách hàng" });
  }
}

export async function updateMyInfo(req, res) {
  try {
    const { id_tk } = req.user;
    if (!id_tk) return res.status(401).json({ message: "Không xác định được người dùng" });

    const { ho_ten, email, sdt, dia_chi } = req.body;
    const customer = await Customer.findOne({ where: { id_tk } });

    if (!customer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    await customer.update({ ho_ten, email, sdt, dia_chi });
    res.json({ success: true, message: "Cập nhật thông tin thành công", data: customer });
  } catch (err) {
    console.error("[updateMyInfo]", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật thông tin" });
  }
}
