import { Op } from "sequelize";
import sequelize from "../utils/db.js";
import db from "../models/index.js";
import Voucher from "../models/Voucher.js";
import VoucherRedemption from "../models/VoucherRedemption.js";
import { sendOrderConfirmationEmail } from "../utils/mailer.js";

// 🌟 1. IMPORT HÀM EMIT TỪ SOCKET.JS 🌟
import { emitToUser } from "../socket.js";

const { Order, OrderDetail, Product, Customer, Account, Notification } = db;


// ====== Helper: tạo thông báo ======
// 🌟 2. CẬP NHẬT HÀM PUSHNOTI 🌟
async function pushNoti({ id_tk, type = "order", title, message }) {
  if (!id_tk) return;
  try {
    // a. Tạo thông báo trong CSDL
    const newNotification = await Notification.create({ id_tk, type, title, message });
    
    // b. Gửi thông báo real-time qua socket
    if (newNotification) {
      // Gửi sự kiện 'new_notification' đến phòng (room) của user_id
      // Component NotificationBell.jsx (FE) sẽ lắng nghe sự kiện này
      emitToUser(id_tk, "new_notification", newNotification.toJSON());
    }

  } catch (e) {
    console.error("pushNoti error:", e?.message);
  }
}


// ====== Helper: cộng điểm (chống cộng lặp) ======
async function awardPointsIfEligible(order) {
  try {
    if (
      !order || 
      order.points_awarded || 
      (order.trang_thai && order.trang_thai.toLowerCase() !== "completed") || // Sửa lỗi so sánh
      !order.id_kh
    ) {
      return; 
    }

    const customer = await Customer.findByPk(order.id_kh);
    if (!customer) return;

    const totalAmount = Number(order.tong_tien || 0);
    const pointsToAdd = Math.floor(totalAmount / 10000) * 3;
    
    if (pointsToAdd <= 0) return;

    const currentPoints = customer.diem || 0;
    await customer.update({ diem: currentPoints + pointsToAdd });

    await order.update({ 
      points_awarded: true,
      diem_nhan_duoc: pointsToAdd 
    });

    const account = await Account.findByPk(customer.id_tk);
    await pushNoti({
      id_tk: account?.id_tk,
      type: "loyalty", // Hàm pushNoti giờ sẽ gửi cả socket
      title: `Tích điểm từ đơn #${order.id_don}`,
      message: `Bạn vừa nhận được ${pointsToAdd} điểm. Tổng điểm hiện tại: ${currentPoints + pointsToAdd}.`,
    });
  } catch (e) {
    console.error("awardPointsIfEligible error:", e?.message);
  }
}

// ========== Lịch sử đơn của tôi ==========
export async function getMyOrders(req, res) {
  try {
    const page  = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const status = (req.query.status || "completed,cancelled")
      .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

    const meAccountId = req.user?.id_tk || req.user?.id;
    const meCustomer = await Customer.findOne({ where: { id_tk: meAccountId } });
    if (!meCustomer) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });

    const where = { id_kh: meCustomer.id_kh, trang_thai: { [Op.in]: status } };

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: OrderDetail, required: false, include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }] }],
      order: [["ngay_dat", "DESC"]],
      limit,
      offset,
      distinct: true
    });

    res.json({
      success: true,
      data: rows,
      pagination: { totalItems: count, currentPage: page, totalPages: Math.ceil(count / limit), limit }
    });
  } catch (e) {
    console.error("getMyOrders error:", e);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy lịch sử đơn hàng." });
  }
}

/**
 * 🛒 Tạo đơn hàng
 */
