import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";

const Order = sequelize.define("Order", {
  id_don: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_kh: { // Thêm FK để liên kết với Customer
    type: DataTypes.INTEGER,
    allowNull: true, // Cho phép đơn hàng không cần khách hàng đăng nhập (khách vãng lai)
    references: {
      model: Customer,
      key: 'id_kh'
    }
  },
  ho_ten_nhan: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sdt_nhan: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  dia_chi_nhan: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  email_nhan: { // 💡 Thêm trường email người nhận
    type: DataTypes.STRING(100),
    allowNull: true, // Có thể không bắt buộc nếu chỉ thanh toán COD
    validate: {
      isEmail: true,
    }
  },
  pttt: {
    // 💡 Cập nhật ENUM phương thức thanh toán
    type: DataTypes.ENUM("COD", "BANK_TRANSFER"),
    allowNull: false,
    defaultValue: "COD",
  },
  trang_thai: {
    // 💡 Cập nhật ENUM trạng thái (thêm chờ thanh toán)
    type: DataTypes.ENUM("pending", "pending_payment", "confirmed", "completed", "cancelled"),
    defaultValue: "pending",
  },
  tong_tien: { // 💡 Thêm trường tổng tiền (sẽ tính ở BE)
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  ghi_chu: { // 💡 Thêm trường ghi chú (tùy chọn)
     type: DataTypes.TEXT,
     allowNull: true,
  },
  ngay_dat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "don_hang",
  timestamps: true, // Nên bật timestamps để biết ngày tạo/cập nhật
  createdAt: 'ngay_tao',
  updatedAt: 'ngay_cap_nhat'
});

// Quan hệ với Customer (Đã có sẵn)
Order.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Order, { foreignKey: "id_kh" });

export default Order;
