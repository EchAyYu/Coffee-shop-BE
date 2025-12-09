// src/controllers/orders.controller.js

import { Op, fn, col } from "sequelize"; // 🔹 thêm fn, col
import sequelize from "../utils/db.js";
import db from "../models/index.js"; // dùng để lấy các model chính đã khai báo quan hệ
import { sendOrderConfirmationEmail } from "../utils/mailer.js";
import { emitToUser } from "../socket.js";

// 🧾 Import trực tiếp Voucher & VoucherRedemption (giống voucher.controller)
import Voucher from "../models/Voucher.js";
import VoucherRedemption from "../models/VoucherRedemption.js";

// Áp dụng khuyến mãi theo thời gian, danh mục, món
import {
  getActivePromotionsNow,
  applyPromotionsToProduct,
} from "../utils/promotionPricing.js";

// 🔹 Dùng cho thống kê theo tuần/tháng/năm
import {
  getCurrentWeekRange,
  getCurrentMonthRange,
  getCurrentYearRange, // 💡 thêm cho export year
} from "../utils/dateRange.js";

// Lấy các model còn lại từ db
const { Order, OrderDetail, Product, Customer, Account, Notification } = db;

// 💡 MAP DỊCH TRẠNG THÁI SANG TIẾNG VIỆT 💡
// 👉 GIỮ NGUYÊN status trong DB (EN), chỉ dịch ra VI khi hiển thị
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

const getStatusVi = (status) => {
  return ORDER_STATUS_VI[status?.toLowerCase()] || status;
};

// 🔹 Dùng cho thống kê (KHÔNG đổi trạng thái trong DB)
const SUCCESS_ORDER_STATUSES = [
  "completed",
  "done",
  "paid",
  "shipped",
  "confirmed",
];
const CANCELLED_ORDER_STATUSES = ["cancelled"];

// ====== Helper: tạo thông báo ======
async function pushNoti({ id_tk, type = "order", title, message }) {
  if (!id_tk) return;
  try {
    const newNotification = await Notification.create({
      id_tk,
      type,
      title,
      message,
    });
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
      diem_nhan_duoc: pointsToAdd,
    });

    await pushNoti({
      id_tk: customer.id_tk,
      type: "loyalty",
      title: `Tích điểm từ đơn #${order.id_don}`,
      message: `Bạn vừa nhận được ${pointsToAdd} điểm. Tổng điểm hiện tại: ${
        currentPoints + pointsToAdd
      }.`,
    });
  } catch (e) {
    console.error("awardPointsIfEligible error:", e?.message);
  }
}

/**
 * 🔔 Helper: Gửi email hóa đơn khi đơn được thanh toán / hoàn thành
 * - Chỉ gửi khi trạng thái chuyển sang: paid | completed | done
 * - Không gửi lại nếu trước đó đã ở 1 trong các trạng thái này
 */
async function sendInvoiceEmailIfStatusCompleted(prevStatus, newStatus, orderId) {
  const paidLikeStatuses = ["paid", "completed", "done"];

  const wasPaidLike = paidLikeStatuses.includes(
    (prevStatus || "").toLowerCase()
  );
  const isNowPaidLike = paidLikeStatuses.includes(
    (newStatus || "").toLowerCase()
  );

  // Chỉ gửi nếu từ trạng thái chưa xong → sang trạng thái đã thanh toán / hoàn thành
  if (!isNowPaidLike || wasPaidLike) return;

  try {
    const fullOrder = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderDetail,
          include: [{ model: Product, attributes: ["id_mon", "ten_mon"] }],
        },
      ],
    });

    if (!fullOrder) return;
    if (!fullOrder.email_nhan) {
      console.warn(
        `Đơn hàng #${orderId} không có email_nhan, bỏ qua gửi hóa đơn.`
      );
      return;
    }

    const orderDetailsForMail = (fullOrder.OrderDetails || []).map((d) => ({
      id_mon: d.id_mon,
      so_luong: d.so_luong,
      gia: d.gia,
      Product: {
        ten_mon: d.Product?.ten_mon || "Sản phẩm",
      },
    }));

    await sendOrderConfirmationEmail(fullOrder, orderDetailsForMail);
  } catch (err) {
    console.error(
      `sendInvoiceEmailIfStatusCompleted error for order #${orderId}:`,
      err?.message || err
    );
  }
}

