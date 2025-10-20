// ===============================
// ☕ Coffee Shop Backend - Table Model
// ===============================
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Table = sequelize.define("Table", {
  id_ban: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  so_ban: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: "Số bàn, VD: B01, B02, VIP-01"
  },
  ten_ban: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "Tên mô tả bàn"
  },
  khu_vuc: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "main",
    comment: "Khu vực: main, vip, outdoor, rooftop"
  },
  suc_chua: {
    type: DataTypes.INTEGER,
    defaultValue: 4,
    comment: "Số người tối đa"
  },
  trang_thai: {
    type: DataTypes.ENUM("available", "occupied", "reserved", "maintenance"),
    defaultValue: "available",
    comment: "Trạng thái: available (trống), occupied (đang dùng), reserved (đã đặt), maintenance (bảo trì)"
  },
  hinh_anh: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "URL hình ảnh bàn"
  },
  mo_ta: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Mô tả chi tiết"
  },
  gia_dat_ban: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: "Phí đặt bàn (nếu có)"
  }
}, {
  tableName: "ban",
  timestamps: true,
  createdAt: "ngay_tao",
  updatedAt: "ngay_cap_nhat",
});

export default Table;