// ================================
// 🔒 Authentication Middleware (final optimized)
// ================================

import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

const ACCESS_SECRET = process.env.JWT_SECRET || "secretkey";

/**
 * 🔹 Lấy access token từ header Authorization hoặc cookie (fallback)
 * Ưu tiên Authorization: Bearer <token>
 */
function getAccessToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;

  // Fallback: cookie (chỉ nếu bạn lưu access_token vào cookie)
  const cookieToken = req.cookies?.access_token;
  return cookieToken || null;
}

/**
 * 🔹 Chuẩn hoá role
 */
function normalizeRole(role, fallback = "user") {
  if (!role) return fallback;
  return String(role).toLowerCase();
}

/**
 * 🔹 Xây dựng đối tượng user chuẩn cho req.user
 */
function buildReqUser(acc, payload) {
  const id = acc?.id_tk ?? acc?.id ?? payload?.id_tk ?? payload?.id ?? payload?.userId ?? null;
  const role = normalizeRole(acc?.role ?? payload?.role, "user");
  const username = acc?.ten_dn ?? payload?.ten_dn ?? acc?.username ?? payload?.username ?? null;
  const email = acc?.email ?? payload?.email ?? null;

  return { id, role, username, email };
}

/**
 * 🧩 Middleware: Kiểm tra access token & xác minh tài khoản
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

    // ✅ Verify access token
    const payload = jwt.verify(token, ACCESS_SECRET);

    // Lấy ID từ payload
    const userId = payload?.id_tk ?? payload?.id ?? payload?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ (thiếu id)",
      });
    }

    // ✅ Kiểm tra tài khoản trong DB
    const acc =
      (await Account.findByPk(userId)) ||
      (await Account.findOne({ where: { id_tk: userId } }));

    if (!acc) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại hoặc đã bị xóa",
      });
    }

    // ✅ Gán user vào req
    req.user = buildReqUser(acc, payload);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token đã hết hạn. FE sẽ tự refresh lại.",
        expired: true,
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    console.error("[Auth Middleware Error]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi xác thực nội bộ",
    });
  }
}

// Cho tương thích với code cũ
export const authMiddleware = requireAuth;

/**
 * 🧠 Middleware: Chỉ cho phép các vai trò cụ thể
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

/**
 * 🧩 Cho phép nhân viên hoặc admin (nội bộ)
 */
export function requireStaff(req, res, next) {
  if (!req.user?.role) {
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
  }
  const role = normalizeRole(req.user.role);
  if (!["admin", "employee", "staff"].includes(role)) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ nhân viên hoặc admin được truy cập" });
  }
  next();
}