export async function createOrder(req, res) {
  const {
    ho_ten_nhan, sdt_nhan, dia_chi_nhan, email_nhan, pttt, ghi_chu, items,
    voucher_code
  } = req.body;

  const user = req.user;

  let customer = null;
  let id_kh = null;

  if (user?.id_tk) {
    try {
      customer = await Customer.findOne({ where: { id_tk: user.id_tk } });
      if (customer) id_kh = customer.id_kh;
      else console.warn(`Không tìm thấy Customer cho Account ID: ${user.id_tk}`);
    } catch (findErr) {
      console.error(`Lỗi tìm Customer cho Account ID: ${user.id_tk}`, findErr);
    }
  }

  let calculatedTotal = 0;
  const productDetails = [];

  try {
    const productIds = items.map(item => item.id_mon);
    const productsInDb = await Product.findAll({
      where: { id_mon: { [Op.in]: productIds } },
      attributes: ["id_mon", "gia", "ten_mon"]
    });

    const productMap = new Map(productsInDb.map(p => [p.id_mon, { gia: p.gia, ten_mon: p.ten_mon }]));

    for (const item of items) {
      const productInfo = productMap.get(item.id_mon);
      if (!productInfo) {
        return res.status(400).json({ success: false, message: `Sản phẩm với ID ${item.id_mon} không tồn tại.` });
      }
      const itemPrice = parseFloat(productInfo.gia);
      const itemTotal = itemPrice * item.so_luong;
      calculatedTotal += itemTotal;
      productDetails.push({
        id_mon: item.id_mon,
        so_luong: item.so_luong,
        gia: itemPrice,
        Product: { ten_mon: productInfo.ten_mon }
      });
    }
  } catch (dbError) {
    console.error("❌ Lỗi truy vấn sản phẩm:", dbError);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi kiểm tra sản phẩm." });
  }

  let discount = 0;
  let redemptionToUse = null;

  try {
    if (voucher_code) {
      if (!user?.id_tk) {
        return res.status(401).json({ success: false, message: "Cần đăng nhập để dùng voucher." });
      }
      redemptionToUse = await VoucherRedemption.findOne({ where: { code: voucher_code, id_tk: user.id_tk } });
      if (!redemptionToUse || redemptionToUse.status !== "active") {
        return res.status(400).json({ success: false, message: "Mã voucher không hợp lệ." });
      }
      if (redemptionToUse.expires_at && new Date(redemptionToUse.expires_at) <= new Date()) {
        return res.status(400).json({ success: false, message: "Mã voucher đã hết hạn." });
      }
      const voucher = await Voucher.findByPk(redemptionToUse.voucher_id);
      if (!voucher || !voucher.active) {
        return res.status(400).json({ success: false, message: "Voucher không hợp lệ." });
      }
      if (calculatedTotal < Number(voucher.min_order || 0)) {
        return res.status(400).json({ success: false, message: "Chưa đạt giá trị tối thiểu để dùng mã." });
D     }

      if (voucher.discount_type === "fixed") {
        discount = Number(voucher.discount_value);
      } else {
        discount = (calculatedTotal * Number(voucher.discount_value)) / 100;
      }
      const cap = voucher.max_discount ? Number(voucher.max_discount) : discount;
      discount = Math.min(discount, cap, calculatedTotal);
    }
  } catch (e) {
    console.error("❌ Lỗi xử lý voucher:", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý voucher." });
  }

  let newOrder;
  try {
    newOrder = await Order.create({
      id_kh,
      ho_ten_nhan,
      sdt_nhan,
      dia_chi_nhan,
      email_nhan,
      pttt,
      ghi_chu,
      trang_thai: pttt === "BANK_TRANSFER" ? "pending_payment" : "pending", 
      tong_tien: calculatedTotal - discount,
    });

    const orderDetailData = productDetails.map(detail => ({ ...detail, id_don: newOrder.id_don }));
    await OrderDetail.bulkCreate(orderDetailData);

    if (redemptionToUse) {
      await redemptionToUse.update({
        status: "used",
        used_order_id: newOrder.id_don,
        used_at: new Date()
      });
    }

    if (id_kh) {
      await pushNoti({
        id_tk: customer?.id_tk,
        type: "order",
        title: `Đặt hàng thành công #${newOrder.id_don}`,
        message: `Đơn của bạn đang ở trạng thái ${newOrder.trang_thai}.`
      });
    }

    sendOrderConfirmationEmail(newOrder.toJSON(), productDetails);

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công!",
      data: {
        id_don: newOrder.id_don,
        trang_thai: newOrder.trang_thai,
        tong_tien: newOrder.tong_tien,
        discount
      },
    });
  } catch (err) {
    console.error("❌ Lỗi tạo đơn/chi tiết:", err);
    if (redemptionToUse) {
      try { await redemptionToUse.update({ status: "active", used_order_id: null, used_at: null }); } catch {}
    }
    if (newOrder && newOrder.id_don) {
      try {
        await Order.destroy({ where: { id_don: newOrder.id_don } });
        console.log(`Đã rollback đơn hàng #${newOrder.id_don}`);
      } catch (rollbackErr) {
        console.error(`Lỗi rollback đơn hàng #${newOrder.id_don}:`, rollbackErr);
      }
    }
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo đơn hàng." });
  }
}

