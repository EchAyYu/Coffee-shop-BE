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
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const ord = await Order.findByPk(id);
    if (!ord) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    // Quy tắc chuyển trạng thái (tuỳ ý, có thể nới lỏng)
    // PENDING -> CONFIRMED/PAID/CANCELLED
    // CONFIRMED -> PAID/SHIPPED/CANCELLED
    // PAID -> SHIPPED/DONE
    // SHIPPED -> DONE
    // DONE -> (final)
    // CANCELLED -> (final)
    const current = ord.trang_thai || "PENDING";
    const allowedNext = {
      PENDING:   ["CONFIRMED", "PAID", "CANCELLED"],
      CONFIRMED: ["PAID", "SHIPPED", "CANCELLED"],
      PAID:      ["SHIPPED", "DONE"],
      SHIPPED:   ["DONE"],
      DONE:      [],
      CANCELLED: [],
    };

    if (!allowedNext[current].includes(status)) {
      return res.status(400).json({ message: `Không thể chuyển từ ${current} -> ${status}` });
    }

    await ord.update({ trang_thai: status });
    res.json({ message: "Cập nhật thành công", id_don: ord.id_don, trang_thai: status });
  } catch (e) {
    console.error("[updateOrderStatus]", e);
    res.status(500).json({ message: "Server error" });
  }
}

export async function createOrder(req, res) {
  try {
    // Lấy dữ liệu từ body
    const { id_kh, ho_ten_nhan, sdt_nhan, dia_chi_nhan, pttt, chi_tiet } = req.body;
    // Tạo đơn hàng mới
   const order = await Order.create({
  id_kh,
  ho_ten_nhan,
  sdt_nhan,
  dia_chi_nhan,
  pttt,
  trang_thai: "PENDING",
  ngay_dat: new Date(),
});

    // Nếu có chi tiết đơn hàng, thêm vào bảng OrderDetail
    if (Array.isArray(chi_tiet)) {
      for (const ct of chi_tiet) {
        await OrderDetail.create({
          id_don: order.id_don,
          id_mon: ct.id_mon,
          so_luong: ct.so_luong,
          gia: ct.gia,
        });
      }
    }
    res.status(201).json({ message: "Tạo đơn hàng thành công", order });
  } catch (err) {
    res.status(500).json({ message: "Lỗi tạo đơn hàng", error: err.message });
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