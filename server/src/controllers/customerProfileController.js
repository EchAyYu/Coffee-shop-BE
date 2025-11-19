import db from "../models/index.js"; // Import db để truy cập các model
const { Customer, Account } = db;

// 1. Lấy thông tin (Bao gồm cả Avatar & Ngày tham gia từ Account)
export async function getMyInfo(req, res) {
  try {
    const { id_tk } = req.user;
    if (!id_tk) return res.status(401).json({ message: "Không xác định được người dùng" });

    // Tìm Customer và kèm theo thông tin Account (Avatar, Ngày tạo)
    const customer = await Customer.findOne({ 
      where: { id_tk },
      include: [{
        model: Account,
        as: 'account', // Đảm bảo trong model Customer đã có belongsTo Account
        attributes: ['avatar', 'email', 'ngay_tao', 'ten_dn'] 
      }]
    });

    if (!customer) return res.status(404).json({ message: "Không tìm thấy thông tin khách hàng" });

    // Flatten data để frontend dễ dùng
    const data = {
      ...customer.toJSON(),
      avatar: customer.account?.avatar,
      email: customer.account?.email,
      ngay_tham_gia: customer.account?.ngay_tao,
      ten_dn: customer.account?.ten_dn
    };

    res.json({ success: true, data });
  } catch (err) {
    console.error("[getMyInfo]", err);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin khách hàng" });
  }
}

// 2. Cập nhật thông tin (Bao gồm cả Avatar)
export async function updateMyInfo(req, res) {
  try {
    const { id_tk } = req.user;
    if (!id_tk) return res.status(401).json({ message: "Không xác định được người dùng" });

    const { ho_ten, sdt, dia_chi, avatar } = req.body; // Nhận thêm avatar

    // Cập nhật bảng Customer
    const customer = await Customer.findOne({ where: { id_tk } });
    if (!customer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    await customer.update({ ho_ten, sdt, dia_chi });

    // Cập nhật bảng Account (Nếu có avatar)
    if (avatar) {
      const account = await Account.findByPk(id_tk);
      if (account) {
        await account.update({ avatar });
      }
    }

    res.json({ success: true, message: "Cập nhật thông tin thành công" });
  } catch (err) {
    console.error("[updateMyInfo]", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật thông tin" });
  }
}