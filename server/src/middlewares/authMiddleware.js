// src/middlewares/authMiddleware.js

import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

const ACCESS_SECRET = process.env.JWT_SECRET || "secretkey";

/**
 * Lấy access token từ header Authorization hoặc cookie
 */
function getAccessToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return req.cookies?.access_token || null;
}

/**
 * Chuẩn hoá role từ DB
 */
function normalizeRole(role) {
  if (!role) return "customer";
  const r = String(role).toLowerCase();
  if (r === "admin") return "admin";
  if (r === "employee" || r === "staff") return "employee";
  return "customer";
}

/**
 * Gắn req.user từ token (dùng bên trong các middleware khác)
 */
async function attachUserFromToken(req) {
  const token = getAccessToken(req);
  if (!token) {
    throw new Error("NO_TOKEN");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, ACCESS_SECRET);
  } catch (err) {
    throw new Error("INVALID_TOKEN");
  }

  // decoded có dạng: { id_tk, ten_dn, role, email, iat, exp }
  const id = decoded.id_tk || decoded.id;
  if (!id) {
    throw new Error("INVALID_PAYLOAD");
  }

  // Lấy lại account từ DB để chắc chắn role hiện tại
  const account = await Account.findByPk(id, {
    attributes: ["id_tk", "ten_dn", "role"],
  });

  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  req.user = {
    id_tk: account.id_tk,
    ten_dn: account.ten_dn,
    role: normalizeRole(account.role),
  };
}

/**
 * BẮT BUỘC đăng nhập
 */
export async function requireAuth(req, res, next) {
  try {
    await attachUserFromToken(req);
    return next();
  } catch (err) {
    if (err.message === "NO_TOKEN") {
      return res
        .status(401)
        .json({ success: false, message: "Bạn cần đăng nhập để tiếp tục" });
    }
    console.warn("[requireAuth] error:", err.message);
    return res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
}

/**
 * Chỉ cho phép các role nhất định
 */
export function authorizeRoles(...allowedRoles) {
  const allowed = allowedRoles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập" });
    }

    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền truy cập tài nguyên này" });
    }

    return next();
  };
}

/**
 * Chỉ admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.role) {
    return res
      .status(401)
      .json({ success: false, message: "Chưa đăng nhập" });
  }

  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ admin mới được truy cập" });
  }

  return next();
}

/**
 * Nếu có token thì gắn req.user, nếu không thì bỏ qua (dùng cho chatbot, khách vãng lai)
 */
export async function loadUserIfAuthenticated(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) {
      return next();
    }
    await attachUserFromToken(req);
  } catch (err) {
    console.warn(
      "[loadUserIfAuthenticated] Token không hợp lệ, xử lý như khách vãng lai."
    );
  }
  return next();
}

/**
 * ALIAS cho code cũ:
 * Trước đây bạn dùng `authMiddleware` → bây giờ map sang `requireAuth`
 * để không phải sửa hết các routes.
 */
export const authMiddleware = requireAuth;
