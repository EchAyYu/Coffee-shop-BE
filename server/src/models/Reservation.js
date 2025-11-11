// src/models/Reservation.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";
import Table from "./Table.js"; // 💡 THÊM IMPORT

const Reservation = sequelize.define("Reservation", {
  id_datban: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_kh: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // 💡💡💡 THÊM TRƯỜNG id_ban 💡💡💡
  id_ban: {
    type: DataTypes.INTEGER,
    allowNull: true, // Cho phép null vì logic 'createReservation' của bạn chưa hỗ trợ gán bàn
    references: {
      model: Table,
      key: 'id_ban'
    },
    onDelete: "SET NULL",
    onUpdate: "CASCADE"
  },
  ho_ten: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sdt: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  ngay_dat: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // 💡 TÔI CŨNG THÊM gio_dat VÀO ĐÂY (VÌ BẠN CÓ TRONG CONTROLLER)
  gio_dat: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  so_nguoi: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  ghi_chu: {
    type: DataTypes.STRING(255),
  },
  trang_thai: {
    type: DataTypes.ENUM("PENDING", "CONFIRMED", "CANCELLED", "DONE"),
    defaultValue: "PENDING",
  },
}, {
  tableName: "dat_ban",
  timestamps: false, // Giữ nguyên như file gốc của bạn
});

// Quan hệ với Customer
Reservation.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Reservation, { foreignKey: "id_kh" });

// 💡💡💡 THÊM QUAN HỆ VỚI BÀN 💡💡💡
Reservation.belongsTo(Table, { foreignKey: "id_ban" });
Table.hasMany(Reservation, { foreignKey: "id_ban" });

export default Reservation;