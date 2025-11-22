// src/controllers/orders.controller.js (ĐÃ THÊM LẠI getOrderById)

import { Op } from "sequelize";
import sequelize from "../utils/db.js";
import db from "../models/index.js"; // Import từ index.js để đảm bảo quan hệ
import { sendOrderConfirmationEmail } from "../utils/mailer.js";
import { emitToUser } from "../socket.js";

const { Order, OrderDetail, Product, Customer, Account, Notification, Voucher, VoucherRedemption } = db;

// 💡 MAP DỊCH TRẠNG THÁI SANG TIẾNG VIỆT 💡
const ORDER_STATUS_VI = {
  pending: "Đang xử lý",
  pending_payment: "Chờ thanh toán",
  confirmed: "Đã xác nhận",
  paid: "Đã thanh toán",
  shipped: "Đang giao hàng",
  completed: "Hoàn thành",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

// Helper lấy tên tiếng Việt
const getStatusVi = (status) => {
  return ORDER_STATUS_VI[status?.toLowerCase()] || status;
};

// ====== Helper: tạo thông báo ======
async function pushNoti({ id_tk, type = "order", title, message }) {
  if (!id_tk) return;
  try {
    const newNotification = await Notification.create({ id_tk, type, title, message });
    if (newNotification) {
      emitToUser(id_tk, "new_notification", newNotification.toJSON());
    }
  } catch (e) {
    console.error("pushNoti error:", e?.message);
  }
}

// ====== Helper: cộng điểm ======
async function awardPointsIfEligible(order) {
  if (!order || order.points_awarded || !order.id_kh) return;

  try {
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
    
    // 💡 Dùng pushNoti đã sửa
    await pushNoti({
      id_tk: customer.id_tk,
      type: "loyalty",
      title: `Tích điểm từ đơn #${order.id_don}`,
      message: `Bạn vừa nhận được ${pointsToAdd} điểm. Tổng điểm hiện tại: ${currentPoints + pointsToAdd}.`,
    });
  } catch (e) {
    console.error("awardPointsIfEligible error:", e?.message);
  }
}

// ========== Lịch sử đơn của tôi ==========
export async function getMyOrders(req, res) {
  // ... (Giữ nguyên logic cũ)
  try {
    const page  = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    let status = (req.query.status || "completed,done,cancelled")
      .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

    if (status.includes("completed") && !status.includes("done")) {
      status.push("done");
    }

    const meAccountId = req.user?.id_tk || req.user?.id;
    const meCustomer = await Customer.findOne({ where: { id_tk: meAccountId } });
    if (!meCustomer) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });

    const where = { id_kh: meCustomer.id_kh, trang_thai: { [Op.in]: status } };

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ 
        model: OrderDetail, 
        required: true, 
        include: [{ 
          model: Product, 
          attributes: ["id_mon", "ten_mon", "anh"] 
        }] 
      }],
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
 * 🛒 Tạo đơn hàng (Đã sửa thông báo)
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
      if (customer) {
        id_kh = customer.id_kh;
      } else {
        const newCustomer = await Customer.create({
          id_tk: user.id_tk,
          ho_ten: ho_ten_nhan, 
          sdt: sdt_nhan,       
          email: email_nhan,   
          dia_chi: dia_chi_nhan, 
          diem: 0, 
        });
        id_kh = newCustomer.id_kh;
      }
    } catch (findOrCreatErr) {
      console.error(`Lỗi tìm/tạo Customer:`, findOrCreatErr);
      return res.status(500).json({ success: false, message: "Lỗi hệ thống khách hàng." });
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
      if (!productInfo) return res.status(400).json({ success: false, message: `Sản phẩm ID ${item.id_mon} lỗi.` });
      const itemPrice = parseFloat(productInfo.gia);
      calculatedTotal += itemPrice * item.so_luong;
      productDetails.push({
        id_mon: item.id_mon,
        so_luong: item.so_luong,
        gia: itemPrice,
        Product: { ten_mon: productInfo.ten_mon }
      });
    }
  } catch (dbError) {
    return res.status(500).json({ success: false, message: "Lỗi kiểm tra sản phẩm." });
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
      }

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
      // 💡💡💡 SỬA LỖI Ở ĐÂY 💡💡💡
      // Dùng getStatusVi để chuyển 'pending_payment' -> 'Chờ thanh toán'
      const statusVi = getStatusVi(newOrder.trang_thai);
      
      await pushNoti({
        id_tk: user.id_tk, 
        type: "order",
        title: `Đặt hàng thành công #${newOrder.id_don}`,
        // Thông báo giờ sẽ là: "Đơn của bạn đang ở trạng thái Chờ thanh toán."
        message: `Đơn của bạn đang ở trạng thái ${statusVi}.` 
      });
    }

    res.status(201).json({
      success: true,
      message: "Tạo hàng thành công!",
      data: {
        id_don: newOrder.id_don,
        trang_thai: newOrder.trang_thai,
        tong_tien: newOrder.tong_tien,
        discount
      },
    });
  } catch (err) {
    console.error("Lỗi tạo đơn:", err); 
    // ... (Rollback logic giữ nguyên)
    if (newOrder?.id_don) { try { await Order.destroy({ where: { id_don: newOrder.id_don } }); } catch {} }
    res.status(500).json({ success: false, message: "Lỗi tạo đơn hàng." });
  }
}

