// src/controllers/admin.stats.controller.js (VERSION 4 - NÂNG CẤP TUẦN/THÁNG)
import { Op, fn, col, literal } from "sequelize";
import sequelize from "../utils/db.js";
import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Reservation from "../models/Reservation.js";

import {
  getTodayRange,
  getPastDaysRange,
  getCurrentWeekRange,
  getCurrentMonthRange,
} from "../utils/dateRange.js";

// Trạng thái đơn hàng thành công (để tính doanh thu / top sản phẩm / top KH)
const SUCCESS_ORDER_STATUSES = ["completed", "done", "paid", "shipped", "confirmed"];

export const getAdminStats = async (req, res) => {
  try {
    const today = getTodayRange();
    const last7Days = getPastDaysRange(7);
    const currentWeek = getCurrentWeekRange();
    const currentMonth = getCurrentMonthRange();

    const [
      kpiResult,
      revenueOverTime,
      topSellingProducts,
      orderStatusDistribution,
      recentOrders,
      topCustomers,
      recentReservations,
      customerStats,
      newCustomersOverTime,

      // 🔹 MỚI: top theo tuần/tháng
      topSellingProductsWeek,
      topSellingProductsMonth,
      topCustomersWeek,
      topCustomersMonth,
    ] = await Promise.all([
      // 1. KPI Doanh thu & Đơn hàng
      Order.findOne({
        attributes: [
          [fn("SUM", col("tong_tien")), "totalRevenue"],
          [fn("COUNT", col("id_don")), "totalOrders"],
          [
            fn(
              "SUM",
              literal(
                `CASE WHEN trang_thai IN (${SUCCESS_ORDER_STATUSES.map(
                  (s) => `'${s}'`
                ).join(",")}) AND ngay_dat BETWEEN '${today.start.toISOString()}' AND '${today.end.toISOString()}' THEN tong_tien ELSE 0 END`
              )
            ),
            "todayRevenue",
          ],
          [
            fn(
              "COUNT",
              literal(
                `CASE WHEN ngay_dat BETWEEN '${today.start.toISOString()}' AND '${today.end.toISOString()}' THEN id_don ELSE NULL END`
              )
            ),
            "todayOrders",
          ],
        ],
        where: { trang_thai: SUCCESS_ORDER_STATUSES },
        raw: true,
      }),

      // 2. Biểu đồ Doanh thu 7 ngày
      Order.findAll({
        attributes: [
          [fn("DATE", col("ngay_dat")), "date"],
          [fn("SUM", col("tong_tien")), "revenue"],
        ],
        where: {
          trang_thai: SUCCESS_ORDER_STATUSES,
          ngay_dat: { [Op.gte]: last7Days.start },
        },
        group: [fn("DATE", col("ngay_dat"))],
        order: [[col("date"), "ASC"]],
        raw: true,
      }),

      // 3. Top 5 Sản phẩm (tổng)
      OrderDetail.findAll({
        attributes: [
          "id_mon",
          [fn("SUM", col("OrderDetail.so_luong")), "total_sold"],
        ],
        include: [
          { model: Product, attributes: ["ten_mon", "anh"] },
          { model: Order, attributes: [], where: { trang_thai: SUCCESS_ORDER_STATUSES } },
        ],
        group: ["OrderDetail.id_mon", "Product.id_mon", "Product.ten_mon", "Product.anh"],
        order: [[col("total_sold"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),

      // 4. Phân bố Đơn hàng
      Order.findAll({
        attributes: ["trang_thai", [fn("COUNT", col("id_don")), "count"]],
        group: ["trang_thai"],
        raw: true,
      }),

      // 5. Đơn hàng gần đây
      Order.findAll({
        limit: 5,
        order: [["ngay_dat", "DESC"]],
        attributes: ["id_don", "ho_ten_nhan", "tong_tien", "trang_thai", "ngay_dat"],
      }),

      // 6. Top 5 Khách hàng (tổng)
      Order.findAll({
        attributes: [
          "id_kh",
          [fn("SUM", col("tong_tien")), "total_spent"],
          [fn("COUNT", col("id_don")), "order_count"],
        ],
        where: {
          trang_thai: SUCCESS_ORDER_STATUSES,
          id_kh: { [Op.ne]: null },
        },
        include: [
          {
            model: Customer,
            attributes: ["id_kh", "ho_ten", "email", "anh"],
          },
        ],
        group: [
          "Order.id_kh",
          "Customer.id_kh",
          "Customer.ho_ten",
          "Customer.email",
          "Customer.anh",
        ],
        order: [[col("total_spent"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),

      // 7. Đặt bàn chờ
      Reservation.findAll({
        where: { trang_thai: "PENDING" },
        order: [["ngay_dat", "ASC"]],
        limit: 5,
      }),

      // 8. KPI Khách hàng
      Customer.findOne({
        attributes: [
          [fn("COUNT", col("id_kh")), "totalCustomers"],
          [
            fn(
              "COUNT",
              literal(
                `CASE WHEN ngay_tao BETWEEN '${today.start.toISOString()}' AND '${today.end.toISOString()}' THEN id_kh ELSE NULL END`
              )
            ),
            "todayCustomers",
          ],
        ],
        raw: true,
      }),

      // 9. Biểu đồ Khách hàng mới 7 ngày
      Customer.findAll({
        attributes: [
          [fn("DATE", col("ngay_tao")), "date"],
          [fn("COUNT", col("id_kh")), "count"],
        ],
        where: {
          ngay_tao: { [Op.gte]: last7Days.start },
        },
        group: [fn("DATE", col("ngay_tao"))],
        order: [[col("date"), "ASC"]],
        raw: true,
      }),

      // 10. 🔹 Top SP tuần này
      OrderDetail.findAll({
        attributes: [
          "id_mon",
          [fn("SUM", col("OrderDetail.so_luong")), "total_sold"],
        ],
        include: [
          { model: Product, attributes: ["ten_mon", "anh"] },
          {
            model: Order,
            attributes: [],
            where: {
              trang_thai: SUCCESS_ORDER_STATUSES,
              ngay_dat: { [Op.between]: [currentWeek.start, currentWeek.end] },
            },
          },
        ],
        group: ["OrderDetail.id_mon", "Product.id_mon", "Product.ten_mon", "Product.anh"],
        order: [[col("total_sold"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),

      // 11. 🔹 Top SP tháng này
      OrderDetail.findAll({
        attributes: [
          "id_mon",
          [fn("SUM", col("OrderDetail.so_luong")), "total_sold"],
        ],
        include: [
          { model: Product, attributes: ["ten_mon", "anh"] },
          {
            model: Order,
            attributes: [],
            where: {
              trang_thai: SUCCESS_ORDER_STATUSES,
              ngay_dat: { [Op.between]: [currentMonth.start, currentMonth.end] },
            },
          },
        ],
        group: ["OrderDetail.id_mon", "Product.id_mon", "Product.ten_mon", "Product.anh"],
        order: [[col("total_sold"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),

      // 12. 🔹 Top KH tuần này
      Order.findAll({
        attributes: [
          "id_kh",
          [fn("SUM", col("tong_tien")), "total_spent"],
          [fn("COUNT", col("id_don")), "order_count"],
        ],
        where: {
          trang_thai: SUCCESS_ORDER_STATUSES,
          id_kh: { [Op.ne]: null },
          ngay_dat: { [Op.between]: [currentWeek.start, currentWeek.end] },
        },
        include: [
          {
            model: Customer,
            attributes: ["id_kh", "ho_ten", "email", "anh"],
          },
        ],
        group: [
          "Order.id_kh",
          "Customer.id_kh",
          "Customer.ho_ten",
          "Customer.email",
          "Customer.anh",
        ],
        order: [[col("total_spent"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),

      // 13. 🔹 Top KH tháng này
      Order.findAll({
        attributes: [
          "id_kh",
          [fn("SUM", col("tong_tien")), "total_spent"],
          [fn("COUNT", col("id_don")), "order_count"],
        ],
        where: {
          trang_thai: SUCCESS_ORDER_STATUSES,
          id_kh: { [Op.ne]: null },
          ngay_dat: { [Op.between]: [currentMonth.start, currentMonth.end] },
        },
        include: [
          {
            model: Customer,
            attributes: ["id_kh", "ho_ten", "email", "anh"],
          },
        ],
        group: [
          "Order.id_kh",
          "Customer.id_kh",
          "Customer.ho_ten",
          "Customer.email",
          "Customer.anh",
        ],
        order: [[col("total_spent"), "DESC"]],
        limit: 5,
        subQuery: false,
      }),
    ]);

    const kpiCards = {
      totalRevenue: Number(kpiResult?.totalRevenue || 0),
      totalOrders: Number(kpiResult?.totalOrders || 0),
      todayRevenue: Number(kpiResult?.todayRevenue || 0),
      todayOrders: Number(kpiResult?.todayOrders || 0),
      totalCustomers: Number(customerStats?.totalCustomers || 0),
      todayCustomers: Number(customerStats?.todayCustomers || 0),
      pendingReservations: recentReservations.length,
    };

    res.json({
      success: true,
      data: {
        kpiCards,
        revenueOverTime,
        newCustomersOverTime,
        orderStatusDistribution,
        recentOrders,
        recentReservations,

        // Top tổng
        topSellingProducts,
        topCustomers,

        // 🔹 Top theo kỳ
        topSellingProductsWeek,
        topSellingProductsMonth,
        topCustomersWeek,
        topCustomersMonth,
      },
    });
  } catch (e) {
    console.error("Lỗi lấy dữ liệu thống kê:", e);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi lấy thống kê." });
  }
};
