import Product from "../models/Product.js";
import { Op } from "sequelize";

export async function getAllProducts(req, res) {
  try {
    const { q, category } = req.query;
    const where = {};

    if (q) {
      where.ten_mon = { [Op.like]: `%${q}%` };
    }
    if (category) {
      // giả sử category = id_dm
      where.id_dm = category;
    }

    const products = await Product.findAll({ where });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getProductById(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
