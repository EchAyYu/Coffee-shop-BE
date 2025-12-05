// src/utils/promotionPricing.js
import { Op } from "sequelize";
import Promotion from "../models/Promotion.js";
import PromotionProduct from "../models/PromotionProduct.js";

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

  // 1. Lấy khuyến mãi theo ngày/thứ
  let promos = await Promotion.findAll({
    where: {
      hien_thi: true,
      ngay_bd: { [Op.lte]: now },
      ngay_kt: { [Op.gte]: now },
      [Op.or]: [
        { lap_lai_thu: null }, // Áp dụng tất cả các ngày
        { lap_lai_thu: weekdayVN },
      ],
    },
  });

  // 2. Lọc thêm theo khung giờ
  promos = promos.filter((promo) => isWithinTimeRange(now, promo));

  // 3. Với những promo áp dụng theo PRODUCT, load thêm danh sách món (nhiều món)
  const productScopePromoIds = promos
    .filter((p) => p.target_type === "PRODUCT")
    .map((p) => p.id_km);

  if (productScopePromoIds.length > 0) {
    const links = await PromotionProduct.findAll({
      where: { id_km: productScopePromoIds },
    });

    // map: id_km -> [id_mon...]
    const promoIdToProductIds = {};
    for (const link of links) {
      if (!promoIdToProductIds[link.id_km]) {
        promoIdToProductIds[link.id_km] = [];
      }
      promoIdToProductIds[link.id_km].push(link.id_mon);
    }

    // Gắn productIds vào object promo để dùng sau
    promos.forEach((promo) => {
      promo.productIds = promoIdToProductIds[promo.id_km] || [];
    });
  }

  return promos;
}

// product: object có { id_mon, id_dm, gia }
// activePromos: mảng từ getActivePromotionsNow()
export function applyPromotionsToProduct(product, activePromos = []) {
  let finalPrice = Number(product.gia) || 0;
  let appliedPromo = null;

  for (const promo of activePromos) {
    // 1. Check phạm vi áp dụng
    if (promo.target_type === "PRODUCT") {
      // Hỗ trợ 2 kiểu:
      // - Kiểu cũ: promo.id_mon (1 món)
      // - Kiểu mới: promo.productIds (nhiều món trong bảng khuyen_mai_mon)
      const singleId = promo.id_mon;
      const linkedIds = promo.productIds || [];

      if (singleId) {
        if (
          singleId !== product.id_mon &&
          !linkedIds.includes(product.id_mon)
        ) {
          continue;
        }
      } else {
        if (linkedIds.length === 0) {
          // có target_type=PRODUCT mà không gắn món -> bỏ qua
          continue;
        }
        if (!linkedIds.includes(product.id_mon)) {
          continue;
        }
      }
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
