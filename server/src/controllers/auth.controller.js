import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { validationResult } from "express-validator";
import Account from "../models/Account.js";
import Customer from "../models/Customer.js";
import sequelize from "../utils/db.js";

dotenv.config();

const SECRET = process.env.JWT_SECRET || "secretkey";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refreshsecret";
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const REFRESH_COOKIE = "refresh_token";

// Helpers
const signAccessToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
const signRefreshToken = (payload) => jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

// Đăng ký (kèm kiểm tra trùng & transaction để tránh tạo dở)
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const t = await sequelize.transaction();
  try {
    const { ten_dn, mat_khau, ho_ten, email, sdt, dia_chi } = req.body;

    const existedUser = await Account.findOne({ where: { ten_dn }, transaction: t });
    if (existedUser) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại" });
    }

    if (email) {
      const existedEmail = await Customer.findOne({ where: { email }, transaction: t });
      if (existedEmail) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
      }
    }

    const hash = await bcrypt.hash(mat_khau, 10);
    const account = await Account.create({ ten_dn, mat_khau: hash, role: "customer" }, { transaction: t });

    await Customer.create(
      {
        ho_ten: ho_ten || "Khách hàng",
        email: email || null,
        sdt: sdt || null,
        dia_chi: dia_chi || null,
        id_tk: account.id_tk,
      },
      { transaction: t }
    );

    await t.commit();
    res.status(201).json({ success: true, message: "Đăng ký thành công" });
  } catch (err) {
    await t.rollback();
    const o = err?.original || err?.parent || err;
    console.error("❌ register error:", { message: err?.message, sqlMessage: o?.sqlMessage, sql: o?.sql });
    if (o?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Tên đăng nhập hoặc email đã tồn tại" });
    }
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// Đăng nhập
export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { ten_dn, mat_khau } = req.body;
    const acc = await Account.findOne({ where: { ten_dn } });
    if (!acc) return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });

    const ok = await bcrypt.compare(mat_khau, acc.mat_khau);
    if (!ok) return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });

    const user = { id_tk: acc.id_tk, role: acc.role, ten_dn: acc.ten_dn, email: acc.email };
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken({ id_tk: acc.id_tk });

    // set cookie httpOnly cho refresh
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Trả accessToken ở top-level để FE set ngay
    return res.json({ success: true, accessToken, user });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// Refresh token (đọc từ cookie)
export async function refreshToken(req, res) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ success: false, message: "Thiếu refresh token" });

    const decoded = jwt.verify(token, REFRESH_SECRET);
    const acc = await Account.findByPk(decoded.id_tk);
    if (!acc) return res.status(401).json({ success: false, message: "Tài khoản không tồn tại" });

    const user = { id_tk: acc.id_tk, role: acc.role, ten_dn: acc.ten_dn, email: acc.email };
    const accessToken = signAccessToken(user);
    return res.json({ success: true, accessToken });
  } catch (err) {
    console.error("[refresh]", err);
    res.status(401).json({ success: false, message: "Refresh token không hợp lệ hoặc hết hạn" });
  }
}

export async function me(req, res) {
  try {
    const account = await Account.findByPk(req.user.id_tk, {
      attributes: ["id_tk", "ten_dn", "role", "email"],
      include: { model: Customer, attributes: ["id_kh", "ho_ten", "email", "sdt", "dia_chi", "anh", "diem"] },
    });
    if (!account) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    res.json({ success: true, data: account });
  } catch (err) {
    console.error("❌ me error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  try {
    const account = await Account.findByPk(req.user.id_tk);
    if (!account) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });

    const match = await bcrypt.compare(oldPassword, account.mat_khau);
    if (!match) return res.status(400).json({ success: false, message: "Mật khẩu cũ không đúng" });

    const hash = await bcrypt.hash(newPassword, 10);
    await account.update({ mat_khau: hash });
    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("❌ changePassword error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

export async function logout(_req, res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  return res.json({ success: true, message: "Đăng xuất thành công" });
}
