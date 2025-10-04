import Reservation from "../models/Reservation.js"; // bạn cần tạo model Sequelize
import Customer from "../models/Customer.js";

// Customer tạo đặt bàn
export async function createReservation(req, res) {
  try {
    const { ho_ten, sdt, ngay_dat, so_nguoi, ghi_chu } = req.body;
    const newR = await Reservation.create({
      id_kh: req.user.id_tk, // lấy từ token
      ho_ten,
      sdt,
      ngay_dat,
      so_nguoi,
      ghi_chu,
      trang_thai: "PENDING",
    });
    res.status(201).json({ message: "Đặt bàn thành công", reservation: newR });
  } catch (err) {
    res.status(500).json({ message: "Lỗi tạo đặt bàn", error: err.message });
  }
}

// Customer xem đơn của mình
export async function getMyReservations(req, res) {
  try {
    const reservations = await Reservation.findAll({
      where: { id_kh: req.user.id_tk },
      include: [{ model: Customer }],
    });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy đơn đặt bàn", error: err.message });
  }
}

// Admin xem toàn bộ
export async function getAllReservations(req, res) {
  try {
    const reservations = await Reservation.findAll({
      include: [{ model: Customer }],
      order: [["ngay_dat", "DESC"]],
    });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy danh sách đặt bàn", error: err.message });
  }
}

// Admin cập nhật trạng thái
export async function updateReservationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reservation = await Reservation.findByPk(id);
    if (!reservation) return res.status(404).json({ message: "Không tìm thấy" });

    await reservation.update({ trang_thai: status });
    res.json({ message: "Cập nhật thành công", reservation });
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật", error: err.message });
  }
}

// Admin xóa
export async function deleteReservation(req, res) {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByPk(id);
    if (!reservation) return res.status(404).json({ message: "Không tìm thấy" });

    await reservation.destroy();
    res.json({ message: "Đã xóa thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi xóa", error: err.message });
  }
}
