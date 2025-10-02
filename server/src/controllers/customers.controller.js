// server/src/controllers/customers.controller.js
import { Op } from "sequelize";
import Account from "../models/Account.js";
import Customer from "../models/Customer.js";

// GET /api/admin/customers?q=&page=&limit=
export async function getAllCustomers(req, res) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const where = {};

    if (q) {
      where[Op.or] = [
        { ho_ten: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { sdt: { [Op.like]: `%${q}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows, count } = await Customer.findAndCountAll({
      where,
      include: [
        {
          model: Account,
          attributes: ["id_tk", "ten_dn", "role"],
        },
      ],
      order: [["id_kh", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.json({
      total: count,
      page: Number(page),
      limit: Number(limit),
      data: rows,
    });
  } catch (e) {
    console.error("[getAllCustomers]", e);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/admin/customers/:id
export async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const customer = await Customer.findByPk(id, {
      include: [
        {
          model: Account,
          attributes: ["id_tk", "ten_dn", "role"],
        },
      ],
    });
    if (!customer) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(customer);
  } catch (e) {
    console.error("[getCustomerById]", e);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/admin/customers
export async function createCustomer(req, res) {
  try {
    const { ho_ten, sdt, email, dia_chi, id_tk } = req.body;
    const customer = await Customer.create({
      ho_ten,
      sdt,
      email,
      dia_chi,
      id_tk,
    });
    res
      .status(201)
      .json({ message: "Tạo khách hàng thành công", customer });
  } catch (err) {
    console.error("[createCustomer]", err);
    res.status(500).json({ message: "Lỗi tạo khách hàng", error: err.message });
  }
}

// PUT /api/admin/customers/:id
export async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const { ho_ten, sdt, email, dia_chi } = req.body;
    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
    await customer.update({ ho_ten, sdt, email, dia_chi });
    res.json({ message: "Cập nhật khách hàng thành công", customer });
  } catch (err) {
    console.error("[updateCustomer]", err);
    res.status(500).json({ message: "Lỗi cập nhật khách hàng", error: err.message });
  }
}

// DELETE /api/admin/customers/:id
export async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;
    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
    await customer.destroy();
    res.json({ message: "Đã xóa khách hàng thành công" });
  } catch (err) {
    console.error("[deleteCustomer]", err);
    res.status(500).json({ message: "Lỗi xóa khách hàng", error: err.message });
  }
}
