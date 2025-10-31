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
    email:  DataTypes.STRING(100),
    sdt:    DataTypes.STRING(20),
    dia_chi: DataTypes.STRING(200), // giữ tương thích cũ
    // ⬇️ mới
    street:   DataTypes.STRING(200),
    ward:     DataTypes.STRING(100),
    district: DataTypes.STRING(100),
    province: DataTypes.STRING(100),
    anh: DataTypes.STRING(200),
    diem: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: "khach_hang", timestamps: false }
);

export default Customer;

