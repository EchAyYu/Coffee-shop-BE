// src/controllers/promotions.controller.js
import { Op } from "sequelize";
import sequelize from "../utils/db.js";
import Promotion from "../models/Promotion.js";
import PromotionProduct from "../models/PromotionProduct.js"; // bảng trung gian id_km - id_mon
import Product from "../models/Product.js";

// 🧩 Helper: map Promotion + PromotionProduct -> JSON + productIds[]
function mapPromotionWithProducts(promoInstance) {
  const raw = promoInstance.toJSON();

  // PromotionProducts có thể được load với alias "PromotionProducts" hoặc "Products"
  const rel = raw.PromotionProducts || raw.Products || [];

  const productIds = rel
    .map((r) => r.id_mon)
    .filter((v) => v !== null && v !== undefined);

  return {
    ...raw,
    productIds,
  };
}

/**
 * [PUBLIC] Lấy danh sách khuyến mãi đang hiển thị cho phía client
 * GET /api/promotions
 */
export async function getPublicPromotions(req, res) {
  try {
    const now = new Date();

    const promos = await Promotion.findAll({
      where: {
        hien_thi: true,
        // Chỉ lấy những KM trong khoảng ngày bắt đầu - kết thúc
        ngay_bd: { [Op.lte]: now },
        ngay_kt: { [Op.gte]: now },
      },
      include: [
        {
          model: PromotionProduct,
          as: "PromotionProducts",
          attributes: ["id_mon"],
        },
      ],
      order: [["ngay_bd", "ASC"]],
    });

    const data = promos.map(mapPromotionWithProducts);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("getPublicPromotions error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khuyến mãi.",
    });
  }
}

/**
 * [ADMIN] Lấy danh sách tất cả khuyến mãi
 * GET /api/admin/promotions
 */
export async function getAdminPromotions(req, res) {
  try {
    const promos = await Promotion.findAll({
      include: [
        {
          model: PromotionProduct,
          as: "PromotionProducts",
          attributes: ["id_mon"],
        },
      ],
      order: [["ngay_bd", "DESC"]],
    });

    const data = promos.map(mapPromotionWithProducts);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("getAdminPromotions error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khuyến mãi.",
    });
  }
}

/**
 * [ADMIN] Tạo khuyến mãi mới
 * POST /api/admin/promotions
 */
export async function createAdminPromotion(req, res) {
  const t = await sequelize.transaction();
  try {
    const {
      ten_km,
      mo_ta,
      hinh_anh,
      loai_km,
      pt_giam,
      gia_dong,
      target_type,
      id_danh_muc,
      id_mon,      // optional – case chỉ 1 món
      productIds,  // array các món
      ngay_bd,
      ngay_kt,
      lap_lai_thu,
      gio_bd,
      gio_kt,
      hien_thi,
      ap_dung_gia,   // ✅
      button_text,
      button_link,
    } = req.body;

    if (!ten_km || !ngay_bd || !ngay_kt) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên khuyến mãi hoặc ngày bắt đầu/kết thúc.",
      });
    }

    // ✅ Chuẩn hóa lap_lai_thu:
    // - "", null, undefined => null (áp dụng tất cả các ngày)
    // - 1–7 => Number(...)
    const normalizedLapLaiThu =
      lap_lai_thu === "" ||
      lap_lai_thu === null ||
      lap_lai_thu === undefined
        ? null
        : Number(lap_lai_thu);

    const promo = await Promotion.create(
      {
        ten_km,
        mo_ta,
        hinh_anh,

        loai_km: loai_km || "PERCENT",
        pt_giam: loai_km === "PERCENT" ? pt_giam || 0 : 0,
        gia_dong: loai_km === "FIXED_PRICE" ? gia_dong || 0 : null,

        target_type: target_type || "ALL",
        id_danh_muc:
          target_type === "CATEGORY" ? id_danh_muc || null : null,
        id_mon:
          target_type === "PRODUCT" && id_mon
            ? id_mon
            : null,

        ngay_bd,
        ngay_kt,
        lap_lai_thu: normalizedLapLaiThu,
        gio_bd: gio_bd || null,
        gio_kt: gio_kt || null,

        hien_thi: hien_thi !== undefined ? !!hien_thi : true,

        // ✅ default true nếu không gửi lên
        ap_dung_gia:
          ap_dung_gia !== undefined ? !!ap_dung_gia : true,

        button_text: button_text || null,
        button_link: button_link || null,
      },
      { transaction: t }
    );

    // Nếu là target_type = PRODUCT => lưu thêm bảng PromotionProduct
    if (target_type === "PRODUCT" && Array.isArray(productIds)) {
      const rows = productIds
        .filter((id) => id !== null && id !== undefined)
        .map((id) => ({
          id_km: promo.id_km,
          id_mon: id,
        }));

      if (rows.length > 0) {
        await PromotionProduct.bulkCreate(rows, { transaction: t });
      }

      // Nếu chỉ có 1 món, lưu luôn vào id_mon cho backward
      if (!id_mon && rows.length === 1) {
        await promo.update(
          { id_mon: rows[0].id_mon },
          { transaction: t }
        );
      }
    }

    await t.commit();

    // load lại kèm productIds
    const reloaded = await Promotion.findByPk(promo.id_km, {
      include: [
        {
          model: PromotionProduct,
          as: "PromotionProducts",
          attributes: ["id_mon"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      data: mapPromotionWithProducts(reloaded),
    });
  } catch (err) {
    console.error("createAdminPromotion error:", err);
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo khuyến mãi.",
    });
  }
}

