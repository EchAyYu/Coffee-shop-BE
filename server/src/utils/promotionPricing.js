// utils/promotionPricing.js
import { Op } from "sequelize";
import Promotion from "../models/Promotion.js";

function isWithinTimeRange(now, promo) {
  // nếu không set giờ -> coi như cả ngày
  if (!promo.gio_bd || !promo.gio_kt) return true;

  const [h, m, s] = promo.gio_bd.split(":").map(Number);
  const [h2, m2, s2] = promo.gio_kt.split(":").map(Number);

  const start = new Date(now);
  start.setHours(h, m, s || 0, 0);

  const end = new Date(now);
  end.setHours(h2, m2, s2 || 0, 0);

  return now >= start && now <= end;
}

// Lấy tất cả khuyến mãi đang active "ở thời điểm hiện tại"
export async function getActivePromotionsNow() {
  const now = new Date();

  const weekdayJs = now.getDay();           // 0=CN
  const weekdayVN = weekdayJs === 0 ? 7 : weekdayJs; // 1-7

  const promos = await Promotion.findAll({
    where: {
      hien_thi: true,
      ngay_bd: { [Op.lte]: now },
      ngay_kt: { [Op.gte]: now },
      [Op.or]: [
        { lap_lai_thu: null },
        { lap_lai_thu: weekdayVN },
      ],
    },
  });

  // lọc thêm theo giờ (nếu có set)
  return promos.filter((promo) => isWithinTimeRange(now, promo));
}

// product: object có id_mon, id_dm, gia (giá gốc)
// activePromos: list từ getActivePromotionsNow()
export function applyPromotionsToProduct(product, activePromos) {
  let finalPrice = product.gia;
  let appliedPromo = null;

  for (const promo of activePromos) {
    // 1. Check scope
    if (promo.target_type === "PRODUCT" && promo.id_mon !== product.id_mon) {
      continue;
    }
    if (
      promo.target_type === "CATEGORY" &&
      promo.id_danh_muc !== product.id_dm
    ) {
      continue;
    }
    // target_type === "ALL" -> áp dụng cho mọi món

    // 2. Tính giá sau khuyến mãi
    let newPrice = finalPrice;

    if (promo.loai_km === "FIXED_PRICE" && promo.gia_dong != null) {
      newPrice = Math.min(finalPrice, promo.gia_dong);
    } else if (promo.loai_km === "PERCENT" && promo.pt_giam > 0) {
      newPrice = Math.round(finalPrice * (1 - promo.pt_giam / 100));
    }

    // nếu khuyến mãi này cho giá thấp hơn -> ưu tiên nó
    if (newPrice < finalPrice) {
      finalPrice = newPrice;
      appliedPromo = promo;
    }
  }

  return {
    ...product,
    gia_goc: product.gia,
    gia_km: finalPrice,
    khuyen_mai_ap_dung: appliedPromo
      ? {
          id_km: appliedPromo.id_km,
          ten_km: appliedPromo.ten_km,
          pt_giam: appliedPromo.pt_giam,
          loai_km: appliedPromo.loai_km,
          gia_dong: promo.gia_dong,
        }
      : null,
  };
}
