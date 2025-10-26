// ================================
// ☕ Coffee Shop Backend - Reservations Controller (Fixed)
// ================================
import Reservation from "../models/Reservation.js";
import Customer from "../models/Customer.js";

/**
 * 📅 Khách hàng tạo đặt bàn
 */
export async function createReservation(req, res) {
  try {
    const { ho_ten, sdt, ngay_dat, gio_dat, so_nguoi, ghi_chu } = req.body;

    // 🔹 Kiểm tra tài khoản có tồn tại trong bảng khách hàng
   const customer = await Customer.findOne({ where: { id_tk: req.user.id_tk } });
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy khách hàng cho tài khoản này",
      });
    }

    // 🔹 Tạo đặt bàn mới
   const newR = await Reservation.create({
      id_kh: customer.id_kh,
      ho_ten,
      sdt,
      ngay_dat,
      gio_dat, // 💡 THÊM DÒNG NÀY
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
      include: [{ model: Customer }],
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

/**
 * 🛠️ Admin cập nhật trạng thái
 */
export async function updateReservationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reservation = await Reservation.findByPk(id);

    if (!reservation)
      return res.status(404).json({ success: false, message: "Không tìm thấy" });

    await reservation.update({ trang_thai: status });
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
