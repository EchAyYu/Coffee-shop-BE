import Product from "../models/Product.js";
import { Op } from "sequelize";

// Lấy tất cả sản phẩm
export async function getAllProducts(req, res) {
  try {
    const { q, category } = req.query;
    const where = {};

    if (q) {
      where.ten_mon = { [Op.like]: `%${q}%` };
    }
    if (category) {
      where.id_dm = category; // category = id_dm
    }

    const products = await Product.findAll({ where });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Lấy sản phẩm theo ID
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

// ✅ Thêm sản phẩm mới
export async function createProduct(req, res) {
  try {
    const { id_dm, ten_mon, gia, mo_ta, anh, trang_thai } = req.body;
    if (!id_dm || !ten_mon || !gia) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    const newProduct = await Product.create({
      id_dm,
      ten_mon,
      gia,
      mo_ta,
      anh,
      trang_thai,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}


// ✅ Cập nhật sản phẩm
export async function updateProduct(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    await product.update(req.body);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// ✅ Xóa sản phẩm
export async function deleteProduct(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    await product.destroy();
    res.json({ message: "Đã xóa sản phẩm" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
