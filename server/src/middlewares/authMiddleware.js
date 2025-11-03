// src/middlewares/authMiddleware.js (ĐÃ CẬP NHẬT)

import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

const ACCESS_SECRET = process.env.JWT_SECRET || "secretkey";

/**
 * 🔹 Lấy token từ header Authorization hoặc cookie
 */
function getAccessToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return req.cookies?.access_token || null;
}

/**
 * 🔹 Chuẩn hóa role
 */
function normalizeRole(role, fallback = "user") {
  if (!role) return fallback;
  return String(role).toLowerCase();
}

/**
 * 🧠 Middleware xác thực người dùng (ASYNC)
 */
export async function requireAuth(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const decoded = jwt.verify(token, ACCESS_SECRET);
    const id_tk = decoded.id_tk || decoded.id;

    const account = await Account.findByPk(id_tk);
    if (!account) {
      return res.status(401).json({ success: false, message: "Tài khoản không tồn tại" });
    }

    req.user = {
      id_tk: account.id_tk,
      ten_dn: account.ten_dn,
      role: normalizeRole(account.role),
    };

    next();
  } catch (err) {
    console.error("[requireAuth]", err);
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc hết hạn" });
  }
}

export const authMiddleware = requireAuth;

/**
 * 🧩 Cho phép các vai trò cụ thể
 */
export function authorizeRoles(...roles) {
  const allowed = roles.map((r) => normalizeRole(r));
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
 * 🧱 Chỉ Admin
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

// ===== 💡 PHẦN MỚI THÊM VÀO (QUAN TRỌNG) =====
/**
 * 👤 Middleware tùy chọn: Tải người dùng nếu đã đăng nhập,
 * nhưng không báo lỗi nếu là khách.
 */
export async function loadUserIfAuthenticated(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) {
      return next(); // Không có token, tiếp tục (req.user sẽ là undefined)
    }

    const decoded = jwt.verify(token, ACCESS_SECRET);
    const id_tk = decoded.id_tk || decoded.id;

    const account = await Account.findByPk(id_tk);
    if (account) {
      // Đính kèm thông tin user vào request
      req.user = {
        id_tk: account.id_tk,
        ten_dn: account.ten_dn,
        role: normalizeRole(account.role),
      };
    }
  } catch (err) {
    // Token lỗi, hết hạn... Bỏ qua lỗi và không đính kèm req.user
    console.warn("[loadUserIfAuthenticated] Token không hợp lệ, xử lý như khách vãng lai.");
  }
  // Luôn luôn đi tiếp
  return next();
}
// ===== KẾT THÚC PHẦN MỚI =====