/**
 * [ADMIN] Cập nhật khuyến mãi
 * PUT /api/admin/promotions/:id
 */
export async function updateAdminPromotion(req, res) {
  const { id } = req.params;
  const t = await sequelize.transaction();
  try {
    const {
      ten_km,
      mo_ta,
      hinh_anh,
      loai_km,
      pt_giam,
      gia_dong,
      target_type,
      id_danh_muc,
      id_mon,
      productIds,
      ngay_bd,
      ngay_kt,
      lap_lai_thu,
      gio_bd,
      gio_kt,
      hien_thi,
      ap_dung_gia,   // ✅
      button_text,
      button_link,
    } = req.body;

    const promo = await Promotion.findByPk(id, { transaction: t });
    if (!promo) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy khuyến mãi." });
    }

    // ✅ Chuẩn hóa lap_lai_thu giống create
    const normalizedLapLaiThu =
      lap_lai_thu === "" ||
      lap_lai_thu === null ||
      lap_lai_thu === undefined
        ? null
        : Number(lap_lai_thu);

    await promo.update(
      {
        ten_km,
        mo_ta,
        hinh_anh,

        loai_km: loai_km || "PERCENT",
        pt_giam: loai_km === "PERCENT" ? pt_giam || 0 : 0,
        gia_dong: loai_km === "FIXED_PRICE" ? gia_dong || 0 : null,

        target_type: target_type || "ALL",
        id_danh_muc:
          target_type === "CATEGORY" ? id_danh_muc || null : null,
        id_mon:
          target_type === "PRODUCT" && id_mon
            ? id_mon
            : null,

        ngay_bd,
        ngay_kt,
        lap_lai_thu: normalizedLapLaiThu,
        gio_bd: gio_bd || null,
        gio_kt: gio_kt || null,

        hien_thi: hien_thi !== undefined ? !!hien_thi : promo.hien_thi,

        ap_dung_gia:
          ap_dung_gia !== undefined ? !!ap_dung_gia : promo.ap_dung_gia,

        button_text: button_text ?? promo.button_text,
        button_link: button_link ?? promo.button_link,
      },
      { transaction: t }
    );

    // Cập nhật bảng trung gian
    if (target_type !== "PRODUCT") {
      // Nếu không phải PRODUCT => xóa hết liên kết sản phẩm
      await PromotionProduct.destroy({
        where: { id_km: promo.id_km },
        transaction: t,
      });
    } else {
      // target_type = PRODUCT
      const list = Array.isArray(productIds) ? productIds : [];

      // Xóa hết rồi insert lại
      await PromotionProduct.destroy({
        where: { id_km: promo.id_km },
        transaction: t,
      });

      const rows = list
        .filter((pid) => pid !== null && pid !== undefined)
        .map((pid) => ({ id_km: promo.id_km, id_mon: pid }));

      if (rows.length > 0) {
        await PromotionProduct.bulkCreate(rows, { transaction: t });
      }

      // nếu chỉ 1 món => lưu vào id_mon để backward
      const fallbackIdMon =
        id_mon ||
        (rows.length === 1 ? rows[0].id_mon : null);

      if (fallbackIdMon) {
        await promo.update(
          { id_mon: fallbackIdMon },
          { transaction: t }
        );
      } else if (!fallbackIdMon && promo.id_mon) {
        // không còn món nào => clear id_mon
        await promo.update({ id_mon: null }, { transaction: t });
      }
    }

    await t.commit();

    const reloaded = await Promotion.findByPk(promo.id_km, {
      include: [
        {
          model: PromotionProduct,
          as: "PromotionProducts",
          attributes: ["id_mon"],
        },
      ],
    });

    return res.json({
      success: true,
      data: mapPromotionWithProducts(reloaded),
    });
  } catch (err) {
    console.error("updateAdminPromotion error:", err);
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật khuyến mãi.",
    });
  }
}


/**
 * [ADMIN] Xóa khuyến mãi
 * DELETE /api/admin/promotions/:id
 */
export async function deleteAdminPromotion(req, res) {
  const { id } = req.params;
  const t = await sequelize.transaction();
  try {
    const promo = await Promotion.findByPk(id, { transaction: t });
    if (!promo) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy khuyến mãi." });
    }

    await PromotionProduct.destroy({
      where: { id_km: promo.id_km },
      transaction: t,
    });
    await promo.destroy({ transaction: t });

    await t.commit();
    return res.json({ success: true, message: "Đã xóa khuyến mãi." });
  } catch (err) {
    console.error("deleteAdminPromotion error:", err);
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa khuyến mãi.",
    });
  }
}