// ========== Lịch sử đơn của tôi ==========
export async function getMyOrders(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    let status = (req.query.status || "completed,done,cancelled")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (status.includes("completed") && !status.includes("done")) {
      status.push("done");
    }

    const meAccountId = req.user?.id_tk || req.user?.id;
    const meCustomer = await Customer.findOne({ where: { id_tk: meAccountId } });
    if (!meCustomer)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy khách hàng" });

    const where = {
      id_kh: meCustomer.id_kh,
      trang_thai: { [Op.in]: status },
    };

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderDetail,
          required: true,
          include: [
            {
              model: Product,
              attributes: ["id_mon", "ten_mon", "anh"],
            },
          ],
        },
      ],
      order: [["ngay_dat", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit,
      },
    });
  } catch (e) {
    console.error("getMyOrders error:", e);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy lịch sử đơn hàng.",
    });
  }
}

/**
 * 🛒 Tạo đơn hàng (có áp dụng khuyến mãi & voucher)
 * ➕ ĐÃ THÊM: Gửi email xác nhận ngay sau khi tạo đơn (nếu có email_nhan)
 */
export async function createOrder(req, res) {
  const {
    ho_ten_nhan,
    sdt_nhan,
    dia_chi_nhan,
    email_nhan,
    pttt,
    ghi_chu,
    items,
    voucher_code, // ✅ chỉ 1 voucher cho 1 đơn
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Giỏ hàng trống." });
  }

  const user = req.user;
  let customer = null;
  let id_kh = null;

  // Tìm / tạo khách hàng nếu đã đăng nhập
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
    } catch (err) {
      console.error("Lỗi tìm/tạo Customer:", err);
      return res
        .status(500)
        .json({ success: false, message: "Lỗi hệ thống khách hàng." });
    }
  }

  // ===== Tính subtotal (đã áp khuyến mãi) =====
  let calculatedTotal = 0;
  const productDetails = [];
  let hasDiscountedItem = false; // ⭐ bất kỳ sản phẩm nào có khuyến mãi?

  try {
    const productIds = items.map((item) => item.id_mon);

    const productsInDb = await Product.findAll({
      where: { id_mon: { [Op.in]: productIds } },
      attributes: ["id_mon", "gia", "ten_mon", "id_dm"],
    });

    const productMap = new Map(
      productsInDb.map((p) => [p.id_mon, p.toJSON()])
    );

    // 🔥 Lấy các khuyến mãi đang active ngay lúc này
    const activePromos = await getActivePromotionsNow();

    for (const item of items) {
      const productInfo = productMap.get(item.id_mon);
      if (!productInfo) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ID ${item.id_mon} không tồn tại.`,
        });
      }

      const giaGoc = Number(productInfo.gia);

      // Áp khuyến mãi cho từng món
      const priced = applyPromotionsToProduct(
        {
          id_mon: productInfo.id_mon,
          id_dm: productInfo.id_dm,
          gia: giaGoc,
        },
        activePromos
      );

      const itemPrice = Number(priced.gia_km ?? giaGoc);

      // Nếu giá sau khuyến mãi < giá gốc => món này đang được KM
      if (itemPrice < giaGoc) {
        hasDiscountedItem = true;
      }

      calculatedTotal += itemPrice * item.so_luong;

      // Lưu chi tiết đã áp KM
      productDetails.push({
        id_mon: item.id_mon,
        so_luong: item.so_luong,
        gia: itemPrice, // lưu giá sau khuyến mãi vào chi tiết đơn
        Product: { ten_mon: productInfo.ten_mon },
      });
    }
  } catch (dbError) {
    console.error("Lỗi kiểm tra sản phẩm:", dbError);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi kiểm tra sản phẩm." });
  }

  // ===== Xử lý voucher (CHỈ 1 MÃ) =====
  let discount = 0;
  let redemptionToUse = null;

  try {
    if (voucher_code) {
      // ⛔ RULE 2: Không cho dùng voucher nếu giỏ có sản phẩm đang khuyến mãi
      if (hasDiscountedItem) {
        return res.status(400).json({
          success: false,
          message:
            "Đơn hàng có sản phẩm đang được khuyến mãi nên không thể áp dụng voucher.",
        });
      }

      if (!user?.id_tk) {
        return res.status(401).json({
          success: false,
          message: "Cần đăng nhập để dùng voucher.",
        });
      }

      // 1) Tìm mã cá nhân
      redemptionToUse = await VoucherRedemption.findOne({
        where: { code: voucher_code, id_tk: user.id_tk },
      });

      if (!redemptionToUse) {
        return res.status(400).json({
          success: false,
          message: "Mã voucher không hợp lệ hoặc không thuộc về bạn.",
        });
      }

      if (redemptionToUse.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Mã voucher đã dùng hoặc không còn hiệu lực.",
        });
      }

      if (
        redemptionToUse.expires_at &&
        new Date(redemptionToUse.expires_at) <= new Date()
      ) {
        redemptionToUse.status = "expired";
        await redemptionToUse.save();
        return res
          .status(400)
          .json({ success: false, message: "Mã voucher đã hết hạn." });
      }

      // 2) Lấy voucher mẫu
      const voucher = await Voucher.findByPk(redemptionToUse.voucher_id);
      if (!voucher) {
        return res.status(400).json({
          success: false,
          message: "Voucher không tồn tại.",
        });
      }

      // 3) Kiểm tra giá trị tối thiểu
      if (calculatedTotal < Number(voucher.min_order || 0)) {
        return res.status(400).json({
          success: false,
          message: "Chưa đạt giá trị tối thiểu để dùng mã.",
        });
      }

      // 4) Tính số tiền giảm (chỉ 1 voucher)
      if (voucher.discount_type === "fixed") {
        discount = Number(voucher.discount_value);
      } else {
        discount = (calculatedTotal * Number(voucher.discount_value)) / 100;
      }
      const cap = voucher.max_discount
        ? Number(voucher.max_discount)
        : discount;
      discount = Math.min(discount, cap, calculatedTotal);
    }
  } catch (e) {
    console.error("❌ Lỗi xử lý voucher:", e);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xử lý voucher.",
    });
  }

  // ===== Tạo đơn & chi tiết đơn =====
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

    const orderDetailData = productDetails.map((detail) => ({
      ...detail,
      id_don: newOrder.id_don,
    }));
    await OrderDetail.bulkCreate(orderDetailData);

    // Đánh dấu voucher đã dùng (CHỈ 1 MÃ)
    if (redemptionToUse) {
      await redemptionToUse.update({
        status: "used",
        used_order_id: newOrder.id_don,
        used_at: new Date(),
      });
    }

    // Gửi thông báo
    if (id_kh && user?.id_tk) {
      const statusVi = getStatusVi(newOrder.trang_thai);
      await pushNoti({
        id_tk: user.id_tk,
        type: "order",
        title: `Đặt hàng thành công #${newOrder.id_don}`,
        message: `Đơn của bạn đang ở trạng thái ${statusVi}.`,
      });
    }

    // 💌 GỬI EMAIL XÁC NHẬN ĐƠN HÀNG (nếu có email_nhan)
    if (email_nhan) {
      try {
        const orderDetailsForMail = productDetails.map((d) => ({
          id_mon: d.id_mon,
          so_luong: d.so_luong,
          gia: d.gia,
          Product: { ten_mon: d.Product?.ten_mon || "Sản phẩm" },
        }));
        await sendOrderConfirmationEmail(newOrder, orderDetailsForMail);
      } catch (mailErr) {
        console.error(
          `❌ Lỗi gửi email xác nhận cho đơn #${newOrder.id_don}:`,
          mailErr?.message || mailErr
        );
        // Không throw, để không làm fail việc tạo đơn
      }
    }

    return res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công!",
      data: {
        id_don: newOrder.id_don,
        trang_thai: newOrder.trang_thai,
        tong_tien: newOrder.tong_tien,
        discount,
      },
    });
  } catch (err) {
    console.error("Lỗi tạo đơn:", err);
    if (newOrder?.id_don) {
      try {
        await OrderDetail.destroy({ where: { id_don: newOrder.id_don } });
        await Order.destroy({ where: { id_don: newOrder.id_don } });
      } catch (_) {}
    }
    return res
      .status(500)
      .json({ success: false, message: "Lỗi tạo đơn hàng." });
  }
}

