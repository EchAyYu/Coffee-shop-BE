import Customer from "../models/Customer.js";
import Account from "../models/Account.js";

export async function getAllCustomers(req, res) {
  try {
    const customers = await Customer.findAll({ include: Account });
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

export async function getCustomerById(req, res) {
  try {
    const customer = await Customer.findByPk(req.params.id, { include: Account });
    if (!customer) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

export async function updateCustomer(req, res) {
  try {
    const { ho_ten, email, sdt, dia_chi } = req.body;
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: "Không tìm thấy" });

    await customer.update({ ho_ten, email, sdt, dia_chi });
    res.json({ message: "Cập nhật thành công", customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