// 💡💡💡 === BẮT ĐẦU PHẦN CODE THÊM LẠI === 💡💡💡
/**
 * 🏷️ Lấy chi tiết đơn (Fix lỗi crash)
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user; // Lấy từ requireAuth

    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, attributes: ["id_kh", "ho_ten", "email"] },
        { model: OrderDetail, required: false, include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }] }
      ]
    });

    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    // Kiểm tra quyền: Hoặc là admin/employee, hoặc là chủ của đơn hàng
    const isAdminOrEmployee = user.role === "admin" || user.role === "employee";
    
    // Tìm Customer ID của người đang đăng nhập
    let customerOfUser = null;
    if (user.role === 'customer') {
       customerOfUser = await Customer.findOne({ where: { id_tk: user.id_tk }, attributes: ['id_kh'] });
    }
    
    // Nếu không phải admin/employee VÀ (không tìm thấy customer hoặc ID không khớp)
    if (!isAdminOrEmployee && (!customerOfUser || customerOfUser.id_kh !== order.id_kh)) {
       return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
    }

    // Nếu là admin/employee hoặc là chủ đơn hàng
    res.json({ success: true, data: order });
    
  } catch (err) {
    console.error(`❌ Lỗi [getOrderById ${req.params.id}]:`, err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy chi tiết đơn hàng." });
  }
}
// 💡💡💡 === KẾT THÚC PHẦN CODE THÊM LẠI === 💡💡💡


/**
 * 🔄 Cập nhật trạng thái (Admin) - Đã sửa thông báo
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    let { trang_thai } = req.body; 

    if (!trang_thai) return res.status(400).json({ success: false, message: "Thiếu trạng thái." });
    const newStatus = trang_thai.toLowerCase(); 

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const prevStatus = order.trang_thai ? order.trang_thai.toLowerCase() : "unknown";
    if (prevStatus === newStatus) return res.json({ success: true, message: "Trạng thái không đổi.", data: order });

    // ... (Logic kiểm tra hợp lệ STATUS_SEQUENCE giữ nguyên) ...
    const STATUS_SEQUENCE = { "pending": 1, "pending_payment": 1, "confirmed": 2, "shipped": 2, "paid": 2, "completed": 3, "done": 3, "cancelled": 4 };
    const prevValue = STATUS_SEQUENCE[prevStatus] || 0; 
    const newValue = STATUS_SEQUENCE[newStatus];

    if (!newValue) return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });
    if (prevValue === 3 || prevValue === 4) return res.status(400).json({ success: false, message: "Đơn đã hoàn tất/hủy, không thể sửa." });
    if (newValue < prevValue && newValue !== prevValue) return res.status(400).json({ success: false, message: "Không thể quay ngược trạng thái." });

    await order.update({ trang_thai: newStatus }); 
    await order.reload();

    // 💡 Gửi thông báo (Đã Việt hóa)
    if (order.id_kh) {
      const c = await Customer.findByPk(order.id_kh);
      if (c?.id_tk) {
        // 💡💡💡 Dùng getStatusVi tại đây 💡💡💡
        const statusVi = getStatusVi(newStatus);
        await pushNoti({
          id_tk: c.id_tk,
          type: "order",
          title: `Cập nhật đơn hàng #${order.id_don}`,
          message: `Trạng thái mới: ${statusVi}.`,
        });
      }
    }

    if (newValue === 3) {
      await awardPointsIfEligible(order); 
    }

    res.json({ success: true, message: "Cập nhật thành công", data: order.toJSON() });
  } catch (e) {
    console.error("Lỗi updateOrderStatus:", e);
    res.status(500).json({ success: false, message: "Lỗi server." });
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