/**
 * 🏷️ Lấy chi tiết đơn (Fix lỗi crash)
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, attributes: ["id_kh", "ho_ten", "email"] },
        {
          model: OrderDetail,
          required: false,
          include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }],
        },
      ],
    });

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    const isAdminOrEmployee =
      user.role === "admin" || user.role === "employee";

    let customerOfUser = null;
    if (user.role === "customer") {
      customerOfUser = await Customer.findOne({
        where: { id_tk: user.id_tk },
        attributes: ["id_kh"],
      });
    }

    if (
      !isAdminOrEmployee &&
      (!customerOfUser || customerOfUser.id_kh !== order.id_kh)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền xem đơn hàng này" });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error(`❌ Lỗi [getOrderById ${req.params.id}]:`, err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết đơn hàng.",
    });
  }
}

/**
 * 🔄 Cập nhật trạng thái (Admin)
 * ➕ ĐÃ THÊM: gửi email hóa đơn khi chuyển sang paid/completed/done
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    let { trang_thai } = req.body;

    if (!trang_thai) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu trạng thái." });
    }

    const newStatus = trang_thai.toLowerCase();

    const order = await Order.findByPk(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    const prevStatus = order.trang_thai
      ? order.trang_thai.toLowerCase()
      : "unknown";

    if (prevStatus === newStatus) {
      return res.json({
        success: true,
        message: "Trạng thái không đổi.",
        data: order,
      });
    }

    const STATUS_SEQUENCE = {
      pending: 1,
      pending_payment: 1,
      confirmed: 2,
      shipped: 2,
      paid: 2,
      completed: 3,
      done: 3,
      cancelled: 4,
    };

    const prevValue = STATUS_SEQUENCE[prevStatus] || 0;
    const newValue = STATUS_SEQUENCE[newStatus];

    if (!newValue) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ." });
    }
    if (prevValue === 3 || prevValue === 4) {
      return res.status(400).json({
        success: false,
        message: "Đơn đã hoàn tất/hủy, không thể sửa.",
      });
    }
    if (newValue < prevValue && newValue !== prevValue) {
      return res.status(400).json({
        success: false,
        message: "Không thể quay ngược trạng thái.",
      });
    }

    await order.update({ trang_thai: newStatus });
    await order.reload();

    if (order.id_kh) {
      const c = await Customer.findByPk(order.id_kh);
      if (c?.id_tk) {
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

    // 💌 GỬI EMAIL HÓA ĐƠN NẾU CHUYỂN SANG paid/completed/done
    await sendInvoiceEmailIfStatusCompleted(prevStatus, newStatus, order.id_don);

    res.json({
      success: true,
      message: "Cập nhật thành công",
      data: order.toJSON(),
    });
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
      const deletedOrderRows = await Order.destroy({
        where: { id_don: id },
        transaction: t,
      });
      return deletedOrderRows;
    });

    if (result === 0)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    res.json({ success: true, message: "Đã xóa đơn hàng thành công" });
  } catch (err) {
    console.error(`❌ Lỗi [deleteOrder ${req.params.id}]:`, err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa đơn hàng.",
    });
  }
}

/**
 * 📦 Danh sách đơn hàng (Admin)
 */
