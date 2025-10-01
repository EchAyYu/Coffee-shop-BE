import Order from "../models/Order.js";
import { Op, fn, col } from "sequelize";

export async function getStats(req, res) {
  try {
    const { from, to, by = "day" } = req.query;

    const where = {};
    if (from || to) {
      where.ngay_dat = {
        ...(from ? { [Op.gte]: new Date(from) } : {}),
        ...(to ? { [Op.lte]: new Date(to) } : {})
      };
    }

    const stats = await Order.findAll({
      attributes: [
        [fn("DATE", col("ngay_dat")), "date"],
        [fn("COUNT", col("id_don")), "total_orders"]
      ],
      where,
      group: [fn("DATE", col("ngay_dat"))],
      order: [[fn("DATE", col("ngay_dat")), "ASC"]]
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Lỗi thống kê", error: err.message });
  }
}
