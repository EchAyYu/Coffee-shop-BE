// src/controllers/employees.controller.js
import Account from "../models/Account.js";
import bcrypt from "bcryptjs";

// Lấy tất cả nhân viên
export async function getAllEmployees(req, res) {
  try {
    // Chỉ tìm các tài khoản có role là 'employee'
    // attributes: { exclude: ['mat_khau'] } -> TUYỆT ĐỐI không bao giờ trả mật khẩu về client
    const employees = await Account.findAll({
      where: { role: "employee" },
      attributes: { exclude: ["mat_khau"] },
    });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Lấy 1 nhân viên theo id
export async function getEmployeeById(req, res) {
  try {
    const employee = await Account.findOne({
      where: { id_tk: req.params.id, role: "employee" },
      attributes: { exclude: ["mat_khau"] },
    });

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhân viên" });
    }
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Thêm nhân viên
export async function createEmployee(req, res) {
  try {
    const { ten_dn, mat_khau } = req.body;

    // (Validation chi tiết sẽ nằm ở file route)
    if (!ten_dn || !mat_khau) {
      return res.status(400).json({ message: "Tên đăng nhập và mật khẩu là bắt buộc" });
    }

    // Kiểm tra tên đăng nhập đã tồn tại chưa
    const existedUser = await Account.findOne({ where: { ten_dn } });
    if (existedUser) {
      return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
    }

    // Mã hóa mật khẩu
    const hash = await bcrypt.hash(mat_khau, 10);

    // Tạo tài khoản mới với role 'employee'
    const newEmployee = await Account.create({
      ten_dn,
      mat_khau: hash,
      role: "employee",
    });

    // Tạo object an toàn để trả về (không có mật khẩu)
    const safeEmployee = {
        id_tk: newEmployee.id_tk,
        ten_dn: newEmployee.ten_dn,
        role: newEmployee.role
    };

    res.status(201).json(safeEmployee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Cập nhật nhân viên (chủ yếu là reset mật khẩu)
export async function updateEmployee(req, res) {
  try {
    const { ten_dn, mat_khau } = req.body;

    const employee = await Account.findOne({
      where: { id_tk: req.params.id, role: "employee" },
    });

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhân viên" });
    }

    const updateData = {};

    // Nếu có cập nhật tên đăng nhập
    if (ten_dn && ten_dn !== employee.ten_dn) {
        // Kiểm tra ten_dn mới có bị trùng không
        const existed = await Account.findOne({ where: { ten_dn } });
        if (existed) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
        updateData.ten_dn = ten_dn;
    }

    // Nếu có cập nhật mật khẩu (reset)
    if (mat_khau) {
      updateData.mat_khau = await bcrypt.hash(mat_khau, 10);
    }

    await employee.update(updateData);

    // Trả về thông tin đã cập nhật (không có mật khẩu)
    const safeEmployee = {
        id_tk: employee.id_tk,
        ten_dn: employee.ten_dn,
        role: employee.role
    };
    res.json(safeEmployee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Xóa nhân viên
export async function deleteEmployee(req, res) {
  try {
    const employee = await Account.findOne({
      where: { id_tk: req.params.id, role: "employee" },
    });

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhân viên" });
    }

    await employee.destroy();
    res.json({ message: "Đã xóa tài khoản nhân viên" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}