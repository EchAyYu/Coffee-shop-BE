import Promotion from "../models/Promotion.js";

// Lấy tất cả khuyến mãi
export async function getAllPromotions(req, res) {
  try {
    // Chỉ lấy những cái admin cho phép hiển thị
    // Nếu là admin gọi API (có thể check req.user), bạn có thể bỏ where: { hien_thi: true }
    // Ở đây mình lấy hết để Admin quản lý, Frontend sẽ filter sau
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
    // Nhận thêm các field mới từ frontend
    const { ten_km, mo_ta, hinh_anh, ngay_bd, ngay_kt, pt_giam, lap_lai_thu, hien_thi } = req.body;
    
    const promo = await Promotion.create({ 
      ten_km, mo_ta, hinh_anh, ngay_bd, ngay_kt, pt_giam, lap_lai_thu, hien_thi 
    });
    
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

    const { ten_km, mo_ta, hinh_anh, ngay_bd, ngay_kt, pt_giam, lap_lai_thu, hien_thi } = req.body;
    
    await promo.update({ 
      ten_km, mo_ta, hinh_anh, ngay_bd, ngay_kt, pt_giam, lap_lai_thu, hien_thi 
    });
    
    res.json({ message: "Cập nhật thành công", promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Xoá (Giữ nguyên code của bạn)
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