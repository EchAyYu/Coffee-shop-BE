import Account from "../models/Account.js";
import Employee from "../models/Employee.js"; // 💡 THÊM VÀO
import bcrypt from "bcryptjs";
import sequelize from "../utils/db.js"; // 💡 THÊM VÀO
import { Op } from "sequelize"; // 💡 THÊM VÀO (Cho hàm update)

// ===============================
// 🔹 Lấy tất cả nhân viên
// ===============================
export async function getAllEmployees(req, res) {
  try {
    // Lấy từ Employee và join Account
    const employees = await Employee.findAll({
      include: {
        model: Account,
        attributes: ["id_tk", "ten_dn", "role"], // Chỉ lấy thông tin cần thiết
      },
      attributes: { exclude: ["id_tk"] }, // Tránh trùng lặp id_tk
    });
    res.json({ success: true, data: employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Lấy 1 nhân viên theo id_nv
// ===============================
export async function getEmployeeById(req, res) {
  try {
    // Lấy từ Employee bằng id_nv
    const employee = await Employee.findOne({
      where: { id_nv: req.params.id },
      include: {
        model: Account,
        attributes: ["id_tk", "ten_dn", "role"],
      },
      attributes: { exclude: ["id_tk"] },
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên" });
    }
    res.json({ success: true, data: employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Thêm nhân viên
// ===============================
export async function createEmployee(req, res) {
  const t = await sequelize.transaction(); // Bắt đầu transaction
  try {
    const { ten_dn, mat_khau, ten_nv, email, sdt, dia_chi, ngay_sinh } = req.body;

    // 1. Kiểm tra ten_dn và email (nếu có)
    const existedUser = await Account.findOne({ where: { ten_dn }, transaction: t });
    if (existedUser) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại" });
    }
    if (email) {
      const existedEmail = await Employee.findOne({ where: { email }, transaction: t });
      if (existedEmail) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
      }
    }

    // 2. Mã hóa mật khẩu
    const hash = await bcrypt.hash(mat_khau, 10);

    // 3. Tạo tài khoản (Account)
    const newAccount = await Account.create({
      ten_dn,
      mat_khau: hash,
      role: "employee",
    }, { transaction: t });

    // 4. Tạo thông tin nhân viên (Employee)
    const newEmployee = await Employee.create({
      ten_nv,
      email: email || null,
      sdt: sdt || null,
      dia_chi: dia_chi || null,
      ngay_sinh: ngay_sinh || null,
      id_tk: newAccount.id_tk, // Liên kết với tài khoản vừa tạo
    }, { transaction: t });
    
    // 5. Hoàn tất
    await t.commit();

    // 6. Trả về thông tin đầy đủ (không có mật khẩu)
    const result = {
      ...newEmployee.toJSON(),
      Account: {
        id_tk: newAccount.id_tk,
        ten_dn: newAccount.ten_dn,
        role: newAccount.role,
      }
    };

    res.status(201).json({ success: true, data: result, message: "Tạo tài khoản nhân viên thành công" });
  } catch (err) {
    await t.rollback(); // Hoàn tác nếu có lỗi
    console.error("Lỗi tạo nhân viên:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Cập nhật nhân viên (Thông tin cá nhân)
// ===============================
export async function updateEmployee(req, res) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // 💡 Lấy id (là id_nv) từ params
    const { ten_nv, email, sdt, dia_chi, ngay_sinh } = req.body;

    // 1. Tìm nhân viên bằng id_nv
    const employee = await Employee.findByPk(id, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên" });
    }

    // 2. Kiểm tra email (nếu có thay đổi)
    if (email && email !== employee.email) {
      const existedEmail = await Employee.findOne({ 
        where: { email, id_nv: { [Op.ne]: id } }, // Tìm email khác với id hiện tại
        transaction: t 
      });
      if (existedEmail) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
      }
    }

    // 3. Cập nhật thông tin Employee
    await employee.update({
      ten_nv,
      email: email || null,
      sdt: sdt || null,
      dia_chi: dia_chi || null,
      ngay_sinh: ngay_sinh || null,
    }, { transaction: t });

    await t.commit();

    // 4. Trả về dữ liệu nhân viên đã cập nhật (join với Account)
    const updatedEmployee = await Employee.findByPk(id, {
      include: {
        model: Account,
        attributes: ["id_tk", "ten_dn", "role"],
      },
      attributes: { exclude: ["id_tk"] },
    });

    res.json({ success: true, data: updatedEmployee, message: "Cập nhật thông tin thành công" });

  } catch (err) {
    await t.rollback();
    console.error("Lỗi cập nhật nhân viên:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Xóa nhân viên
// ===============================
export async function deleteEmployee(req, res) {
  const t = await sequelize.transaction();
  try {
    // 1. Tìm Employee bằng id_nv
    const employee = await Employee.findByPk(req.params.id, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên" });
    }
    
    const accountId = employee.id_tk;
    
    // 2. Xóa Employee
    await employee.destroy({ transaction: t });
    
    // 3. Xóa Account liên kết
    await Account.destroy({ where: { id_tk: accountId }, transaction: t });

    await t.commit();
    res.json({ success: true, message: "Đã xóa nhân viên và tài khoản liên kết" });
  } catch (err) {
    await t.rollback();
    console.error("Lỗi xóa nhân viên:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}