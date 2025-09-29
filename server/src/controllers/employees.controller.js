import Employee from "../models/Employee.js";
import Account from "../models/Account.js";

// Lấy tất cả nhân viên
export async function getAllEmployees(req, res) {
  try {
    const employees = await Employee.findAll({ include: Account });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Lấy 1 nhân viên theo ID
export async function getEmployeeById(req, res) {
  try {
    const emp = await Employee.findByPk(req.params.id, { include: Account });
    if (!emp) return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    res.json(emp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Tạo mới nhân viên
export async function createEmployee(req, res) {
  try {
    const { ten_nv, email, sdt, dia_chi, ngay_sinh, id_tk } = req.body;
    const emp = await Employee.create({ ten_nv, email, sdt, dia_chi, ngay_sinh, id_tk });
    res.json({ message: "Tạo nhân viên thành công", emp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Cập nhật nhân viên
export async function updateEmployee(req, res) {
  try {
    const emp = await Employee.findByPk(req.params.id);
    if (!emp) return res.status(404).json({ message: "Không tìm thấy" });

    const { ten_nv, email, sdt, dia_chi, ngay_sinh } = req.body;
    await emp.update({ ten_nv, email, sdt, dia_chi, ngay_sinh });
    res.json({ message: "Cập nhật thành công", emp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Xoá nhân viên
export async function deleteEmployee(req, res) {
  try {
    const emp = await Employee.findByPk(req.params.id);
    if (!emp) return res.status(404).json({ message: "Không tìm thấy" });

    await emp.destroy();
    res.json({ message: "Xoá thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
