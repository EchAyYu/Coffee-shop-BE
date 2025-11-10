// src/models/Customer.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Customer = sequelize.define(
  "Customer",
  {
    id_kh: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_tk: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tai_khoan", key: "id_tk" },
    },
    ho_ten: DataTypes.STRING(100),
    email: DataTypes.STRING(100),
    sdt: DataTypes.STRING(20),
    dia_chi: DataTypes.STRING(200),
    street: DataTypes.STRING(200),
    ward: DataTypes.STRING(100),
    district: DataTypes.STRING(100),
    province: DataTypes.STRING(100),
    anh: DataTypes.STRING(200),
    diem: { type: DataTypes.INTEGER, defaultValue: 0 },
    // 🔽 CÁC TRƯỜNG MỚI ĐƯỢC THÊM VÀO 🔽
    ngay_tao: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    },
    ngay_cap_nhat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    }
  },
  {
    tableName: "khach_hang",
    // 💡 BẬT TIMESTAMPS VÀ ĐỊNH NGHĨA TÊN CỘT
    timestamps: true,
    createdAt: 'ngay_tao',
    updatedAt: 'ngay_cap_nhat',
  }
);

export default Customer;