import { Op } from "sequelize";
import Voucher from "../models/Voucher.js";
import VoucherRedemption from "../models/VoucherRedemption.js";
import Customer from "../models/Customer.js";

// sinh mã cá nhân ngẫu nhiên
function genCode(prefix = "VCH") {
  const r = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${r}`;
}

// 2.1) Danh mục voucher đang mở
export async function listCatalog(req, res) {
  try {
    const now = new Date();
    const rows = await Voucher.findAll({
      where: {
        active: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }]
      },
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi lấy danh mục voucher." });
  }
}

// 2.2) Đổi điểm lấy voucher cá nhân
export async function redeemVoucher(req, res) {
  try {
    const { voucher_id } = req.body;
    const id_tk = req.user?.id_tk || req.user?.id;

    const c = await Customer.findOne({ where: { id_tk } });
    if (!c) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });

    const v = await Voucher.findByPk(voucher_id);
    if (!v || !v.active) return res.status(400).json({ success: false, message: "Voucher không hợp lệ" });

    // còn hạn?
    if (v.expires_at && new Date(v.expires_at) <= new Date()) {
      return res.status(400).json({ success: false, message: "Voucher đã hết hạn" });
    }

    if ((c.diem || 0) < v.points_cost) {
      return res.status(400).json({ success: false, message: "Điểm không đủ để đổi" });
    }

    // trừ điểm + cấp mã
    const code = genCode(v.code_prefix || "VCH");
    await c.update({ diem: (c.diem || 0) - v.points_cost });

    const redemption = await VoucherRedemption.create({
      voucher_id: v.id,
      id_tk,
      code,
      status: "active",
      expires_at: v.expires_at || null,
    });

    res.status(201).json({ success: true, data: { code: redemption.code } });
  } catch (e) {
    console.error("redeemVoucher error:", e);
    res.status(500).json({ success: false, message: "Lỗi đổi voucher." });
  }
}

// 2.3) Danh sách voucher cá nhân
export async function myVouchers(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const now = new Date();

    // auto expire
    await VoucherRedemption.update(
      { status: "expired" },
      { where: { id_tk, status: "active", expires_at: { [Op.lte]: now } } }
    );

    const rows = await VoucherRedemption.findAll({
      where: { id_tk },
      include: [{ model: Voucher }],
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi lấy voucher của tôi." });
  }
}

// 2.4) Validate mã khi checkout (tính số tiền giảm)
export async function validateCode(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const { code, order_total } = req.body;
    const redemption = await VoucherRedemption.findOne({ where: { code, id_tk } });
    if (!redemption) return res.status(404).json({ success: false, message: "Không tìm thấy mã" });

    if (redemption.status !== "active") {
      return res.status(400).json({ success: false, message: "Mã không còn hiệu lực" });
    }
    if (redemption.expires_at && new Date(redemption.expires_at) <= new Date()) {
      return res.status(400).json({ success: false, message: "Mã đã hết hạn" });
    }

    const voucher = await Voucher.findByPk(redemption.voucher_id);
    if (!voucher || !voucher.active) return res.status(400).json({ success: false, message: "Voucher không hợp lệ" });

    const subtotal = Number(order_total || 0);
    if (subtotal < Number(voucher.min_order || 0)) {
      return res.status(400).json({ success: false, message: "Chưa đạt giá trị tối thiểu" });
    }

    let discount = 0;
    if (voucher.discount_type === "fixed") {
      discount = Number(voucher.discount_value);
    } else {
      discount = (subtotal * Number(voucher.discount_value)) / 100;
    }
    const cap = voucher.max_discount ? Number(voucher.max_discount) : discount;
    discount = Math.min(discount, cap, subtotal);

    res.json({ success: true, data: { code, discount } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi kiểm tra mã." });
  }
}
