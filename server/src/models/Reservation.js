// src/models/Reservation.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";
import Table from "./Table.js"; 
import Order from "./Order.js";

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
id_don_dat_truoc: {
    type: DataTypes.INTEGER,
    allowNull: true, // Cho phép NULL (vì khách có thể không đặt món)
    references: {
      model: Order,
      key: 'id_don'
    },
    onDelete: "SET NULL", // Nếu xóa Order, chỉ set null chứ không xóa Reservation
    onUpdate: "CASCADE"
  }
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

// 💡💡💡 THÊM QUAN HỆ VỚI ORDER (ĐỂ SỬA LỖI 500 CỦA ADMIN) 💡💡💡
Reservation.belongsTo(Order, { 
  foreignKey: "id_don_dat_truoc", 
  as: "PreOrder" // 👈 'as' này RẤT QUAN TRỌNG, phải khớp với controller
});
Order.hasOne(Reservation, { 
  foreignKey: "id_don_dat_truoc",
  as: "Reservation"
});

export default Reservation;