export async function getOrdersAdmin(req, res) {
  try {
    // 1. Phân trang
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;

    // 2. Tab: "active" (đơn cần xử lý) | "completed" (đã hoàn thành/hủy)
    const tab = (req.query.tab || "active").toLowerCase();

    // 3. Lọc theo ngày (chủ yếu dùng cho tab completed – đơn trong ngày)
    const date = req.query.date; // 'YYYY-MM-DD' hoặc undefined

    // 4. Xây dựng điều kiện where
    const where = {};

    // Các trạng thái “chưa xong” – cần admin/nhân viên xử lý
    const ACTIVE_STATUSES = [
      "pending", // Chờ xác nhận
      "pending_payment", // Chờ thanh toán
      "confirmed", // Đã xác nhận
      "PREORDER", // Đặt trước
      "shipped", // Đang giao (hoặc đã chuyển giao)
    ];

    // Các trạng thái đã kết thúc (hoàn thành / hủy / đã thanh toán xong)
    const COMPLETED_STATUSES = [
      "completed", // Đã hoàn thành
      "done", // Đã hoàn thành (trạng thái cũ)
      "paid", // Đã thanh toán
      "cancelled", // Đã hủy
    ];

    if (tab === "completed") {
      where.trang_thai = { [Op.in]: COMPLETED_STATUSES };
    } else {
      // mặc định: active
      where.trang_thai = { [Op.in]: ACTIVE_STATUSES };
    }

    if (date) {
      // date từ FE dạng 'YYYY-MM-DD' (ngày LOCAL – ví dụ VN +7)
      // Tạo khoảng thời gian từ 00:00:00 đến 23:59:59.999 LOCAL
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59.999`);

      where.ngay_dat = {
        [Op.between]: [startOfDay, endOfDay],
      };
    }

    // 5. Query có phân trang
    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        { model: Customer, attributes: ["id_kh", "ho_ten", "email", "sdt"] },
        {
          model: OrderDetail,
          include: [
            { model: Product, attributes: ["id_mon", "ten_mon", "anh"] },
          ],
        },
      ],
      order: [["ngay_dat", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages: Math.max(Math.ceil(count / limit), 1),
      },
    });
  } catch (err) {
    console.error("getOrdersAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tải danh sách đơn hàng.",
    });
  }
}

// =======================
// 📤 EXPORT ĐƠN HÀNG RA CSV (THEO KỲ)
// =======================
export async function exportAdminOrdersCsv(req, res) {
  try {
    const period = (req.query.period || "month").toLowerCase();
    let range;

    if (period === "week") range = getCurrentWeekRange();
    else if (period === "year") range = getCurrentYearRange();
    else range = getCurrentMonthRange(); // mặc định: tháng

    const { start, end } = range;

    const orders = await Order.findAll({
      where: {
        ngay_dat: { [Op.between]: [start, end] },
      },
      include: [
        {
          model: Customer,
          attributes: ["ho_ten", "email", "sdt"],
        },
        {
          model: OrderDetail,
          include: [{ model: Product, attributes: ["ten_mon"] }],
        },
      ],
      order: [["ngay_dat", "ASC"]],
    });

    // Header CSV
    const header = [
      "ID đơn",
      "Ngày đặt",
      "Khách hàng",
      "Email",
      "SĐT",
      "Tổng tiền",
      "Trạng thái",
      "Chi tiết sản phẩm",
    ];

    const rows = orders.map((o) => {
      const products = (o.OrderDetails || [])
        .map(
          (d) =>
            `${d.Product?.ten_mon || "Không rõ"} x${d.so_luong} (${d.gia}đ)`
        )
        .join(" | ");

      return [
        o.id_don,
        o.ngay_dat ? new Date(o.ngay_dat).toLocaleString("vi-VN") : "",
        o.Customer?.ho_ten || o.ho_ten_nhan || "Khách vãng lai",
        o.Customer?.email || o.email_nhan || "",
        o.Customer?.sdt || o.sdt_nhan || "",
        o.tong_tien,
        o.trang_thai,
        products,
      ];
    });

    const csvLines = [
      header.join(","), // dòng header
      ...rows.map((r) =>
        r
          .map((cell) =>
            typeof cell === "string"
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          )
          .join(",")
      ),
    ];

    const csvContent = csvLines.join("\n");

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders_${period}.csv"`
    );

    res.send("\ufeff" + csvContent); // BOM UTF-8 cho Excel
  } catch (err) {
    console.error("exportAdminOrdersCsv error:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi xuất CSV đơn hàng." });
  }
}

