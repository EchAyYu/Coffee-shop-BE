// src/controllers/reservations.controller.js
// ================================
// ☕ Coffee Shop Backend - Reservations Controller (Updated)
// ================================
import Reservation from "../models/Reservation.js";
import Customer from "../models/Customer.js";
import Table from "../models/Table.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../socket.js";
import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";
import sequelize from "../utils/db.js";
import { Op, fn, col } from "sequelize";
import db from "../models/index.js";

import {
  getCurrentWeekRange,
  getCurrentMonthRange,
  // 💡 CẬP NHẬT: Thêm getCurrentYearRange cho chức năng export
  getCurrentYearRange, 
} from "../utils/dateRange.js";

// Helper: validate ngày / giờ
const isValidDateString = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str || "");
const isValidTimeString = (str) => /^\d{2}:\d{2}$/.test(str || "");

// 🔹 Các trạng thái được tính là "thành công" / "đã hủy" cho THỐNG KÊ đặt bàn
// ❗ Không thay đổi trạng thái bạn đang lưu trong DB.
const SUCCESS_RESERVATION_STATUSES = [
  "CONFIRMED",
  "DONE",
  "ARRIVED",
  "ĐÃ XÁC NHẬN",
  "ĐÃ HOÀN THÀNH",
];

const CANCELLED_RESERVATION_STATUSES = [
  "CANCELLED",
  "ĐÃ HỦY",
];

// 💡 --- Helper Function: Hàm gửi thông báo (Nội bộ) ---
async function sendReservationNotification(reservation, newStatusLabel) {
  try {
    if (!reservation.id_kh) return;

    const customer = await Customer.findByPk(reservation.id_kh);
    if (!customer || !customer.id_tk) return;

    const title = `Đặt bàn #${reservation.id_datban} ${newStatusLabel}`;
    const message = `Yêu cầu đặt bàn của bạn (ID: #${reservation.id_datban}) đã được ${newStatusLabel.toLowerCase()}.`;

    const newNotification = await Notification.create({
      id_tk: customer.id_tk,
      type: "reservation",
      title,
      message,
    });

    emitToUser(customer.id_tk, "new_notification", newNotification.toJSON());
    console.log(`[Socket] Đã gửi thông báo đặt bàn cho id_tk: ${customer.id_tk}`);
  } catch (e) {
    console.error("Lỗi khi gửi thông báo đặt bàn:", e.message);
  }
}

/**
 * 📅 Khách hàng tạo đặt bàn (VÀ ĐẶT MÓN TRƯỚC)
 */
export async function createReservation(req, res) {
  const t = await sequelize.transaction();

  try {
    const {
      ho_ten,
      sdt,
      ngay_dat,
      gio_dat,
      so_nguoi,
      ghi_chu,
      id_ban,
      items,
    } = req.body;

    // ✅ Validate ngày & giờ trước khi làm gì khác
    if (!isValidDateString(ngay_dat) || !isValidTimeString(gio_dat)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Ngày/giờ đặt bàn không hợp lệ. Vui lòng chọn lại.",
      });
    }

    const customer = await Customer.findOne({ where: { id_tk: req.user.id_tk } });
    if (!customer) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy khách hàng cho tài khoản này",
      });
    }

    let preOrder = null;
    let preOrderId = null;

    // 💡💡💡 LOGIC XỬ LÝ ĐẶT MÓN TRƯỚC 💡💡💡
    if (items && Array.isArray(items) && items.length > 0) {
      let tong_tien = 0;
      const orderDetailsData = [];

      for (const item of items) {
        const product = await Product.findByPk(item.id_mon);
        if (!product) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: `Không tìm thấy sản phẩm với ID: ${item.id_mon}`,
          });
        }
        const gia = parseFloat(product.gia);
        tong_tien += gia * parseInt(item.so_luong, 10);

        orderDetailsData.push({
          id_mon: item.id_mon,
          so_luong: item.so_luong,
          gia,
        });
      }

      preOrder = await Order.create(
        {
          id_kh: customer.id_kh,
          ho_ten_nhan: ho_ten,
          sdt_nhan: sdt,
          dia_chi_nhan: "Đặt tại quán (Pre-order for Reservation)",
          email_nhan: customer.email,
          pttt: "COD",
          trang_thai: "PENDING", // Giữ nguyên PENDING cho đơn đặt trước
          tong_tien,
          ghi_chu: `Đặt trước cho bàn ngày ${ngay_dat} lúc ${gio_dat}`,
        },
        { transaction: t }
      );

      const detailsWithOrderId = orderDetailsData.map((detail) => ({
        ...detail,
        id_don: preOrder.id_don,
      }));

      await OrderDetail.bulkCreate(detailsWithOrderId, { transaction: t });
      preOrderId = preOrder.id_don;
    }
    // 💡💡💡 KẾT THÚC LOGIC ĐẶT MÓN 💡💡💡

    const newR = await Reservation.create(
      {
        id_kh: customer.id_kh,
        id_ban,
        ho_ten,
        sdt,
        ngay_dat,
        gio_dat,
        so_nguoi,
        ghi_chu,
        trang_thai: "PENDING",
        id_don_dat_truoc: preOrderId,
      },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Đặt bàn thành công",
      reservation: newR,
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ Lỗi tạo đặt bàn:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo đặt bàn",
      error: err.message,
    });
  }
}

