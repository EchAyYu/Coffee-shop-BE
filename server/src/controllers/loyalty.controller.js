// src/controllers/loyalty.controller.js
import { randomBytes } from "crypto";
import sequelize from "../utils/db.js";
import db from "../models/index.js";

const { Customer, Voucher, VoucherRedemption, Notification, Account } = db;

// ====== Helper: tạo thông báo (tương tự bên orders.controller) ======
async function pushNoti({ id_tk, type = "loyalty", title, message }) {
  if (!id_tk) return;
  try {
    await Notification.create({ id_tk, type, title, message });
  } catch (e) {
    console.error("pushNoti error:", e?.message);
  }
}

// ====== Helper: tạo mã voucher code duy nhất ======
async function generateUniqueVoucherCode(prefix = "REDEEM") {
  let code;
  let isUnique = false;
  while (!isUnique) {
    // Tạo một chuỗi 6-byte ngẫu nhiên và chuyển thành 12 ký tự hex
    const randomPart = randomBytes(6).toString("hex").toUpperCase();
    code = `${prefix}_${randomPart}`;
    
    // Kiểm tra xem code đã tồn tại trong VoucherRedemption chưa
    const existing = await VoucherRedemption.findOne({ where: { code } });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}


// ========== Lấy điểm của tôi (Hàm bạn đã có) ==========
export async function getMyPoints(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const c = await Customer.findOne({ where: { id_tk }, attributes: ["id_kh", "diem"] });
    if (!c) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    res.json({ success: true, data: { points: c.diem || 0 } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy điểm." });
  }
}

// ========== 🌟 HÀM MỚI: Đổi điểm lấy Voucher 🌟 ==========
export async function redeemVoucher(req, res) {
  const { voucher_id } = req.body; // ID của voucher *mẫu* mà user muốn đổi
  const id_tk = req.user?.id_tk || req.user?.id;

  if (!voucher_id) {
    return res.status(400).json({ success: false, message: "Vui lòng chọn một voucher để đổi." });
  }

  // Bắt đầu một transaction để đảm bảo an toàn dữ liệu
  // Hoặc trừ điểm thành công, hoặc rollback tất cả
  const t = await sequelize.transaction();

  try {
    // 1. Tìm voucher mẫu và khách hàng (với khóa UPDATE để chống race condition)
    const voucherTemplate = await Voucher.findByPk(voucher_id, { transaction: t });
    const customer = await Customer.findOne({ 
      where: { id_tk }, 
      transaction: t, 
      lock: t.LOCK.UPDATE // Khóa hàng customer này lại
    });

    // 2. Kiểm tra các điều kiện
    if (!customer) {
      throw new Error("Không tìm thấy thông tin khách hàng.");
    }
    if (!voucherTemplate) {
      throw new Error("Voucher này không tồn tại.");
    }
    if (!voucherTemplate.active) {
      throw new Error("Voucher này không còn hoạt động.");
    }
    if (voucherTemplate.expires_at && new Date(voucherTemplate.expires_at) < new Date()) {
       throw new Error("Chương trình đổi voucher này đã kết thúc.");
    }
    if (!voucherTemplate.points_cost || voucherTemplate.points_cost <= 0) {
      throw new Error("Voucher này không dùng để đổi điểm.");
    }
    if (customer.diem < voucherTemplate.points_cost) {
      throw new Error("Bạn không đủ điểm để đổi voucher này.");
    }

    // 3. Tất cả điều kiện đã OK -> Bắt đầu xử lý
    const pointsToDeduct = voucherTemplate.points_cost;
    const newPoints = (customer.diem || 0) - pointsToDeduct;

    // 4. Tạo mã code mới cho user
    const newCode = await generateUniqueVoucherCode(voucherTemplate.code_prefix);

    // 5. Tính ngày hết hạn cho voucher của user
    // (Giả sử voucher sau khi đổi sẽ có hạn 30 ngày, hoặc bạn có thể thêm trường `valid_days` vào model Voucher)
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 30); // <-- Có thể thay đổi logic này

    // 6. Trừ điểm của khách hàng
    await customer.update({ diem: newPoints }, { transaction: t });

    // 7. Tạo một bản ghi VoucherRedemption (voucher mà user sở hữu)
    const newRedemption = await VoucherRedemption.create({
      voucher_id: voucherTemplate.id,
      id_tk: id_tk,
      code: newCode,
      status: "active",
      expires_at: expires_at,
      // Các trường còn lại sẽ dùng giá trị default hoặc null
    }, { transaction: t });

    // 8. Commit transaction (Xác nhận tất cả thay đổi)
    await t.commit();

    // 9. Gửi thông báo cho user
    await pushNoti({
      id_tk: id_tk,
      title: "Đổi voucher thành công!",
      message: `Bạn đã dùng ${pointsToDeduct} điểm để đổi voucher "${voucherTemplate.name}".`,
    });

    // 10. Trả về kết quả
    res.status(201).json({
      success: true,
      message: "Đổi voucher thành công!",
      data: {
        redeemedVoucher: newRedemption,
        newPoints: newPoints,
      }
    });

  } catch (error) {
    // 11. Nếu có lỗi, rollback tất cả thay đổi
    await t.rollback();
    console.error("redeemVoucher error:", error.message);
    res.status(400).json({ success: false, message: error.message || "Lỗi khi đổi voucher." });
  }
}