/**
 * 🏷️ Lấy chi tiết đơn
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, attributes: ["id_kh", "ho_ten", "email"] },
        { model: OrderDetail, required: false, include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }] }
      ]
    });

    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const isAdminOrEmployee = user?.role === "admin" || user?.role === "employee";
    if (!isAdminOrEmployee) {
      if (!user || !order.id_kh) return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
      const customerOfUser = await Customer.findOne({ where: { id_tk: user.id_tk } });
      if (!customerOfUser || customerOfUser.id_kh !== order.id_kh) {
        return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
      }
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error(`❌ Lỗi [getOrderById ${req.params.id}]:`, err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy chi tiết đơn hàng." });
  }
}

/**
 * 🔄 Cập nhật trạng thái (Admin/Employee)
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    let { trang_thai } = req.body; 

    if (trang_thai) {
      trang_thai = trang_thai.toLowerCase();
    } else {
      return res.status(400).json({ success: false, message: "Trạng thái là bắt buộc." });
    }

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const prev = order.trang_thai;
    if (prev === "completed" && trang_thai !== "completed") {
      return res.status(400).json({ success: false, message: "Không thể thay trạng thái đơn đã hoàn thành." });
s   }
    if (prev === "cancelled" && trang_thai !== "cancelled") {
      return res.status(400).json({ success: false, message: "Không thể thay trạng thái đơn đã hủy." });
    }

    await order.update({ trang_thai }); 

    let id_tk = null;
    if (order.id_kh) {
      const c = await Customer.findByPk(order.id_kh);
      id_tk = c?.id_tk || null;
    }
    // 🌟 HÀM NÀY GIỜ SẼ GỬI SOCKET 🌟
    await pushNoti({
      id_tk,
      type: "order",
      title: `Cập nhật đơn hàng #${order.id_don}`,
      message: `Trạng thái mới: ${trang_thai}.`,
    });

    // 🌟 HÀM NÀY GIỜ CŨNG SẼ GỬI SOCKET 🌟
    await awardPointsIfEligible(order); 

    res.json({ success: true, message: "Cập nhật trạng thái thành công", data: { id_don: order.id_don, trang_thai: order.trang_thai } });
  } catch (e) {
    console.error(`❌ Lỗi [updateOrderStatus ${req.params.id}]:`, e);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật trạng thái." });
  }
}

/**
 * 🗑️ Xóa đơn
 */
export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;

    const result = await sequelize.transaction(async (t) => {
      await OrderDetail.destroy({ where: { id_don: id }, transaction: t });
      const deletedOrderRows = await Order.destroy({ where: { id_don: id }, transaction: t });
      return deletedOrderRows;
    });

    if (result === 0) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    res.json({ success: true, message: "Đã xóa đơn hàng thành công" });
  } catch (err) {
    console.error(`❌ Lỗi [deleteOrder ${req.params.id}]:`, err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa đơn hàng." });
  }
}

/**
 * 📦 Danh sách đơn hàng (Admin)
 */
export async function getOrdersAdmin(req, res) {
  try {
    const orders = await Order.findAll({
      include: [
        { model: Customer, attributes: ["id_kh", "ho_ten", "email"] },
        { model: OrderDetail, include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }] }
      ],
      order: [["ngay_dat", "DESC"]],
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("getOrdersAdmin error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách đơn hàng." });
  }
}

