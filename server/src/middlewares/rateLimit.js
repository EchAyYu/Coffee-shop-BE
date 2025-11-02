import rateLimit from "express-rate-limit";
// 💡 1. Import config để kiểm tra môi trường
import { config } from "../config/config.js";

// 💡 2. Kiểm tra xem có phải môi trường dev không
const isDev = config.env === 'development';

// 💡 3. Đặt giới hạn động
const loginMaxRequests = isDev ? 1000 : 5; // 1000 cho dev, 5 cho production
const globalMaxRequests = isDev ? 10000 : 300; // 10000 cho dev, 300 cho production

if (isDev) {
  console.log("🟢 Rate limiters are relaxed for development (Dev Mode).");
}

/**
 * ⏱️ Rate limiter cho login route
 * Giới hạn 5 lần đăng nhập sai trong 15 phút (hoặc 1000 in dev)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: loginMaxRequests, // 💡 4. Sử dụng giới hạn động
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(
      `[⚠️ LOGIN LIMIT] IP ${req.ip} bị chặn tạm thời sau quá nhiều lần đăng nhập thất bại`
    );
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * 🌐 Rate limiter tổng thể
 * Giới hạn 300 requests mỗi 15 phút cho toàn bộ API (hoặc 10000 in dev)
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: globalMaxRequests, // 💡 5. Sử dụng giới hạn động
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