/**
 * 👤 Xem đơn của chính mình
 */
export async function getMyReservations(req, res) {
  try {
    const accountId = req.user?.id;
    const customer = await Customer.findOne({ where: { id_tk: accountId } });

    if (!customer)
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy khách hàng cho tài khoản này",
      });

    const reservations = await Reservation.findAll({
      where: { id_kh: customer.id_kh },
      include: [{ model: Customer }],
      order: [["ngay_dat", "DESC"]],
    });

    res.json({ success: true, data: reservations });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy đơn đặt bàn",
      error: err.message,
    });
  }
}

/**
 * 🧾 Admin xem toàn bộ đơn (Cập nhật: THÊM LỌC THEO KHOẢNG NGÀY startDate/endDate)
 */
export async function getAllReservations(req, res) {
  try {
    // 💡 Lấy tham số startDate và endDate từ query
    const { startDate, endDate } = req.query; 
    const where = {};

    // ✅ LOGIC LỌC THEO KHOẢNG NGÀY
    if (startDate && endDate && isValidDateString(startDate) && isValidDateString(endDate)) {
        // Lọc theo ngay_dat nằm trong khoảng [startDate, endDate]
        // 🔹 Đặt ngày bắt đầu về 00:00:00.000 (để lấy từ đầu ngày)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); 
        
        // 🔹 Đặt ngày kết thúc về 23:59:59.999 (để lấy đến cuối ngày)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
        
        where.ngay_dat = {
            [Op.between]: [start, end], 
        };
    } 
    // 💡 Lưu ý: Đã loại bỏ logic lọc theo date đơn lẻ cũ vì frontend AdminReservations.jsx 
    // giờ đã sử dụng lọc theo khoảng ngày startDate/endDate

    const reservations = await Reservation.findAll({
      where: where, // Áp dụng bộ lọc ngày (nếu có)
      include: [
        {
          model: Customer,
          attributes: ["id_kh", "ho_ten", "email", "sdt"],
          required: false,
        },
        {
          model: Table,
          attributes: ["id_ban", "ten_ban", "so_ban"],
          required: false,
        },
      ],
      order: [
        ["ngay_dat", "DESC"],
        ["gio_dat", "DESC"],
      ],
    });

    return res.json({ success: true, data: reservations });
  } catch (err) {
    console.error("getAllReservations error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách đặt bàn",
      error: err.message,
    });
  }
}

/**
 * ℹ️ Admin xem chi tiết 1 đơn (CẬP NHẬT LẠI)
 */
export async function getReservationById(req, res) {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByPk(id, {
      include: [
        { model: Customer },
        { model: Table },
        {
          model: Order,
          as: "PreOrder",
          include: [
            {
              model: OrderDetail,
              include: [{ model: Product, attributes: ["ten_mon"] }],
            },
          ],
        },
      ],
    });

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn đặt bàn" });
    }

    res.json({ success: true, data: reservation });
  } catch (err) {
    console.error("❌ LỖI TRONG getReservationById:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy chi tiết đặt bàn",
      error: err.message,
    });
  }
}

/**
 * 🛠️ Admin cập nhật trạng thái
 */
export async function updateReservationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reservation = await Reservation.findByPk(id);

    if (!reservation)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });

    const oldStatus = reservation.trang_thai;
    if (oldStatus === status) {
      return res.json({
        success: true,
        message: "Trạng thái không đổi",
        data: reservation,
      });
    }

    await reservation.update({ trang_thai: status });

    let statusLabel = "";
    if (status === "CONFIRMED") statusLabel = "Đã xác nhận";
    if (status === "ARRIVED") statusLabel = "Đã đến"; // 💡 THÊM ARRIVED
    if (status === "CANCELLED") statusLabel = "Đã hủy";
    if (status === "DONE") statusLabel = "Đã hoàn thành";

    if (statusLabel) {
      sendReservationNotification(reservation, statusLabel);
    }

    res.json({ success: true, message: "Cập nhật thành công", data: reservation });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi cập nhật", error: err.message });
  }
}

