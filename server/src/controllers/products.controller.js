import Product from "../models/Product.js";
import { Op } from "sequelize";

// 🔥 THÊM: helper khuyến mãi động
import {
  getActivePromotionsNow,
  applyPromotionsToProduct,
} from "../utils/promotionPricing.js";

// ============================
// Lấy tất cả sản phẩm (Admin + Public)
// ============================
export async function getAllProducts(req, res) {
  try {
    const { q, category, status } = req.query;

    const where = {};

    // 1. Lọc theo tên sản phẩm (Search)
    if (q) {
      where.ten_mon = { [Op.like]: `%${q}%` };
    }

    // 2. Lọc theo danh mục
    if (category) {
      where.id_dm = category;
    }

    // 3. Lọc theo trạng thái
    if (status === "true" || status === "false") {
      where.trang_thai = status === "true";
    }

    // Lấy sản phẩm từ DB
    const products = await Product.findAll({ where });

    // Nếu không có sản phẩm -> trả về sớm
    if (!products.length) {
      return res.json([]);
    }

    // 🔥 Lấy danh sách khuyến mãi đang active "ngay lúc này"
    // (đúng ngày, đúng thứ, đúng giờ, và đang bật hiển thị)
    const activePromos = await getActivePromotionsNow();

    // Áp khuyến mãi vào từng sản phẩm
    const result = products.map((p) => {
      const raw = p.toJSON();

      const priced = applyPromotionsToProduct(
        {
          id_mon: raw.id_mon,
          id_dm: raw.id_dm,
          gia: Number(raw.gia),
        },
        activePromos
      );

      return {
        ...raw,
        // Giữ nguyên giá gốc ở field `gia`
        gia: raw.gia,
        gia_goc: priced.gia_goc,
        gia_km: priced.gia_km,
        khuyen_mai_ap_dung: priced.khuyen_mai_ap_dung,
      };
    });

    // ⚠️ Vẫn trả về "mảng thuần" cho hợp với FE hiện tại
    res.json(result);
  } catch (err) {
    console.error("getAllProducts error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ============================
// Lấy sản phẩm theo ID
// ============================
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
    console.error("Lỗi khi tạo sản phẩm:", err);
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
    console.error("Lỗi khi cập nhật sản phẩm:", err);
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