/**
 * 📊 Thống kê đơn hàng (Admin) theo tuần / tháng
 * GET /api/admin/orders-stats?period=week|month
 */
export async function getAdminOrderStats(req, res) {
  try {
    const period = (req.query.period || "month").toLowerCase();

    // Xác định khoảng thời gian
    let range;
    if (period === "week") {
      range = getCurrentWeekRange();
    } else {
      // mặc định: tháng
      range = getCurrentMonthRange();
    }

    const { start, end } = range;

    // Điều kiện theo ngày đặt
    const baseWhere = {
      ngay_dat: { [Op.between]: [start, end] },
    };

    // Tổng số đơn trong kỳ
    const totalOrders = await Order.count({
      where: baseWhere,
    });

    // Số đơn hoàn thành trong kỳ
    const completedOrders = await Order.count({
      where: {
        ...baseWhere,
        trang_thai: { [Op.in]: SUCCESS_ORDER_STATUSES },
      },
    });

    // Số đơn đã hủy trong kỳ
    const cancelledOrders = await Order.count({
      where: {
        ...baseWhere,
        trang_thai: { [Op.in]: CANCELLED_ORDER_STATUSES },
      },
    });

    // Doanh thu trong kỳ (chỉ tính đơn thành công)
    const revenue = await Order.sum("tong_tien", {
      where: {
        ...baseWhere,
        trang_thai: { [Op.in]: SUCCESS_ORDER_STATUSES },
      },
    });

    // Tính %
    const completedPercent =
      totalOrders > 0
        ? Math.round((completedOrders * 100) / totalOrders)
        : 0;

    const cancelledPercent =
      totalOrders > 0
        ? Math.round((cancelledOrders * 100) / totalOrders)
        : 0;

    return res.json({
      success: true,
      data: {
        period,
        range: {
          start,
          end,
        },
        totalOrders,
        completedOrders,
        cancelledOrders,
        completedPercent,
        cancelledPercent,
        periodRevenue: Number(revenue) || 0,
        // Giữ compatibility với code FE cũ (periodRevenue vs revenue)
        revenue: Number(revenue) || 0,
      },
    });
  } catch (err) {
    console.error("getAdminOrderStats error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thống kê đơn hàng.",
    });
  }
}