/**
 * ❌ Admin xóa đặt bàn (Đã cập nhật: Dùng Transaction + Xử lý Pre-Order)
 */
export async function deleteReservation(req, res) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByPk(id, { transaction: t });

    if (!reservation) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
    }

    // 💡 Xử lý Đơn đặt trước (Pre-Order) liên quan
    if (reservation.id_don_dat_truoc) {
      const preOrder = await Order.findByPk(reservation.id_don_dat_truoc, { transaction: t });
      if (preOrder && preOrder.trang_thai === "PENDING") {
        // Nếu đơn đặt trước còn PENDING, HỦY nó
        await preOrder.update({ trang_thai: "CANCELLED", ghi_chu: `Đã hủy do Đặt bàn #${id} bị xóa` }, { transaction: t });
        console.log(`[Transaction] Đã hủy đơn đặt trước #${preOrder.id_don} do xóa đặt bàn #${id}`);
      }
      // Các trạng thái khác (CONFIRMED/COMPLETED) sẽ được giữ lại
    }

    await reservation.destroy({ transaction: t });
    
    await t.commit();
    res.json({ success: true, message: "Đã xóa thành công" });
  } catch (err) {
    await t.rollback();
    console.error("Lỗi xóa đặt bàn:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi xóa", error: err.message });
  }
}

// 💡 MỚI: Lấy các khung giờ đã đặt cho bàn trong ngày cụ thể
export async function getBusySlots(req, res) {
  try {
    const { id_ban, date } = req.query;

    console.log("🔍 DEBUG BUSY SLOTS:", { id_ban, date });

    if (!id_ban || !date) {
      return res.status(400).json({ message: "Thiếu id_ban hoặc date" });
    }

    const bookings = await Reservation.findAll({
      where: {
        id_ban: id_ban,
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn("DATE", db.sequelize.col("ngay_dat")),
            "=",
            date
          ),
        ],
        trang_thai: {
          [Op.or]: [
            "pending", // Cho phép hiển thị pending để admin/khách thấy đơn đang chờ
            "PENDING",
            "confirmed",
            "CONFIRMED",
            "Confirmed",
            "arrived",
            "ARRIVED",
            "done",
            "DONE",
            "Đã xác nhận",
            "đã xác nhận",
          ],
        },
      },
      attributes: ["gio_dat", "trang_thai"],
      order: [["gio_dat", "ASC"]],

    });

    console.log(`✅ Tìm thấy ${bookings.length} đơn.`);

    const busyTimes = bookings.map((b) => b.gio_dat);

    res.json({
      success: true,
      data: busyTimes,
    });
  } catch (err) {
    console.error("❌ Lỗi lấy lịch bàn:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// 💡 MỚI: Tạo đặt bàn từ chatbot (nếu sau này dùng endpoint riêng)
export async function createReservationFromChatbot(req, draft) {
  const t = await sequelize.transaction();
  try {
    const { ho_ten, sdt, ngay_dat, gio_dat, so_nguoi, ghi_chu } = draft;

    // ✅ Validate ngày/giờ cho chatbot luôn
    if (!isValidDateString(ngay_dat) || !isValidTimeString(gio_dat)) {
      await t.rollback();
      throw new Error("Ngày/giờ đặt bàn (chatbot) không hợp lệ.");
    }

    const customer = await Customer.findOne({
      where: { id_tk: req.user.id_tk },
      transaction: t,
    });
    if (!customer) {
      await t.rollback();
      throw new Error("Không tìm thấy khách hàng cho tài khoản này");
    }

    const newR = await Reservation.create(
      {
        id_kh: customer.id_kh,
        id_ban: null,
        ho_ten,
        sdt,
        ngay_dat,
        gio_dat,
        so_nguoi,
        ghi_chu: `[CHATBOT] ${ghi_chu || ""}`,
        trang_thai: "PENDING",
        id_don_dat_truoc: null,
      },
      { transaction: t }
    );

    await t.commit();
    return newR;
  } catch (err) {
    await t.rollback();
    console.error("createReservationFromChatbot error:", err);
    throw err;
  }
}
/**
 * 📊 Thống kê đặt bàn cho Admin theo tuần / tháng
 */
export async function getReservationStats(req, res) {
  try {
    // CHỈ CHO PHÉP: week | month
    const rawPeriod = (req.query.period || "month").toLowerCase();
    const period = rawPeriod === "week" ? "week" : "month";

    let range;
    if (period === "week") range = getCurrentWeekRange();
    else range = getCurrentMonthRange();

    const { start, end } = range;

    const rows = await Reservation.findAll({
      attributes: ["trang_thai", [fn("COUNT", col("id_datban")), "count"] ],
      where: {
        ngay_dat: { [Op.between]: [start, end] },
      },
      group: ["trang_thai"],
      raw: true,
    });

    const totalReservations = rows.reduce(
      (sum, r) => sum + Number(r.count || 0),
      0
    );

    const successfulReservations = rows
      .filter((r) =>
        SUCCESS_RESERVATION_STATUSES.includes(
          (r.trang_thai || "").toUpperCase()
        )
      )
      .reduce((sum, r) => sum + Number(r.count || 0), 0);

    const cancelledReservations = rows
      .filter((r) =>
        CANCELLED_RESERVATION_STATUSES.includes(
          (r.trang_thai || "").toUpperCase()
        )
      )
      .reduce((sum, r) => sum + Number(r.count || 0), 0);

    const successPercent = totalReservations
      ? Math.round((successfulReservations / totalReservations) * 100)
      : 0;

    const cancelledPercent = totalReservations
      ? Math.round((cancelledReservations / totalReservations) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        period,                // "week" | "month"
        range: { start, end }, // nếu sau này bạn muốn tính thêm gì cũng dễ
        totalReservations,
        successfulReservations,
        cancelledReservations,
        successPercent,
        cancelledPercent,
        byStatus: rows,
      },
    });
  } catch (err) {
    console.error("getReservationStats error:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thống kê đặt bàn.",
    });
  }
}

