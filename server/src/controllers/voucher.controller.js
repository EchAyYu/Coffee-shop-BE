import { Op } from "sequelize";
import Voucher from "../models/Voucher.js";
import VoucherRedemption from "../models/VoucherRedemption.js";
import Customer from "../models/Customer.js";
import sequelize from "../utils/db.js";

// sinh mã cá nhân ngẫu nhiên
function genCode(prefix = "VCH") {
  const r = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${r}`;
}

// 1.1) [ADMIN] Tạo voucher mới
export async function createVoucher(req, res) {
  try {
    const {
      name,
      description,
      code_prefix,
      discount_type,
      discount_value,
      min_order,
      max_discount,
      points_cost,
      expires_at,
      active,
      total_quantity,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !discount_type || !discount_value || !points_cost) {
      return res.status(400).json({
        success: false,
        message: "Tên, loại giảm giá, giá trị giảm giá, và phí điểm là bắt buộc.",
      });
    }

    const newVoucher = await Voucher.create({
      name,
      description,
      code_prefix: code_prefix || "VCH",
      discount_type, // 'fixed' or 'percent'
      discount_value,
      min_order: min_order || 0,
      max_discount,
      points_cost,
      expires_at: expires_at ? new Date(expires_at) : null,
      active: active !== undefined ? active : true,
      total_quantity: total_quantity ? parseInt(total_quantity) : null,
    });

    res.status(201).json({ success: true, data: newVoucher });
  } catch (e) {
    console.error("createVoucher error:", e);
    res.status(500).json({ success: false, message: "Lỗi khi tạo voucher." });
  }
}

// 1.2) [ADMIN] Lấy tất cả voucher (để quản lý)
export async function getAllVouchersAdmin(req, res) {
  try {
    const vouchers = await Voucher.findAll({
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: vouchers });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách voucher." });
  }
}

// 1.3) [ADMIN] Cập nhật voucher
export async function updateVoucher(req, res) {
  try {
    const { id } = req.params;
    const [updated] = await Voucher.update(req.body, { where: { id } });

    if (updated) {
      const updatedVoucher = await Voucher.findByPk(id);
      res.json({ success: true, data: updatedVoucher });
    } else {
      res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi cập nhật voucher." });
  }
}

// 1.4) [ADMIN] Xóa voucher
export async function deleteVoucher(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Voucher.destroy({ where: { id } });

    if (deleted) {
      res.json({ success: true, message: "Xóa voucher thành công" });
    } else {
      res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi xóa voucher." });
  }
}

// 2.1) Danh mục voucher đang mở
export async function listCatalog(req, res) {
  try {
    const now = new Date();
    const rows = await Voucher.findAll({
      where: {
        active: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
        // 💡 Lọc: Chỉ hiển thị voucher CÒN SỐ LƯỢNG
        [Op.or]: [
          { total_quantity: null }, // Vô hạn
          { redeemed_count: { [Op.lt]: sequelize.col('total_quantity') } } // Hoặc (đã đổi < tổng)
        ]
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
  const t = await sequelize.transaction(); // Bắt đầu transaction
  try {
    const { voucher_id } = req.body;
    const id_tk = req.user?.id_tk || req.user?.id;

    const c = await Customer.findOne({ where: { id_tk } });
    if (!c) {
      throw new Error("Không tìm thấy khách hàng", 404);
    }

    // 💡 Khóa voucher lại để kiểm tra và cập nhật số lượng
    const v = await Voucher.findByPk(voucher_id, { 
      transaction: t, 
      lock: t.LOCK.UPDATE 
    }); 
    
    if (!v || !v.active) {
      throw new Error("Voucher không hợp lệ", 400);
    }

    // còn hạn?
    if (v.expires_at && new Date(v.expires_at) <= new Date()) {
      throw new Error("Voucher đã hết hạn", 400);
    }

    // 💡 Kiểm tra số lượng
    if (v.total_quantity !== null && v.redeemed_count >= v.total_quantity) {
      throw new Error("Đã hết số lượng voucher này", 400);
    }

    // Kiểm tra điểm
    if ((c.diem || 0) < v.points_cost) {
      throw new Error("Điểm không đủ để đổi", 400);
    }

    // Tất cả đều hợp lệ -> Tiến hành
    const code = genCode(v.code_prefix || "VCH");
    
    // 1. Cập nhật điểm (trong transaction)
    c.diem = (c.diem || 0) - v.points_cost;
    await c.save({ transaction: t }); 

    // 2. Cập nhật số lượng đã đổi (trong transaction)
    v.redeemed_count += 1;
    await v.save({ transaction: t });

    // 3. Tạo mã (trong transaction)
    const redemption = await VoucherRedemption.create({
      voucher_id: v.id,
      id_tk,
      code,
      status: "active",
      expires_at: v.expires_at || null,
    }, { transaction: t });

    // 4. Commit
    await t.commit();

    // 5. Trả về
    res.status(201).json({
      success: true,
      data: {
        code: redemption.code,
        newPoints: c.diem, 
      },
    });
    
  } catch (e) {
    await t.rollback(); // Rollback nếu có lỗi
    console.error("redeemVoucher error:", e);
    res.status(e.status || 500).json({ success: false, message: e.message || "Lỗi đổi voucher." });
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
      include: [{ model: Voucher }], // 💡 Include Model Voucher để lấy thông tin
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
      return res.status(400).json({ success: false, message: "Mã không còn hiệu lực (đã dùng hoặc hết hạn)" });
    }
    if (redemption.expires_at && new Date(redemption.expires_at) <= new Date()) {
      // Cập nhật trạng thái luôn
      redemption.status = "expired";
      await redemption.save();
      return res.status(400).json({ success: false, message: "Mã đã hết hạn" });
    }

    const voucher = await Voucher.findByPk(redemption.voucher_id);
    if (!voucher || !voucher.active) return res.status(400).json({ success: false, message: "Voucher không hợp lệ" });

    const subtotal = Number(order_total || 0);
    if (subtotal < Number(voucher.min_order || 0)) {
      return res.status(400).json({ success: false, message: `Chưa đạt giá trị tối thiểu ${Number(voucher.min_order).toLocaleString('vi-VN')} ₫` });
    }

    let discount = 0;
    if (voucher.discount_type === "fixed") {
      discount = Number(voucher.discount_value);
    } else {
      discount = (subtotal * Number(voucher.discount_value)) / 100;
    }
    const cap = voucher.max_discount ? Number(voucher.max_discount) : discount;
    // Đảm bảo không giảm giá nhiều hơn giá trị tối đa HOẶC tổng tiền
    discount = Math.min(discount, cap, subtotal); 

    res.json({ success: true, data: { code, discount } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi kiểm tra mã." });
  }
}
