// ================================
// 🔒 Authentication Middleware
// ================================

import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

const SECRET = process.env.JWT_SECRET || "secretkey";

// 🔹 Lấy token từ header Authorization: Bearer <token>
function getToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * 🧩 Middleware yêu cầu đăng nhập
 * - Kiểm tra JWT
 * - Xác minh user tồn tại trong DB
 * - Gán req.user để các route khác sử dụng
 */
export async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token)
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập hoặc thiếu token",
      });

    const payload = jwt.verify(token, SECRET);

    // payload nên có: { id_tk, role, ten_dn, email, iat, exp }
    const acc = await Account.findByPk(payload.id_tk);
    if (!acc)
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });

    // Gắn thông tin user cho request
    req.user = {
      id_tk: acc.id_tk,
      role: acc.role?.toLowerCase() || "user",
      ten_dn: acc.ten_dn,
      email: acc.email,
    };

    next();
  } catch (err) {
    // Phân loại lỗi rõ ràng hơn
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
    return res
      .status(500)
      .json({ success: false, message: "Lỗi xác thực nội bộ" });
  }
}

// Cho tương thích với code cũ
export const authMiddleware = requireAuth;

/**
 * 🧠 Middleware cho phép chỉ định vai trò cụ thể (Admin / Employee / User)
 * @example router.get('/admin', authorizeRoles('admin'), handler)
 */
export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.role)
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

    const userRole = req.user.role?.toLowerCase();
    const allowed = roles.map((r) => r.toLowerCase());
    if (!allowed.includes(userRole)) {
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
  if (!req.user?.role)
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
  if (req.user.role.toLowerCase() !== "admin")
    return res.status(403).json({ success: false, message: "Chỉ Admin mới được truy cập" });

  next();
}

/**
 * 🧩 (Tùy chọn) Middleware yêu cầu Employee hoặc Admin
 * Dành cho các chức năng nội bộ như quản lý đơn hàng, kho,...
 */
export function requireStaff(req, res, next) {
  if (!req.user?.role)
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

  const allowedRoles = ["admin", "employee"];
  if (!allowedRoles.includes(req.user.role.toLowerCase())) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ nhân viên hoặc admin được truy cập" });
  }

  next();
}
