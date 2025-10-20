// server/src/controllers/orders.controller.js
import { Op } from "sequelize";
import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";

// GỢI Ý: đảm bảo đã khai báo association ở đâu đó lúc khởi tạo app:
// OrderDetail.belongsTo(Product, { foreignKey: "id_mon" });
// Order.hasMany(OrderDetail, { foreignKey: "id_don" });

const ALLOWED_STATUS = ["PENDING", "CONFIRMED", "PAID", "SHIPPED", "DONE", "CANCELLED"];

// GET /api/admin/orders?status=&from=&to=&q=&page=&limit=
export async function getOrdersAdmin(req, res) {
  try {
    const { status, from, to, q, page = 1, limit = 20 } = req.query;
    const where = {};

    if (status && ALLOWED_STATUS.includes(status)) where.trang_thai = status;
    if (from || to) {
      where.ngay_dat = {
        ...(from ? { [Op.gte]: new Date(from) } : {}),
        ...(to ?   { [Op.lte]: new Date(to) }   : {}),
      };
    }

    // Tìm theo tên/sđt người nhận
    if (q) {
      where[Op.or] = [
        { ho_ten_nhan: { [Op.like]: `%${q}%` } },
        { sdt_nhan: { [Op.like]: `%${q}%` } },
        { dia_chi_nhan: { [Op.like]: `%${q}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [{
        model: OrderDetail,
        required: false,
        include: [{ model: Product, attributes: ["id_mon", "ten_mon", "gia"] }]
      }],
      order: [["ngay_dat", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.json({
      total: count,
      page: Number(page),
      limit: Number(limit),
      data: rows,
    });
  } catch (e) {
    console.error("[getOrdersAdmin]", e);
    res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/orders/:id/status  (admin/employee)
// ✅ PUT /api/orders/:id/status (admin/employee)
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { trang_thai } = req.body;

    if (!trang_thai || !ALLOWED_STATUS.includes(trang_thai.toUpperCase())) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const ord = await Order.findByPk(id);
    if (!ord) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    const current = ord.trang_thai?.toUpperCase() || "PENDING";
    const allowedNext = {
      PENDING: ["CONFIRMED", "PAID", "CANCELLED"],
      CONFIRMED: ["PAID", "SHIPPED", "CANCELLED"],
      PAID: ["SHIPPED", "DONE"],
      SHIPPED: ["DONE"],
      DONE: [],
      CANCELLED: [],
    };

    const next = trang_thai.toUpperCase();
    if (!allowedNext[current].includes(next)) {
      return res.status(400).json({ message: `Không thể chuyển từ ${current} → ${next}` });
    }

    await ord.update({ trang_thai: next });

    res.json({
      message: "✅ Cập nhật trạng thái thành công",
      data: { id_don: ord.id_don, trang_thai: next },
    });
  } catch (e) {
    console.error("[updateOrderStatus]", e);
    res.status(500).json({ message: "Server error" });
  }
}


export async function createOrder(req, res) {
  try {
    const { items, id_kh, ho_ten_nhan, sdt_nhan, dia_chi_nhan, pttt = "COD" } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Thiếu danh sách sản phẩm (items)" });
    }

    const order = await Order.create({
      id_kh,
      ho_ten_nhan: ho_ten_nhan || "Khách hàng",
      sdt_nhan: sdt_nhan || "000000000",
      dia_chi_nhan: dia_chi_nhan || "Chưa cập nhật",
      pttt,
      trang_thai: "pending",
      ngay_dat: new Date(),
    });

    // ✅ Thêm chi tiết đơn hàng
    for (const item of items) {
      await OrderDetail.create({
        id_don: order.id_don,
        id_mon: item.id_mon,
        so_luong: item.so_luong,
        gia: item.gia,
      });
    }

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công",
      data: order,
    });
  } catch (err) {
    console.error("❌ Lỗi tạo đơn hàng:", err);
    res.status(500).json({ message: "Lỗi máy chủ khi tạo đơn hàng" });
  }
}


export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    await order.destroy();
    res.json({ message: "Đã xóa đơn hàng thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi xóa đơn hàng", error: err.message });
  }
}
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;    
    const order = await Order.findByPk(id, {
      include: [{
        model: OrderDetail,
        required: false,  
        include: [{ model: Product, attributes: ["id_mon", "ten_mon", "gia"] }]
      }],
    });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });    
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy đơn hàng", error: err.message });
  } 
}