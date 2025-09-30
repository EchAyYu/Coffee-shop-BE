import jwt from "jsonwebtoken";
import Account from "../models/Account.js";

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

// Middleware chỉ cho phép Admin
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Bạn không có quyền admin" });
  }
  next();
}

export function authMiddleware(req, res, next) {
  // Dummy authentication logic
  next();
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    // Dummy role authorization logic
    next();
  };
}
