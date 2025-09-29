import Promotion from "../models/Promotion.js";

// Lấy tất cả khuyến mãi
export async function getAllPromotions(req, res) {
  try {
    const promos = await Promotion.findAll();
    res.json(promos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Tạo khuyến mãi
export async function createPromotion(req, res) {
  try {
    const { ten_km, ngay_bd, ngay_kt, pt_giam } = req.body;
    const promo = await Promotion.create({ ten_km, ngay_bd, ngay_kt, pt_giam });
    res.json({ message: "Tạo khuyến mãi thành công", promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Cập nhật
export async function updatePromotion(req, res) {
  try {
    const promo = await Promotion.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: "Không tìm thấy" });

    const { ten_km, ngay_bd, ngay_kt, pt_giam } = req.body;
    await promo.update({ ten_km, ngay_bd, ngay_kt, pt_giam });
    res.json({ message: "Cập nhật thành công", promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Xoá
export async function deletePromotion(req, res) {
  try {
    const promo = await Promotion.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ message: "Không tìm thấy" });

    await promo.destroy();
    res.json({ message: "Xoá thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
