import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";

export async function createOrder(req, res) {
  try {
    const { id_kh, ho_ten_nhan, sdt_nhan, dia_chi_nhan, pttt, items } = req.body;

    // 🟢 Tạo đơn hàng
    const order = await Order.create({
      id_kh,
      ho_ten_nhan,
      sdt_nhan,
      dia_chi_nhan,
      pttt,
    });

    // 🟢 Thêm chi tiết đơn hàng
    for (let it of items) {
      const product = await Product.findByPk(it.id_mon);
      if (product) {
        await OrderDetail.create({
          id_don: order.id_don,
          id_mon: product.id_mon,
          so_luong: it.so_luong,
          gia: product.gia, // lưu giá tại thời điểm mua
        });
      }
    }

    res.status(201).json({ message: "Tạo đơn thành công", orderId: order.id_don });
  } catch (err) {
    console.error("❌ createOrder error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Lấy tất cả đơn hàng + chi tiết
export async function getOrders(req, res) {
  try {
    const orders = await Order.findAll({
      include: [
        {
          model: OrderDetail,
          include: [Product], // join luôn sản phẩm
        },
      ],
      order: [["id_don", "DESC"]],
    });
    res.json(orders);
  } catch (err) {
    console.error("❌ getOrders error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Lấy chi tiết 1 đơn hàng
export async function getOrderById(req, res) {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: OrderDetail,
          include: [Product],
        },
      ],
    });

    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    res.json(order);
  } catch (err) {
    console.error("❌ getOrderById error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// 🟢 Cập nhật trạng thái đơn hàng
export async function updateOrderStatus(req, res) {
  try {
    const { trang_thai } = req.body; // pending, confirmed, completed, cancelled
    const order = await Order.findByPk(req.params.id);

    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    await order.update({ trang_thai });
    res.json({ message: "Cập nhật trạng thái thành công", order });
  } catch (err) {
    console.error("❌ updateOrderStatus error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
export async function getAllOrders(req, res) {
  try {
    const orders = await Order.findAll({ include: OrderDetail });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
