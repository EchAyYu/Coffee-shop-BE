import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { validationResult } from "express-validator";
import Account from "../models/Account.js";
import Customer from "../models/Customer.js";

dotenv.config();

const SECRET = process.env.JWT_SECRET || "secretkey";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refreshsecret";
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "1d";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

// ============================
// 🧠 Helpers
// ============================
function signAccessToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

// ============================
// 🟢 Đăng ký
// ============================
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { ten_dn, mat_khau, ho_ten, email, sdt, dia_chi } = req.body;

    const exist = await Account.findOne({ where: { ten_dn } });
    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập đã tồn tại",
      });
    }

    const hash = await bcrypt.hash(mat_khau, 10);

    const account = await Account.create({
      ten_dn,
      mat_khau: hash,
      role: "customer",
    });

    await Customer.create({
      ho_ten,
      email,
      sdt,
      dia_chi,
      id_tk: account.id_tk,
    });

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      data: {
        id_tk: account.id_tk,
        ten_dn: account.ten_dn,
        role: account.role,
      },
    });
  } catch (err) {
    console.error("❌ register error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================
// 🟢 Đăng nhập
// ============================
export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { ten_dn, mat_khau } = req.body;

    const acc = await Account.findOne({ where: { ten_dn } });
    if (!acc)
      return res
        .status(401)
        .json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });

    const ok = await bcrypt.compare(mat_khau, acc.mat_khau);
    if (!ok)
      return res
        .status(401)
        .json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });

    const accessToken = signAccessToken({
      id_tk: acc.id_tk,
      role: acc.role,
      ten_dn: acc.ten_dn,
    });
    const refreshToken = signRefreshToken({
      id_tk: acc.id_tk,
      role: acc.role,
    });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        accessToken,
        refreshToken,
        user: {
          id_tk: acc.id_tk,
          ten_dn: acc.ten_dn,
          role: acc.role,
        },
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================
// 🟢 Refresh Token
// ============================
export async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res
      .status(400)
      .json({ success: false, message: "Thiếu refreshToken" });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);

    const acc = await Account.findByPk(payload.id_tk);
    if (!acc)
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });

    const newAccessToken = signAccessToken({
      id_tk: acc.id_tk,
      role: acc.role,
      ten_dn: acc.ten_dn,
    });

    return res.json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (err) {
    console.error("[refresh]", err);
    res.status(401).json({ success: false, message: "Refresh token không hợp lệ hoặc hết hạn" });
  }
}

// ============================
// 🟢 Lấy thông tin tài khoản từ token
// ============================
export async function me(req, res) {
  try {
    const account = await Account.findByPk(req.user.id_tk, {
      attributes: ["id_tk", "ten_dn", "role"],
      include: {
        model: Customer,
        attributes: ["id_kh", "ho_ten", "email", "sdt", "dia_chi", "anh", "diem"],
      },
    });

    if (!account)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });

    res.json({ success: true, data: account });
  } catch (err) {
    console.error("❌ me error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================
// 🟢 Đổi mật khẩu
// ============================
export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  try {
    const account = await Account.findByPk(req.user.id_tk);
    if (!account)
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });

    const match = await bcrypt.compare(oldPassword, account.mat_khau);
    if (!match)
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không đúng" });

    const hash = await bcrypt.hash(newPassword, 10);
    await account.update({ mat_khau: hash });

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("❌ changePassword error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// ============================
// 🟢 Đăng xuất
// ============================
export async function logout(req, res) {
  // Nếu sau này bạn lưu refreshToken trong DB, có thể xóa ở đây
  res.json({ success: true, message: "Đăng xuất thành công" });
}
