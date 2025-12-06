// src/routes/admin.export.js
import express from "express";
import { Op } from "sequelize";

// ❗ CHÚ Ý: nếu tên file model của bạn khác (Order.js, DonHang.js, ...)
// thì đổi lại cho đúng đường dẫn & tên import nhé
import Order from "../models/Orders.js";
import Reservation from "../models/Reservations.js";
import Table from "../models/Tables.js";

const router = express.Router();

// =====================
// 🔧 Helper: Tính khoảng thời gian theo "week" | "month"
// =====================
function getPeriodRange(period = "month") {
  const now = new Date();
  let start, end;

  if (period === "week") {
    // Tuần hiện tại (Thứ 2 -> Chủ nhật)
    const day = now.getDay(); // 0: CN, 1: T2, ...
    const diffToMonday = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    // Tháng hiện tại
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
}

// Helper escape CSV
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// =====================
// 📦 GET /admin/orders/export
// =====================
router.get("/orders/export", async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const { start, end } = getPeriodRange(period);

    const orders = await Order.findAll({
      where: {
        ngay_dat: {
          [Op.between]: [start, end],
        },
      },
      order: [["ngay_dat", "ASC"]],
    });

    // Header CSV
    let csv = [
      "ID đơn hàng",
      "Ngày đặt",
      "Tổng tiền",
      "Trạng thái",
      "Họ tên nhận",
      "SĐT nhận",
      "Địa chỉ nhận",
      "Phương thức thanh toán",
    ].join(",") + "\n";

    for (const o of orders) {
      csv += [
        csvEscape(o.id_don),
        csvEscape(
          o.ngay_dat
            ? new Date(o.ngay_dat).toLocaleString("vi-VN")
            : ""
        ),
        csvEscape(o.tong_tien),
        csvEscape(o.trang_thai),
        csvEscape(o.ho_ten_nhan),
        csvEscape(o.sdt_nhan),
        csvEscape(o.dia_chi_nhan),
        csvEscape(o.phuong_thuc_tt),
      ].join(",") + "\n";
    }

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders_${period}_${today}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("❌ Lỗi export orders:", err);
    return res.status(500).json({
      message: "Không thể export đơn hàng",
      error: err.message || String(err),
    });
  }
});

// =====================
// 📅 GET /admin/reservations/export
// =====================
router.get("/reservations/export", async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const { start, end } = getPeriodRange(period);

    const reservations = await Reservation.findAll({
      where: {
        ngay_dat: {
          [Op.between]: [start, end],
        },
      },
      include: [
        {
          model: Table,
          as: "Table",
          required: false,
        },
      ],
      order: [["ngay_dat", "ASC"]],
    });

    // Header CSV
    let csv = [
      "ID đặt bàn",
      "Họ tên",
      "SĐT",
      "Ngày đặt",
      "Giờ đặt",
      "Số người",
      "Bàn",
      "Trạng thái",
      "Ghi chú",
    ].join(",") + "\n";

    for (const r of reservations) {
      const tableName =
        r.Table?.ten_ban || r.Table?.so_ban || "";

      csv += [
        csvEscape(r.id_datban),
        csvEscape(r.ho_ten),
        csvEscape(r.sdt),
        csvEscape(
          r.ngay_dat
            ? new Date(r.ngay_dat).toLocaleDateString("vi-VN")
            : ""
        ),
        csvEscape(r.gio_dat),
        csvEscape(r.so_nguoi),
        csvEscape(tableName),
        csvEscape(r.trang_thai),
        csvEscape(r.ghi_chu),
      ].join(",") + "\n";
    }

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reservations_${period}_${today}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error("❌ Lỗi export reservations:", err);
    return res.status(500).json({
      message: "Không thể export đặt bàn",
      error: err.message || String(err),
    });
  }
});

export default router;
