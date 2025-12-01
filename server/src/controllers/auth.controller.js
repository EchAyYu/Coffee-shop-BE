// ===============================
// ☕ Coffee Shop Backend - Auth Controller (Hoàn chỉnh)
// ===============================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { validationResult } from "express-validator";
import Account from "../models/Account.js";
import Customer from "../models/Customer.js";
import sequelize from "../utils/db.js";
import { composeFullAddress } from "../utils/address.js";
// 💡 IMPORT HÀM MỚI:
import { grantWelcomeVoucherForNewUser } from "./voucher.controller.js";

dotenv.config();

// ======== ENV CONFIG =========
const SECRET = process.env.JWT_SECRET || "secretkey";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refreshsecret";
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const REFRESH_COOKIE = "refresh_token";
const NODE_ENV = process.env.NODE_ENV || "development";

// ======== HELPERS =========
const signAccessToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

// ===============================
// 🔹 Đăng ký
// ===============================
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ success: false, errors: errors.array() });

  const t = await sequelize.transaction();
  try {
    const {
      ten_dn,
      mat_khau,
      ho_ten,
      email,
      sdt,
      dia_chi,
      street,
      ward,
      district,
      province,
    } = req.body;

    const existedUser = await Account.findOne({
      where: { ten_dn },
      transaction: t,
    });
    if (existedUser) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Tên đăng nhập đã tồn tại" });
    }

    if (email) {
      const existedEmail = await Customer.findOne({
        where: { email },
        transaction: t,
      });
      if (existedEmail) {
        await t.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Email đã được sử dụng" });
      }
    }

    const hash = await bcrypt.hash(mat_khau, 10);
    const account = await Account.create(
      { ten_dn, mat_khau: hash, role: "customer" },
      { transaction: t }
    );

    const _province = province || "Cần Thơ";
    const fullAddress =
      street || ward || district || province
        ? composeFullAddress({ street, ward, district, province: _province })
        : dia_chi || null;

    await Customer.create(
      {
        ho_ten: ho_ten || "Khách hàng",
        email: email || null,
        sdt: sdt || null,
        dia_chi: fullAddress, // luôn lưu chuỗi tổng hợp để tương thích chỗ cũ
        street: street || null,
        ward: ward || null,
        district: district || null,
        province: _province,
        id_tk: account.id_tk,
      },
      { transaction: t }
    );

    await t.commit();

    // 🎁 Sau khi đăng ký thành công -> cấp voucher chào mừng
    // Không cần await cũng được, để không làm chậm response
    grantWelcomeVoucherForNewUser(account.id_tk);

    return res
      .status(201)
      .json({ success: true, message: "Đăng ký thành công" });
  } catch (err) {
    await t.rollback();
    const o = err?.original || err?.parent || err;
    console.error("❌ register error:", {
      message: err?.message,
      sqlMessage: o?.sqlMessage,
    });
    if (o?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập hoặc email đã tồn tại",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Đăng nhập
// ===============================
export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res
      .status(400)
      .json({ success: false, errors: errors.array() });

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

    const user = {
      id_tk: acc.id_tk,
      role: acc.role,
      ten_dn: acc.ten_dn,
      email: acc.email,
    };

    // Sinh token
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken({ id_tk: acc.id_tk });

    // ✅ Set refresh token cookie httpOnly
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === "production", // secure khi deploy
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    console.log(`✅ User ${ten_dn} đăng nhập (${acc.role})`);

    // ✅ FE cần accessToken trong body
    return res.json({
      success: true,
      data: {
        accessToken,
        user,
      },
    });
  } catch (err) {
    console.error("❌ login error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Refresh token
// ===============================
export async function refreshToken(req, res) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Thiếu refresh token" });

    const decoded = jwt.verify(token, REFRESH_SECRET);
    const acc = await Account.findByPk(decoded.id_tk);
    if (!acc)
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });

    const user = {
      id_tk: acc.id_tk,
      role: acc.role,
      ten_dn: acc.ten_dn,
      email: acc.email,
    };
    const accessToken = signAccessToken(user);

    console.log(
      `♻️ Refresh token cấp lại access token cho ${acc.ten_dn}`
    );

    return res.json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    console.error("❌ refresh error:", err);
    return res.status(401).json({
      success: false,
      message: "Refresh token không hợp lệ hoặc hết hạn",
    });
  }
}

