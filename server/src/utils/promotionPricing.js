// src/utils/promotionPricing.js
import { Op } from "sequelize";
import Promotion from "../models/Promotion.js";
import PromotionProduct from "../models/PromotionProduct.js";

//
// =======================
//  CHECK KHUNG GIỜ
// =======================
function isWithinTimeRange(now, promo) {
  // Nếu không set cả 2 giờ -> áp dụng cả ngày
  if (!promo.gio_bd && !promo.gio_kt) return true;

  // Nếu chỉ có giờ bắt đầu, không có giờ kết thúc -> từ giờ đó tới hết ngày
  const rawStart = promo.gio_bd || "00:00:00";
  const rawEnd =
    promo.gio_kt && promo.gio_kt !== ""
      ? promo.gio_kt
      : "23:59:59";

  const [h1, m1, s1] = rawStart.split(":").map(Number);
  let [h2, m2, s2] = rawEnd.split(":").map(Number);

  const start = new Date(now);
  start.setHours(h1 || 0, m1 || 0, s1 || 0, 0);

  const end = new Date(now);
  end.setHours(h2 || 0, m2 || 0, s2 || 0, 0);

  // 🔥 Trường hợp đặc biệt:
  // - gio_kt = '00:00:00' (12:00 AM) hoặc end <= start
  //   => hiểu là "tới hết ngày" (23:59:59)
  if (promo.gio_kt === "00:00:00" || end <= start) {
    end.setHours(23, 59, 59, 999);
  }

  return now >= start && now <= end;
}


//
// =======================
//  LẤY KHUYẾN MÃI ĐANG ACTIVE TẠI THỜI ĐIỂM HIỆN TẠI
// =======================
export async function getActivePromotionsNow() {
  const now = new Date();

  const weekdayJs = now.getDay(); // 0 = CN
  const weekdayVN = weekdayJs === 0 ? 7 : weekdayJs; // 1–7

  console.log("===== DEBUG getActivePromotionsNow() START =====");
  console.log("Thời điểm hiện tại:", now.toISOString(), "Thứ:", weekdayVN);

  //
  // 1) Lấy các KM hợp lệ theo ngày + hiển thị + áp dụng giá
  //
  let promos = await Promotion.findAll({
    where: {
      hien_thi: true,
      ap_dung_gia: true,

      ngay_bd: { [Op.lte]: now },
      ngay_kt: { [Op.gte]: now },

      // Những KM áp dụng mọi ngày: null hoặc ""
      [Op.or]: [
        { lap_lai_thu: null },
        { lap_lai_thu: "" },
        { lap_lai_thu: weekdayVN },
      ],
    },
  });

  console.log("===== STEP 1: Sau khi lọc ngày + hiển thị =====");
  console.log(
    promos.map((p) => ({
      id_km: p.id_km,
      ten_km: p.ten_km,
      ngay_bd: p.ngay_bd,
      ngay_kt: p.ngay_kt,
      lap_lai_thu: p.lap_lai_thu,
      gio_bd: p.gio_bd,
      gio_kt: p.gio_kt,
      target_type: p.target_type,
    }))
  );

  //
  // 2) Lọc tiếp theo KHUNG GIỜ
  //
  promos = promos.filter((promo) => isWithinTimeRange(now, promo));

  console.log("===== STEP 2: Sau khi lọc theo giờ =====");
  console.log(
    promos.map((p) => ({
      id_km: p.id_km,
      ten_km: p.ten_km,
      gio_bd: p.gio_bd,
      gio_kt: p.gio_kt,
    }))
  );

  //
  // 3) Nếu là KM theo sản phẩm (PRODUCT) → lấy danh sách id_mon liên quan
  //
  const productScopePromoIds = promos
    .filter((p) => p.target_type === "PRODUCT")
    .map((p) => p.id_km);

  if (productScopePromoIds.length > 0) {
    const links = await PromotionProduct.findAll({
      where: { id_km: productScopePromoIds },
    });

    const promoIdToProductIds = {};
    for (const link of links) {
      if (!promoIdToProductIds[link.id_km]) {
        promoIdToProductIds[link.id_km] = [];
      }
      promoIdToProductIds[link.id_km].push(link.id_mon);
    }

    // Gắn productIds vào từng promo
    promos.forEach((promo) => {
      promo.productIds = promoIdToProductIds[promo.id_km] || [];
    });

    console.log("===== STEP 3: Map sản phẩm theo KM PRODUCT =====");
    console.log(
      promos.map((p) => ({
        id_km: p.id_km,
        ten_km: p.ten_km,
        productIds: p.productIds,
      }))
    );
  }

  console.log("===== DEBUG getActivePromotionsNow() END =====");
  return promos;
}

//
// =======================
//  ÁP KHUYẾN MÃI CHO 1 SẢN PHẨM
// =======================
export function applyPromotionsToProduct(product, activePromos = []) {
  let finalPrice = Number(product.gia) || 0;
  let appliedPromo = null;

  for (const promo of activePromos) {
    //
    // 1) Kiểm tra PHẠM VI: PRODUCT / CATEGORY / ALL
    //
    if (promo.target_type === "PRODUCT") {
      const singleId = promo.id_mon; // kiểu cũ
      const linkedIds = promo.productIds || []; // kiểu mới

      if (singleId) {
        if (
          singleId !== product.id_mon &&
          !linkedIds.includes(product.id_mon)
        ) {
          continue;
        }
      } else {
        if (linkedIds.length === 0) continue;
        if (!linkedIds.includes(product.id_mon)) continue;
      }
    }

    if (
      promo.target_type === "CATEGORY" &&
      promo.id_danh_muc !== product.id_dm
    ) {
      continue;
    }

    //
    // 2) Tính giá sau khuyến mãi
    //
    let newPrice = finalPrice;

    if (promo.loai_km === "FIXED_PRICE" && promo.gia_dong != null) {
      newPrice = Math.min(finalPrice, Number(promo.gia_dong));
    }

    if (promo.loai_km === "PERCENT" && promo.pt_giam > 0) {
      newPrice = Math.round(finalPrice * (1 - promo.pt_giam / 100));
    }

    //
    // 3) Nếu KM này tốt hơn (giá thấp hơn) → chọn
    //
    if (newPrice < finalPrice) {
      finalPrice = newPrice;
      appliedPromo = promo;
    }
  }

  //
  // Log khi KM được áp vào 1 sản phẩm
  //
  if (appliedPromo) {
    console.log("===== DEBUG applyPromotionsToProduct() =====");
    console.log({
      productId: product.id_mon,
      categoryId: product.id_dm,
      gia_goc: product.gia,
      gia_km: finalPrice,
      appliedPromotion: {
        id_km: appliedPromo.id_km,
        ten_km: appliedPromo.ten_km,
        loai_km: appliedPromo.loai_km,
        pt_giam: appliedPromo.pt_giam,
        gia_dong: appliedPromo.gia_dong,
        target_type: appliedPromo.target_type,
      },
    });
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
