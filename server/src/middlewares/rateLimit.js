import rateLimit from "express-rate-limit";

/**
 * ⏱️ Rate limiter cho login route
 * Giới hạn 5 lần đăng nhập sai trong 15 phút
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // tối đa 5 lần trong 15 phút
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
 * Giới hạn 300 requests mỗi 15 phút cho toàn bộ API
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // 300 request / 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
