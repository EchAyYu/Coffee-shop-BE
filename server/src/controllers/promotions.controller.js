import { Op } from "sequelize";
import Promotion from "../models/Promotion.js";

// Đổi getDay() (0=CN,...,6=Th7) -> 1–7 (1=Th2,...,7=CN)
function getVietnamWeekdayNumber(date) {
  const jsDay = date.getDay(); // 0-6 (0 = Sunday)
  // Chuyển: 1=Mon,2=Tue,...,6=Sat,7=Sun
  return jsDay === 0 ? 7 : jsDay;
}

// PUBLIC: Lấy khuyến mãi đang hoạt động (dùng cho HomePage, trang khuyến mãi)
export const getPublicPromotions = async (req, res) => {
  try {
    // CHỈ lọc theo "hien_thi = true"
    const promos = await Promotion.findAll({
      where: {
        hien_thi: true,         // chỉ lấy các khuyến mãi đang bật hiển thị
      },
      order: [
        ["ngay_bd", "ASC"],     // sắp xếp theo ngày bắt đầu (tuỳ thích)
      ],
    });

    return res.json({ success: true, data: promos });
  } catch (err) {
    console.error("Lỗi getPublicPromotions:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tải khuyến mãi." });
  }
};

// ADMIN: Lấy tất cả khuyến mãi (có thể thêm filter sau)
export const getAllPromotionsAdmin = async (req, res) => {
  const promotions = await Promotion.findAll({
    order: [["created_at", "DESC"]],
  });

  res.json({
    success: true,
    data: promotions,
  });
};

// ADMIN: Tạo khuyến mãi
export const createPromotion = async (req, res) => {
  const {
    ten_km,
    mo_ta,
    hinh_anh,
    pt_giam,
    loai_km,       // 🔥 mới
    gia_dong,      // 🔥 mới
    target_type,   // 🔥 mới
    id_danh_muc,   // 🔥 mới
    id_mon,        // 🔥 mới
    ngay_bd,
    ngay_kt,
    gio_bd,        // 🔥 mới
    gio_kt,        // 🔥 mới
    lap_lai_thu,
    hien_thi,
    button_text,
    button_link,
  } = req.body;

  const promo = await Promotion.create({
    ten_km,
    mo_ta,
    hinh_anh,
    pt_giam,
    loai_km: loai_km || "PERCENT",
    gia_dong: gia_dong || null,
    target_type: target_type || "ALL",
    id_danh_muc: id_danh_muc || null,
    id_mon: id_mon || null,
    ngay_bd,
    ngay_kt,
    gio_bd: gio_bd || null,
    gio_kt: gio_kt || null,
    lap_lai_thu: lap_lai_thu || null,
    hien_thi: hien_thi ?? true,
    button_text,
    button_link,
  });

  res.status(201).json({
    success: true,
    message: "Tạo khuyến mãi thành công",
    data: promo,
  });
};

// ADMIN: Cập nhật khuyến mãi
export const updatePromotion = async (req, res) => {
  const { id } = req.params;

  const promo = await Promotion.findByPk(id);
  if (!promo) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy khuyến mãi",
    });
  }

  const {
    ten_km,
    mo_ta,
    hinh_anh,
    pt_giam,
    loai_km,
    gia_dong,
    target_type,
    id_danh_muc,
    id_mon,
    ngay_bd,
    ngay_kt,
    gio_bd,
    gio_kt,
    lap_lai_thu,
    hien_thi,
    button_text,
    button_link,
  } = req.body;

  await promo.update({
    ten_km,
    mo_ta,
    hinh_anh,
    pt_giam,
    loai_km: loai_km || promo.loai_km,
    gia_dong: gia_dong ?? promo.gia_dong,
    target_type: target_type || promo.target_type,
    id_danh_muc: id_danh_muc ?? promo.id_danh_muc,
    id_mon: id_mon ?? promo.id_mon,
    ngay_bd,
    ngay_kt,
    gio_bd: gio_bd ?? promo.gio_bd,
    gio_kt: gio_kt ?? promo.gio_kt,
    lap_lai_thu: lap_lai_thu ?? promo.lap_lai_thu,
    hien_thi: hien_thi ?? promo.hien_thi,
    button_text: button_text ?? promo.button_text,
    button_link: button_link ?? promo.button_link,
  });

  res.json({
    success: true,
    message: "Cập nhật khuyến mãi thành công",
    data: promo,
  });
};

// ADMIN: Xóa khuyến mãi
export const deletePromotion = async (req, res) => {
  const { id } = req.params;

  const promo = await Promotion.findByPk(id);
  if (!promo) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy khuyến mãi",
    });
  }

  await promo.destroy();

  res.json({
    success: true,
    message: "Đã xóa khuyến mãi",
  });
};
