// src/utils/promotionPricing.js
import { Op } from "sequelize";
import Promotion from "../models/Promotion.js";

// Kiểm tra now có nằm trong khoảng giờ promo hay không
function isWithinTimeRange(now, promo) {
  // Nếu không set giờ -> coi như cả ngày
  if (!promo.gio_bd || !promo.gio_kt) return true;

  const [h1, m1, s1] = promo.gio_bd.split(":").map(Number);
  const [h2, m2, s2] = promo.gio_kt.split(":").map(Number);

  const start = new Date(now);
  start.setHours(h1 || 0, m1 || 0, s1 || 0, 0);

  const end = new Date(now);
  end.setHours(h2 || 0, m2 || 0, s2 || 0, 0);

  return now >= start && now <= end;
}

// 🔥 Lấy tất cả khuyến mãi đang active "ngay lúc này"
export async function getActivePromotionsNow() {
  const now = new Date();

  // JS: 0=CN,1=Mon... -> convert về 1–7 (2=Thứ 2,...,7=CN)
  const weekdayJs = now.getDay();
  const weekdayVN = weekdayJs === 0 ? 7 : weekdayJs; // 1-7

  const promos = await Promotion.findAll({
    where: {
      hien_thi: true,
      ngay_bd: { [Op.lte]: now },
      ngay_kt: { [Op.gte]: now },
      [Op.or]: [
        { lap_lai_thu: null },      // Áp dụng tất cả các ngày
        { lap_lai_thu: weekdayVN }, // Hoặc chỉ đúng thứ hiện tại
      ],
    },
  });

  // Lọc thêm theo khung giờ
  return promos.filter((promo) => isWithinTimeRange(now, promo));
}

// product: object có { id_mon, id_dm, gia }
// activePromos: mảng từ getActivePromotionsNow()
export function applyPromotionsToProduct(product, activePromos = []) {
  let finalPrice = Number(product.gia) || 0;
  let appliedPromo = null;

  for (const promo of activePromos) {
    // 1. Check phạm vi áp dụng
    if (promo.target_type === "PRODUCT" && promo.id_mon !== product.id_mon) {
      continue;
    }

    if (
      promo.target_type === "CATEGORY" &&
      promo.id_danh_muc !== product.id_dm
    ) {
      continue;
    }
    // target_type === "ALL" => áp dụng cho tất cả

    // 2. Tính giá sau khuyến mãi
    let newPrice = finalPrice;

    if (promo.loai_km === "FIXED_PRICE" && promo.gia_dong != null) {
      // Đồng giá: lấy min giữa giá hiện tại và giá đồng
      newPrice = Math.min(finalPrice, Number(promo.gia_dong));
    } else if (promo.loai_km === "PERCENT" && promo.pt_giam > 0) {
      // Giảm %: làm tròn cho đẹp
      newPrice = Math.round(finalPrice * (1 - promo.pt_giam / 100));
    }

    // Nếu khuyến mãi này cho giá thấp hơn -> ưu tiên nó
    if (newPrice < finalPrice) {
      finalPrice = newPrice;
      appliedPromo = promo;
    }
  }

  return {
    ...product,
    gia_goc: Number(product.gia) || 0,
    gia_km: finalPrice,
    khuyen_mai_ap_dung: appliedPromo
      ? {
          id_km: appliedPromo.id_km,
          ten_km: appliedPromo.ten_km,
          pt_giam: appliedPromo.pt_giam,
          loai_km: appliedPromo.loai_km,
          gia_dong: appliedPromo.gia_dong,
        }
      : null,
  };
}
