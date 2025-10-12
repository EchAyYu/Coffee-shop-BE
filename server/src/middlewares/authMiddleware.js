// ================================
// 🔒 Authentication Middleware (updated)
// ================================

import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

const ACCESS_SECRET = process.env.JWT_SECRET || "secretkey";

// 🔹 Lấy access token từ header Bearer (ưu tiên) hoặc cookie (fallback)
function getAccessToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;

  // Fallback: cho phép đọc từ cookie nếu bạn muốn lưu access token ở cookie
  // (Hiện tại hệ thống dùng refresh ở cookie /auth/refresh, còn access qua header)
  const cookieToken = req.cookies?.access_token;
  if (cookieToken) return cookieToken;

  return null;
}

// Chuẩn hoá role về lowercase
function normalizeRole(role, fallback = "user") {
  if (!role) return fallback;
  return String(role).toLowerCase();
}

// Chuẩn hoá object user đính kèm vào req
function buildReqUser(acc, payload) {
  const idFromAcc = acc?.id ?? acc?.id_tk;
  const roleFromAcc = acc?.role;
  const usernameFromAcc = acc?.ten_dn ?? acc?.username ?? acc?.name;
  const emailFromAcc = acc?.email;

  const idFromPayload = payload?.id ?? payload?.id_tk ?? payload?.userId;

  return {
    id: idFromAcc ?? idFromPayload ?? null,
    role: normalizeRole(roleFromAcc ?? payload?.role, "user"),
    username: usernameFromAcc ?? payload?.ten_dn ?? null,
    email: emailFromAcc ?? payload?.email ?? null,
  };
}

/**
 * 🧩 Middleware yêu cầu đăng nhập
 * - Kiểm tra JWT
 * - Xác minh user tồn tại trong DB
 * - Gán req.user = { id, role, username, email }
 */
export async function requireAuth(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập hoặc thiếu token",
      });
    }

    const payload = jwt.verify(token, ACCESS_SECRET);

    // payload có thể: { id } hoặc { id_tk, role, ten_dn, email, iat, exp }
    const userId = payload?.id ?? payload?.id_tk ?? payload?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Token không chứa thông tin người dùng hợp lệ",
      });
    }

    // Tìm tài khoản theo PK trước, nếu không thấy thì thử theo id_tk
    let acc = await Account.findByPk(userId);
    if (!acc && Account.findOne) {
      acc = await Account.findOne({ where: { id_tk: userId } });
    }
    if (!acc) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại",
      });
    }

    req.user = buildReqUser(acc, payload);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Token đã hết hạn, vui lòng đăng nhập lại" });
    }
    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ success: false, message: "Token không hợp lệ" });
    }
    console.error("[Auth Error]", err);
    return res.status(500).json({ success: false, message: "Lỗi xác thực nội bộ" });
  }
}

// Cho tương thích với code cũ
export const authMiddleware = requireAuth;

/**
 * 🧠 Middleware cho phép chỉ định vai trò cụ thể (Admin / Employee / User)
 * @example router.get('/admin', authorizeRoles('admin'), handler)
 */
export function authorizeRoles(...roles) {
  const allowed = roles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }
    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền truy cập tài nguyên này" });
    }
    next();
  };
}

/**
 * 🧱 Chỉ cho phép Admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user?.role) {
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
  }
  if (normalizeRole(req.user.role) !== "admin") {
    return res.status(403).json({ success: false, message: "Chỉ Admin mới được truy cập" });
  }
  next();
}

/**
 * 🧩 (Tuỳ chọn) Cho phép Employee hoặc Admin
 * Dùng cho các chức năng nội bộ (quản lý đơn hàng, kho,...)
 */
export function requireStaff(req, res, next) {
  if (!req.user?.role) {
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
  }
  const role = normalizeRole(req.user.role);
  if (!["admin", "employee"].includes(role)) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ nhân viên hoặc admin được truy cập" });
  }
  next();
}
