// src/controllers/stats.controller.js
import db from "../models/index.js";
const { Order, Customer, Product, Reservation } = db;
import { Op, fn, col } from "sequelize";

export async function getStats(req, res) {
  try {
    // Tổng số khách hàng
    const totalCustomers = await Customer.count();

    // Tổng số sản phẩm
    const totalProducts = await Product.count();

    // Tổng số đơn hàng
    const totalOrders = await Order.count();

    // Tổng số đặt bàn
    const totalReservations = await Reservation.count();

    // Tổng doanh thu
    const totalRevenueResult = await Order.findAll({
      attributes: [[fn("SUM", col("tong_tien")), "totalRevenue"]],
      raw: true,
    });
    const totalRevenue = totalRevenueResult[0].totalRevenue || 0;

    // Doanh thu hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayRevenueResult = await Order.findAll({
      attributes: [[fn("SUM", col("tong_tien")), "todayRevenue"]],
      where: {
        ngay_dat: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
      raw: true,
    });
    const todayRevenue = todayRevenueResult[0].todayRevenue || 0;

    const totalReviews = await db.Review.count();

    // Điểm đánh giá trung bình (nếu có đánh giá)
    const avgRatingResult = await db.Review.findAll({
      attributes: [[fn("AVG", col("diem")), "avgRating"]],
      raw: true,
    });
    const avgRating = Number(avgRatingResult[0].avgRating || 0).toFixed(2);

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalProducts,
        totalOrders,
        totalReservations,
        totalRevenue,
        todayRevenue,
        totalReviews,
        avgRating,
      },
    });
  } catch (err) {
    console.error("❌ [getStats] error:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi thống kê" });
  }
}
