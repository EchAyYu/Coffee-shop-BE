// ================================
// ☕ Coffee Shop Backend - Reservations Controller (Fixed)
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
import { Op } from "sequelize";
import db from "../models/index.js";

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
 * 📅 Khách hàng tạo đặt bàn (VÀ ĐẶT MÓN TRƯỚC)
 */
export async function createReservation(req, res) {
  // 💡 Bọc toàn bộ logic trong một transaction
  const t = await sequelize.transaction();

  try {
    // 💡 Lấy thêm 'items' từ req.body
    const { ho_ten, sdt, ngay_dat, gio_dat, so_nguoi, ghi_chu, id_ban, items } = req.body; 

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
      
      // 1. Tính tổng tiền (Cần lấy giá từ DB để đảm bảo)
      let tong_tien = 0;
      const orderDetailsData = [];

      for (const item of items) {
        const product = await Product.findByPk(item.id_mon);
        if (!product) {
          await t.rollback();
          return res.status(400).json({ success: false, message: `Không tìm thấy sản phẩm với ID: ${item.id_mon}` });
        }
        const gia = parseFloat(product.gia); // Lấy giá từ model Product
        tong_tien += gia * parseInt(item.so_luong, 10);
        
        orderDetailsData.push({
          id_mon: item.id_mon,
          so_luong: item.so_luong,
          gia: gia,
          // id_don sẽ được gán tự động khi tạo Order
        });
      }

      // 2. Tạo Order
      preOrder = await Order.create({
        id_kh: customer.id_kh,
        ho_ten_nhan: ho_ten, // Lấy tên từ form đặt bàn
        sdt_nhan: sdt,       // Lấy SĐT từ form đặt bàn
        dia_chi_nhan: "Đặt tại quán (Pre-order for Reservation)", // 👈 Ghi chú
        email_nhan: customer.email, // Lấy email khách
        pttt: "COD", // 👈 Mặc định (hoặc bạn có thể thêm 'PAY_AT_STORE')
        trang_thai: "pending", // 👈 TRẠNG THÁI MỚI
        tong_tien: tong_tien,
        ghi_chu: `Đặt trước cho bàn ngày ${ngay_dat} lúc ${gio_dat}`,
      }, { transaction: t }); // 👈 Thêm transaction

      // 3. Gắn id_don vào OrderDetail và tạo
      const detailsWithOrderId = orderDetailsData.map(detail => ({
        ...detail,
        id_don: preOrder.id_don
      }));

      await OrderDetail.bulkCreate(detailsWithOrderId, { transaction: t }); // 👈 Thêm transaction
      
      preOrderId = preOrder.id_don; // Lấy ID để lưu vào Reservation
    }
    // 💡💡💡 KẾT THÚC LOGIC ĐẶT MÓN 💡💡💡

    const newR = await Reservation.create({
      id_kh: customer.id_kh,
      id_ban: id_ban, 
      ho_ten,
      sdt,
      ngay_dat,
      gio_dat,
      so_nguoi,
      ghi_chu,
      trang_thai: "PENDING",
      id_don_dat_truoc: preOrderId, // 👈 GÁN ID ĐƠN ĐẶT TRƯỚC VÀO ĐÂY
    }, { transaction: t }); // 👈 Thêm transaction

    // Nếu mọi thứ thành công, commit transaction
    await t.commit();

    res.status(201).json({
      success: true,
      message: "Đặt bàn thành công",
      reservation: newR,
    });
  } catch (err) {
    // Nếu có lỗi, rollback
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
  	 	 // 💡💡💡 THÊM INCLUDE LỒNG NHAU 💡💡💡
  	 	 {
  	 	   model: Order,
  	 	   as: "PreOrder", // 👈 Phải khớp với 'as' trong Model
  	 	   include: [
  	 	 	 {
  	 	 	   model: OrderDetail,
  	 	 	   include: [
                  // 💡💡💡 SỬA LỖI Ở ĐÂY 💡💡💡
                  // Bỏ 'hinh_anh' vì cột này không tồn tại trong bảng 'mon'
  	 	 	 	 { model: Product, attributes: ['ten_mon'] } 
                  // 💡💡💡 KẾT THÚC SỬA LỖI 💡💡💡
  	 	 	   ]
  	 	 	 }
  	 	   ]
  	 	 }
  	 	 // 💡💡💡 KẾT THÚC INCLUDE MỚI 💡💡💡
  	  ]
  	});

  	if (!reservation) {
  	  return res.status(404).json({ success: false, message: "Không tìm thấy đơn đặt bàn" });
  	}

  	res.json({ success: true, data: reservation });
  } catch (err) {
    // Dòng console.error này bạn có thể giữ hoặc xóa đi
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
        
        // 💡 ĐOẠN NÀY SẼ HẾT LỖI VÌ ĐÃ CÓ BIẾN 'db'
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn('DATE', db.sequelize.col('ngay_dat')), 
            '=', 
            date
          )
        ],

        trang_thai: {
          [Op.or]: [
            'confirmed', 'CONFIRMED', 'Confirmed',
            'arrived', 'ARRIVED',
            'done', 'DONE',
            'Đã xác nhận', 'đã xác nhận'
          ]
        }
      },
      attributes: ['gio_dat', 'trang_thai'],
      order: [['gio_dat', 'ASC']]
    });

    console.log(`✅ Tìm thấy ${bookings.length} đơn.`);

    const busyTimes = bookings.map(b => b.gio_dat);

    res.json({
      success: true,
      data: busyTimes
    });
  } catch (err) {
    console.error("❌ Lỗi lấy lịch bàn:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}