// ===============================
// 🔹 Lấy thông tin người dùng
// ===============================
export async function me(req, res) {
  try {
    console.log("📥 req.user:", req.user);

    const account = await Account.findByPk(req.user.id_tk || req.user.id, {
      attributes: ["id_tk", "ten_dn", "role"],
    });

    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    if (account.role === "admin" || account.role === "employee") {
      return res.json({ success: true, data: account });
    }

    const customer = await Customer.findOne({
      where: { id_tk: req.user.id_tk || req.user.id },
      attributes: [
        "id_kh",
        "ho_ten",
        "email",
        "sdt",
        "dia_chi",
        "anh",
        "diem",
      ],
    });

    return res.json({
      success: true,
      data: {
        ...account.toJSON(),
        customer: customer || null,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi /auth/me:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin tài khoản",
    });
  }
}

// ===============================
// 🔹 Đổi mật khẩu
// ===============================
export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  try {
    const account = await Account.findByPk(req.user.id_tk);
    if (!account)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });

    const match = await bcrypt.compare(oldPassword, account.mat_khau);
    if (!match)
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu cũ không đúng" });

    const hash = await bcrypt.hash(newPassword, 10);
    await account.update({ mat_khau: hash });
    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (err) {
    console.error("❌ changePassword error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server" });
  }
}

// ===============================
// 🔹 Đăng xuất
// ===============================
export async function logout(_req, res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  console.log("👋 User logged out, refresh token cleared");
  return res.json({
    success: true,
    message: "Đăng xuất thành công",
  });
}

// ===============================
// 🆕 BỔ SUNG: QUÊN MẬT KHẨU (OTP SIMULATION)
// ===============================

// Lưu OTP tạm thời trong RAM: Map<sdt, { code, expires, id_tk }>
const otpStore = new Map();

// 1. Gửi OTP (Giả lập)
export async function forgotPassword(req, res) {
  try {
    const { sdt } = req.body;

    // Tìm khách hàng theo SĐT
    const customer = await Customer.findOne({ where: { sdt } });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Số điện thoại chưa được đăng ký",
      });
    }

    // Tạo mã OTP ngẫu nhiên 6 số
    const otpCode = Math.floor(100000 + Math.random() * 900000)
      .toString();

    // Lưu vào RAM (hết hạn sau 5 phút)
    otpStore.set(sdt, {
      code: otpCode,
      expires: Date.now() + 5 * 60 * 1000, // 5 phút
      id_tk: customer.id_tk, // Lưu id_tk để lát đổi pass
    });

    console.log(`🔥 [SIMULATION] OTP cho ${sdt} là: ${otpCode}`);

    return res.json({
      success: true,
      message: "Mã OTP đã được gửi (Kiểm tra Console/Network)",
      // Trả về OTP luôn để test cho dễ (Production thì xóa dòng này)
      test_otp: otpCode,
    });
  } catch (err) {
    console.error("ForgotPassword Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server" });
  }
}

// 2. Xác nhận OTP và Đổi mật khẩu mới
export async function resetPasswordWithOtp(req, res) {
  try {
    const { sdt, otp, newPassword } = req.body;

    // Kiểm tra OTP trong RAM
    const storedData = otpStore.get(sdt);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu hết hạn hoặc SĐT không đúng",
      });
    }

    if (storedData.code !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Mã OTP không chính xác" });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(sdt);
      return res
        .status(400)
        .json({ success: false, message: "Mã OTP đã hết hạn" });
    }

    // OTP đúng -> Tiến hành đổi pass
    const account = await Account.findByPk(storedData.id_tk);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Tài khoản không tồn tại" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await account.update({ mat_khau: hash });

    // Xóa OTP sau khi dùng xong
    otpStore.delete(sdt);

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công! Hãy đăng nhập lại.",
    });
  } catch (err) {
    console.error("ResetPassword Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server" });
  }
}
