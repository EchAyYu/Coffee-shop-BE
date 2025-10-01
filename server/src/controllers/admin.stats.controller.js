// server/src/controllers/admin.stats.controller.js
import { Op, fn, col, literal } from "sequelize";
import Order from "../models/Order.js";
import OrderDetail from "../models/OrderDetail.js";
import Product from "../models/Product.js";

// YÊU CẦU: Đã có associations:
// Order.hasMany(OrderDetail, { foreignKey: "id_don" });
// OrderDetail.belongsTo(Product, { foreignKey: "id_mon" });

export async function getStats(req, res) {
  try {
    const { from, to, by = "day", top = 5 } = req.query;

    const whereOrder = {};
    if (from || to) {
      whereOrder.ngay_dat = {
        ...(from ? { [Op.gte]: new Date(from) } : {}),
        ...(to ?   { [Op.lte]: new Date(to) }   : {}),
      };
    }

    // 1) Revenue series
    // by=day => DATE(ngay_dat); by=month => DATE_FORMAT('%Y-%m')
    const grpExpr = by === "month" ? literal("DATE_FORMAT(ngay_dat, '%Y-%m')") : fn("DATE", col("ngay_dat"));

    // Tính revenue bằng cách SUM(so_luong * gia) qua OrderDetail
    // Ở MySQL, có thể dùng subquery đơn giản:
    const revenueRows = await Order.findAll({
      attributes: [
        [grpExpr, "label"],
        [
          fn(
            "SUM",
            literal("(SELECT IFNULL(SUM(od.so_luong * od.gia),0) FROM ct_don_hang od WHERE od.id_don = `Order`.id_don)")
          ),
          "revenue"
        ],
      ],
      where: whereOrder,
      group: ["label"],
      order: [["label", "ASC"]],
      raw: true,
    });

    // 2) Top món bán chạy
    const topItems = await OrderDetail.findAll({
      attributes: [
        "id_mon",
        [fn("SUM", col("so_luong")), "qty"],
        [fn("SUM", literal("so_luong * gia")), "amount"]
      ],
      include: [{ model: Product, attributes: ["ten_mon"] }],
      group: ["id_mon", "Product.ten_mon"],
      order: [[literal("qty"), "DESC"]],
      limit: Number(top) || 5,
      raw: true,
      nest: true,
    });

    res.json({ revenue: revenueRows, topItems });
  } catch (e) {
    console.error("[admin.getStats]", e);
    res.status(500).json({ message: "Server error" });
  }
}
