import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";

export async function createOrder(req, res) {
  try {
    const { id_kh, ho_ten_nhan, sdt_nhan, dia_chi_nhan, pttt, items } = req.body;

    const order = await Order.create({
      id_kh,
      ho_ten_nhan,
      sdt_nhan,
      dia_chi_nhan,
      pttt,
    });

    for (let it of items) {
      const product = await Product.findByPk(it.id_mon);
      if (product) {
        await OrderDetail.create({
          id_don: order.id_don,
          id_mon: product.id_mon,
          so_luong: it.so_luong,
          gia: product.gia,
        });
      }
    }

    res.json({ message: "Tạo đơn thành công", orderId: order.id_don });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

export async function getOrders(req, res) {
  try {
    const orders = await Order.findAll({ include: OrderDetail });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

export async function getOrderById(req, res) {
  try {
    const order = await Order.findByPk(req.params.id, { include: OrderDetail });
    if (!order) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
