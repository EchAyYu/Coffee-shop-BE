// src/models/Order.js (ĐÃ CẬP NHẬT ENUM)

import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";

const Order = sequelize.define("Order", {
  id_don: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_kh: {
    type: DataTypes.INTEGER,
    allowNull: true, 
    references: {
      model: Customer, // 💡 Tốt hơn là dùng Model
      key: 'id_kh'
    },
    onDelete: "SET NULL", // 💡 An toàn hơn: nếu xóa khách hàng, giữ lại đơn hàng
    onUpdate: "CASCADE"
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
  email_nhan: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true,
    }
  },
  pttt: {
    type: DataTypes.ENUM("COD", "BANK_TRANSFER"),
    allowNull: false,
    defaultValue: "COD",
  },
  trang_thai: {
    // ===== 💡 SỬA LỖI: THÊM CÁC TRẠNG THÁI CŨ CỦA BẠN VÀO ĐÂY =====
    type: DataTypes.ENUM(
      "pending", 
      "pending_payment", 
      "confirmed", 
      "completed", 
      "cancelled",
      "done",       // (Trạng thái cũ)
      "paid",       // (Trạng thái cũ)
      "shipped",     // (Trạng thái cũ)
      "PREORDER"
    ),
    // ========================================================
    defaultValue: "pending",
  },
  tong_tien: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  ghi_chu: { 
      type: DataTypes.TEXT,
      allowNull: true,
  },
  ngay_dat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  points_awarded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  diem_nhan_duoc: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "don_hang",
  timestamps: true, 
  createdAt: 'ngay_tao',
  updatedAt: 'ngay_cap_nhat'
}
);

// Quan hệ với Customer (Đã có sẵn)
Order.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Order, { foreignKey: "id_kh" });

export default Order;