// ===== Helper: escape CSV =====
function escapeReservationCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  if (/[",\n]/.test(str)) {
    return `"${str}"`;
  }
  return str;
}

/**
 * 📤 Xuất danh sách đặt bàn theo kỳ (week / month / year) dưới dạng CSV
 * Đường dẫn gợi ý: GET /api/admin/reservations/export?period=month
 */
export async function exportReservationStatsCsv(req, res) {
  try {
    const rawPeriod = (req.query.period || "month").toLowerCase();
    let range;
    let period;

    // 💡 CẬP NHẬT: Dùng logic tương tự Orders Controller để gán period chuẩn
    if (rawPeriod === "month") {
      range = getCurrentMonthRange();
      period = "month";
    } else if (rawPeriod === "year") {
      range = getCurrentYearRange(); // Đã thêm vào import
      period = "year";
    } else {
      range = getCurrentWeekRange();
      period = "week";
    }

    const { start, end } = range;

    const rows = await Reservation.findAll({
      where: {
        ngay_dat: { [Op.between]: [start, end] },
      },
      attributes: [
        "id_datban",
        "ngay_dat",
        "gio_dat",
        "so_nguoi",
        "trang_thai",
      ],
      include: [
        {
          model: Customer,
          attributes: ["ho_ten", "email", "sdt"],
          required: false,
        },
        {
          model: Table,
          attributes: ["ten_ban", "so_ban"],
          required: false,
        },
      ],
      order: [
        ["ngay_dat", "ASC"],
        ["gio_dat", "ASC"],
      ],
    });

    const esc = escapeReservationCsv; // Sử dụng helper đã định nghĩa

    let csv =
      "ID đặt bàn,Ngày đặt,Giờ,Khách hàng,Email,SĐT,Số người,Bàn,Trạng thái\n";

    for (const r of rows) {
      const d = r.ngay_dat ? new Date(r.ngay_dat) : null;
      const dateStr = d ? d.toISOString().slice(0, 10) : "";
      const timeStr = r.gio_dat || "";

      const c = r.Customer || {};
      const t = r.Table || {};
      const tableLabel = t.ten_ban || t.so_ban || "";

      const line = [
        esc(r.id_datban),
        esc(dateStr),
        esc(timeStr),
        esc(c.ho_ten || ""),
        esc(c.email || ""),
        esc(c.sdt || ""),
        esc(r.so_nguoi || 0),
        esc(tableLabel),
        esc(r.trang_thai || ""),
      ].join(",");

      csv += line + "\n";
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `reservations_${period}_${todayStr}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    // Thêm Byte Order Mark (BOM) cho Excel mở tiếng Việt không bị lỗi font
    res.send("\uFEFF" + csv); 
  } catch (err) {
    console.error("exportReservationStatsCsv error:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xuất Excel đặt bàn.",
    });
  }
}