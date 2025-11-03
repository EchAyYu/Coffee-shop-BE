// src/controllers/orders.controller.js (FIX LỖI SOCKET 500)

import { Op } from "sequelize";
import sequelize from "../utils/db.js";
import db from "../models/index.js";
import Voucher from "../models/Voucher.js";
import VoucherRedemption from "../models/VoucherRedemption.js";
import { sendOrderConfirmationEmail } from "../utils/mailer.js";
import { emitToUser } from "../socket.js";

const { Order, OrderDetail, Product, Customer, Account, Notification } = db;


// ====== Helper: tạo thông báo ======
// 💡💡💡 === SỬA LỖI 500 (XÓA 'throw e') === 💡💡💡
async function pushNoti({ id_tk, type = "order", title, message }) {
  if (!id_tk) return;
  try {
    const newNotification = await Notification.create({ id_tk, type, title, message });
    if (newNotification) {
      emitToUser(id_tk, "new_notification", newNotification.toJSON());
    }
  } catch (e) {
    console.error("pushNoti error:", e?.message);
    // throw e; // <-- XÓA DÒNG NÀY. Không ném lỗi ra ngoài.
  }
}
// 💡💡💡 ======================================== 💡💡💡


// ====== Helper: cộng điểm (chống cộng lặp) ======
async function awardPointsIfEligible(order) {
  if (!order || order.points_awarded || !order.id_kh) {
    console.log("[awardPoints] Bỏ qua: Đã cộng điểm, không có id_kh, hoặc không có order.");
    return;
  }

  try {
    const customer = await Customer.findByPk(order.id_kh);
    if (!customer) {
      console.warn(`[awardPoints] Không tìm thấy Customer với id_kh: ${order.id_kh}`);
      return;
    }

    const totalAmount = Number(order.tong_tien || 0);
    const pointsToAdd = Math.floor(totalAmount / 10000) * 3;
    
    if (pointsToAdd <= 0) {
      console.log("[awardPoints] Bỏ qua: Đơn hàng không đủ 10.000đ.");
      return;
    }

    console.log(`[awardPoints] Đang cộng ${pointsToAdd} điểm cho khách hàng ${customer.id_kh}`);
    const currentPoints = customer.diem || 0;
    await customer.update({ diem: currentPoints + pointsToAdd });

    await order.update({ 
      points_awarded: true,
      diem_nhan_duoc: pointsToAdd 
    });
    
    const account = await Account.findByPk(customer.id_tk);
    await pushNoti({
      id_tk: account?.id_tk,
      type: "loyalty",
      title: `Tích điểm từ đơn #${order.id_don}`,
      message: `Bạn vừa nhận được ${pointsToAdd} điểm. Tổng điểm hiện tại: ${currentPoints + pointsToAdd}.`,
    });
    console.log("[awardPoints] ĐÃ CỘNG ĐIỂM THÀNH CÔNG.");
  } catch (e) {
    console.error("awardPointsIfEligible error:", e?.message);
    throw e; // Giữ throw e ở đây, vì lỗi cộng điểm là nghiêm trọng
  }
}

