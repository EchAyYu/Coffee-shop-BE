// ================================
// ☕ Coffee Shop Backend - Reservations Controller (Fixed)
// ================================
import Reservation from "../models/Reservation.js";
import Customer from "../models/Customer.js";
import Table from "../models/Table.js";
import Notification from "../models/Notification.js"; // 💡 THÊM IMPORT
import { emitToUser } from "../socket.js";            // 💡 THÊM IMPORT

// 💡 --- Helper Function: Hàm gửi thông báo (Nội bộ) ---
async function sendReservationNotification(reservation, newStatusLabel) {
  try {
    if (!reservation.id_kh) return; // Không có khách hàng, không gửi

    const customer = await Customer.findByPk(reservation.id_kh);
    if (!customer || !customer.id_tk) return; // Không tìm thấy tài khoản

    const title = `Đặt bàn #${reservation.id_datban} ${newStatusLabel}`;
    const message = `Yêu cầu đặt bàn của bạn (ID: #${reservation.id_datban}) đã được ${newStatusLabel.toLowerCase()}.`;

    // 1. Tạo thông báo trong CSDL
    const newNotification = await Notification.create({
      id_tk: customer.id_tk,
      type: "reservation", // 💡 Ghi rõ type là 'reservation'
      title: title,
      message: message,
    });

    // 2. Bắn sự kiện Socket
    emitToUser(customer.id_tk, "new_notification", newNotification.toJSON());
    
    console.log(`[Socket] Đã gửi thông báo đặt bàn cho id_tk: ${customer.id_tk}`);

  } catch (e) {
    console.error("Lỗi khi gửi thông báo đặt bàn:", e.message);
    // Không ném lỗi ra ngoài để tránh làm hỏng API chính
  }
}
/**
 * 📅 Khách hàng tạo đặt bàn
 */
// ... (Hàm createReservation của bạn giữ nguyên)
export async function createReservation(req, res) {
  // ... (Code cũ của bạn giữ nguyên)
  try {
    const { ho_ten, sdt, ngay_dat, gio_dat, so_nguoi, ghi_chu, id_ban } = req.body; // 💡 Đảm bảo 'id_ban' được gửi từ FE

    const customer = await Customer.findOne({ where: { id_tk: req.user.id_tk } });
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy khách hàng cho tài khoản này",
      });
    }

    const newR = await Reservation.create({
      id_kh: customer.id_kh,
      id_ban: id_ban, // 💡 Gán id_ban
      ho_ten,
      sdt,
      ngay_dat,
      gio_dat,
      so_nguoi,
      ghi_chu,
      trang_thai: "PENDING",
    });

   res.status(201).json({
      success: true,
      message: "Đặt bàn thành công",
      reservation: newR,
    });
  } catch (err) {
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
 * 🧾 Admin xem toàn bộ đơn
 */
export async function getAllReservations(req, res) {
  try {
    const reservations = await Reservation.findAll({
      // 💡 CẬP NHẬT INCLUDE: Thêm 'Table'
      include: [
        { 
          model: Customer, 
          attributes: ['id_kh', 'ho_ten'] // Lấy ít trường hơn cho nhẹ
        },
        {
          model: Table,
          attributes: ['id_ban', 'ten_ban', 'so_ban'] // Lấy tên bàn
        }
      ],
      order: [["ngay_dat", "DESC"]],
    });
    res.json({ success: true, data: reservations });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách đặt bàn",
      error: err.message,
    });
  }
}

// 💡💡💡 THÊM HÀM MỚI 💡💡💡
/**
 * ℹ️ Admin xem chi tiết 1 đơn
 */
export async function getReservationById(req, res) {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByPk(id, {
      // Include đầy đủ thông tin cho Modal
      include: [
        { model: Customer }, // Lấy tất cả thông tin Customer
        { model: Table }      // Lấy tất cả thông tin Table
      ]
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đặt bàn" });
    }

    res.json({ success: true, data: reservation });
  } catch (err) {
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
    const { status } = req.body; // status nhận vào là "CONFIRMED", "CANCELLED"...
    const reservation = await Reservation.findByPk(id);

    if (!reservation)
      return res.status(404).json({ success: false, message: "Không tìm thấy" });

    // Chỉ gửi thông báo nếu trạng thái thực sự thay đổi
    const oldStatus = reservation.trang_thai;
    if (oldStatus === status) {
       return res.json({ success: true, message: "Trạng thái không đổi", data: reservation });
    }

    await reservation.update({ trang_thai: status });

    // 💡💡💡 LOGIC GỬI THÔNG BÁO MỚI 💡💡💡
    let statusLabel = "";
    if (status === "CONFIRMED") statusLabel = "Đã xác nhận";
    if (status === "CANCELLED") statusLabel = "Đã hủy";
    if (status === "DONE") statusLabel = "Đã hoàn thành";

    if (statusLabel) {
      // Chạy bất đồng bộ, không cần await để API trả về nhanh
      sendReservationNotification(reservation, statusLabel);
    }
    // 💡💡💡 KẾT THÚC LOGIC MỚI 💡💡💡

    res.json({ success: true, message: "Cập nhật thành công", data: reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi cập nhật", error: err.message });
  }
}

/**
 * ❌ Admin xóa đặt bàn
 */
export async function deleteReservation(req, res) {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByPk(id);

    if (!reservation)
      return res.status(404).json({ success: false, message: "Không tìm thấy" });

    await reservation.destroy();
    res.json({ success: true, message: "Đã xóa thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi xóa", error: err.message });
  }
}
