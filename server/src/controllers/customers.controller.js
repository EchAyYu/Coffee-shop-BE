import Customer from "../models/Customer.js";
import Account from "../models/Account.js";

// Lấy tất cả khách hàng
export async function getAllCustomers(req, res) {
  try {
    const customers = await Customer.findAll({ include: Account });
    res.json(customers);
  } catch (err) {
    console.error("❌ getAllCustomers error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Lấy khách hàng theo ID
export async function getCustomerById(req, res) {
  try {
    const customer = await Customer.findByPk(req.params.id, { include: Account });
    if (!customer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    res.json(customer);
  } catch (err) {
    console.error("❌ getCustomerById error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Thêm khách hàng mới (Admin tạo thủ công)
export async function createCustomer(req, res) {
  try {
    const { ho_ten, email, sdt, dia_chi, anh, diem, id_tk } = req.body;

    const newCustomer = await Customer.create({
      ho_ten, email, sdt, dia_chi, anh, diem, id_tk
    });

    res.status(201).json({ message: "Thêm khách hàng thành công", customer: newCustomer });
  } catch (err) {
    console.error("❌ createCustomer error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Cập nhật thông tin khách hàng
export async function updateCustomer(req, res) {
  try {
    const { ho_ten, email, sdt, dia_chi, anh, diem } = req.body;
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    await customer.update({ ho_ten, email, sdt, dia_chi, anh, diem });
    res.json({ message: "Cập nhật thành công", customer });
  } catch (err) {
    console.error("❌ updateCustomer error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Xóa khách hàng
export async function deleteCustomer(req, res) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    await customer.destroy();
    res.json({ message: "Xóa khách hàng thành công" });
  } catch (err) {
    console.error("❌ deleteCustomer error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