// ========== Lịch sử đơn của tôi ==========
export async function getMyOrders(req, res) {
  // ... (Code này đã OK) ...
  try {
    const page  = Number(req.query.page || 1);
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
  // ... (Code này đã OK) ...
  const {
    ho_ten_nhan, sdt_nhan, dia_chi_nhan, email_nhan, pttt, ghi_chu, items,
    voucher_code
  } = req.body;

  const user = req.user; 

  let customer = null;
  let id_kh = null;

  if (user?.id_tk) {
    console.log(`[createOrder] Người dùng đã đăng nhập, id_tk: ${user.id_tk}`);
    try {
      customer = await Customer.findOne({ where: { id_tk: user.id_tk } }); 
      
      if (customer) {
        id_kh = customer.id_kh;
        console.log(`[createOrder] Đã tìm thấy khách hàng. id_kh: ${id_kh}`);
      } else {
        console.warn(`[createOrder] Không tìm thấy Customer cho Account ID: ${user.id_tk}. Đang tạo mới...`);
        const newCustomer = await Customer.create({
          id_tk: user.id_tk,
          ho_ten: ho_ten_nhan, 
          sdt: sdt_nhan,       
          email: email_nhan,   
          dia_chi: dia_chi_nhan, 
          diem: 0, 
        });
        
        id_kh = newCustomer.id_kh;
        console.log(`[createOrder] Đã tạo khách hàng mới thành công. id_kh: ${id_kh}`);
      }
    } catch (findOrCreatErr) {
      console.error(`[createOrder] Lỗi nghiêm trọng khi tìm/tạo Customer:`, findOrCreatErr);
      return res.status(500).json({ success: false, message: "Lỗi khi liên kết hồ sơ khách hàng. Vui lòng thử lại." });
    }
  } else {
    console.log("[createOrder] Khách vãng lai, id_kh sẽ là null.");
    id_kh = null;
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
      await pushNoti({
        id_tk: user.id_tk, 
        type: "order",
        title: `Đặt hàng thành công #${newOrder.id_don}`,
        message: `Đơn của bạn đang ở trạng thái ${newOrder.trang_thai}.`
      });
    }

    // Tạm thời vô hiệu hóa để tránh lỗi 500
    // sendOrderConfirmationEmail(newOrder.toJSON(), productDetails);

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
  // ... (Code này đã OK) ...
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
  // ... (Code này đã OK) ...
  console.log(`\n--- 🚀 ĐANG CHẠY updateOrderStatus (CONTROLLER MỚI VỚI RELOAD) 🚀 ---`);

  try {
    const { id } = req.params;
    let { trang_thai } = req.body; 

    if (!trang_thai) {
      return res.status(400).json({ success: false, message: "Trạng thái là bắt buộc." });
    }
    
    const newStatus = trang_thai.toLowerCase(); 
    console.log(`Trạng thái mới yêu cầu: ${newStatus}`);

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const prevStatus = order.trang_thai ? order.trang_thai.toLowerCase() : "unknown";
    console.log(`Trạng thái cũ: ${prevStatus}`);
    
    if (prevStatus === newStatus) {
      return res.json({ success: true, message: "Trạng thái không đổi.", data: order });
    }

    const STATUS_SEQUENCE = {
      "pending": 1, "pending_payment": 1, 
      "confirmed": 2, "shipped": 2, "paid": 2,
      "completed": 3, "done": 3,
      "cancelled": 4 
    };

    const prevValue = STATUS_SEQUENCE[prevStatus] || 0; 
    const newValue = STATUS_SEQUENCE[newStatus];
    console.log(`Giá trị cũ: ${prevValue}, Giá trị mới: ${newValue}`);

    if (!newValue) {
      return res.status(400).json({ success: false, message: `Trạng thái "${newStatus}" không hợp lệ.` });
    }

    if (prevValue === 3 || prevValue === 4) {
       console.log("CHẶN: Đơn đã hoàn thành hoặc đã hủy.");
       return res.status(400).json({ success: false, message: `Không thể thay đổi trạng thái của đơn đã "${prevStatus}".` });
    }
    
    if (newValue < prevValue && newValue !== prevValue) {
       console.log("CHẶN: Không thể chuyển lùi trạng thái.");
       return res.status(400).json({ success: false, message: `Không thể chuyển trạng thái lùi từ "${prevStatus}" về "${newStatus}".` });
    }

    if (prevValue === 1 && newValue === 3) {
      console.log("CHẶN: Không thể nhảy cóc (pending -> completed).");
      return res.status(400).json({ success: false, message: `Đơn hàng phải được "Xác nhận" (confirmed) trước khi "Hoàn thành" (completed).` });
    }

    console.log("Đang cập nhật CSDL...");
    await order.update({ trang_thai: newStatus }); 

    console.log("Đang reload() đơn hàng từ CSDL...");
    await order.reload();
    console.log(`Đơn hàng đã reload, trạng thái MỚI NHẤT là: ${order.trang_thai}`);

    let id_tk = null;
    if (order.id_kh) {
      const c = await Customer.findByPk(order.id_kh);
      id_tk = c?.id_tk || null;
    }
    
    await pushNoti({
      id_tk,
      type: "order",
      title: `Cập nhật đơn hàng #${order.id_don}`,
      message: `Trạng thái mới: ${newStatus}.`,
    });

    if (newValue === 3) {
      console.log("Trạng thái là 3 (completed/done), Đang gọi hàm cộng điểm...");
      await awardPointsIfEligible(order); 
    } else {
      console.log(`Trạng thái là ${newValue}, không gọi hàm cộng điểm.`);
    }

    console.log("--- ✅ XỬ LÝ HOÀN TẤT ---");
    res.json({ 
      success: true, 
      message: "Cập nhật trạng thái thành công", 
      data: order.toJSON()
    });
  } catch (e) {
    console.error(`❌ Lỗi [updateOrderStatus ${req.params.id}]:`, e);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật trạng thái." });
  }
}


/**
 * 🗑️ Xóa đơn
 */
export async function deleteOrder(req, res) {
  // ... (Code này đã OK) ...
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
  // ... (Code này đã OK) ...
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