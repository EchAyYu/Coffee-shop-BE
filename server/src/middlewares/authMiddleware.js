// server/src/middlewares/authMiddleware.js
import Account from "../models/Account.js";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "secretkey";

// Lấy token từ header Authorization: Bearer <token>
function getToken(req) {
  const h = req.headers.authorization || "";
  const [scheme, token] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

// Bắt buộc đăng nhập
export async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

    const payload = jwt.verify(token, SECRET);
    // payload nên chứa: { id_tk, role, ten_dn, iat, exp }
    const acc = await Account.findByPk(payload.id_tk);
    if (!acc) return res.status(401).json({ message: "Tài khoản không tồn tại" });

    req.user = { id_tk: acc.id_tk, role: acc.role, ten_dn: acc.ten_dn, email: acc.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

// Cho tương thích code cũ
export const authMiddleware = requireAuth;

// Yêu cầu có 1 trong các vai trò
export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: "Chưa đăng nhập" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    next();
  };
}

// Chỉ admin
export function requireAdmin(req, res, next) {
  if (!req.user?.role) return res.status(401).json({ message: "Chưa đăng nhập" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Chỉ admin" });
  next();
}
