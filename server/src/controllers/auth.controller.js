import Account from "../models/Account.js";
import Customer from "../models/Customer.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const SECRET = process.env.JWT_SECRET || "secretkey";

// 🟢 Đăng ký (tạo Account + Customer)
export async function register(req, res) {
  try {
    const { ten_dn, mat_khau, ho_ten, email, sdt, dia_chi } = req.body;

    if (!ten_dn || !mat_khau) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    // Check username tồn tại chưa
    const exist = await Account.findOne({ where: { ten_dn } });
    if (exist) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });

    // Mã hóa mật khẩu
    const hash = await bcrypt.hash(mat_khau, 10);

    // Tạo tài khoản
    const account = await Account.create({
      ten_dn,
      mat_khau: hash,
      role: "customer",
    });

    // Tạo customer gắn với account
    const customer = await Customer.create({
      ho_ten,
      email,
      sdt,
      dia_chi,
      id_tk: account.id_tk,
    });

    res.status(201).json({
      message: "Đăng ký thành công",
      account: {
        id_tk: account.id_tk,
        ten_dn: account.ten_dn,
        role: account.role,
      },
      customer,
    });
  } catch (err) {
    console.error("❌ register error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// 🟢 Đăng nhập
export async function login(req, res) {
  try {
    const { ten_dn, mat_khau } = req.body;
    const acc = await Account.findOne({ where: { ten_dn } });
    if (!acc) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    const ok = await bcrypt.compare(mat_khau, acc.mat_khau);
    if (!ok) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });

    // Ký token
    const token = jwt.sign(
      { id_tk: acc.id_tk, role: acc.role, ten_dn: acc.ten_dn },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id_tk: acc.id_tk,
        ten_dn: acc.ten_dn,
        role: acc.role,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// 🟢 Lấy thông tin tài khoản từ token
export async function me(req, res) {
  try {
    const account = await Account.findByPk(req.user.id_tk, {
      attributes: ["id_tk", "ten_dn", "email", "role"],
      include: {
        model: Customer,
        attributes: ["id_kh", "ho_ten", "email", "sdt", "dia_chi", "anh", "diem"],
      },
    });
    if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    res.json(account);
  } catch (err) {
    console.error("❌ me error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// 🟢 Đổi mật khẩu
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const account = await Account.findByPk(req.user.id_tk);
    if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    const match = await bcrypt.compare(oldPassword, account.mat_khau);
    if (!match) return res.status(400).json({ message: "Mật khẩu cũ không đúng" });

    const hash = await bcrypt.hash(newPassword, 10);
    await account.update({ mat_khau: hash });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("❌ changePassword error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
