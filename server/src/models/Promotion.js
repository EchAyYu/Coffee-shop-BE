import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Promotion = sequelize.define("Promotion", {
  id_km: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ten_km: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  mo_ta: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hinh_anh: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // % giảm (dùng cho loại PERCENT)
  pt_giam: {
    type: DataTypes.INTEGER, // 0–100
    allowNull: false,
    defaultValue: 0,
  },

  // 🔥 MỚI: loại khuyến mãi
  // PERCENT: giảm %
  // FIXED_PRICE: đồng giá (gia_dong)
  loai_km: {
    type: DataTypes.ENUM("PERCENT", "FIXED_PRICE"),
    allowNull: false,
    defaultValue: "PERCENT",
  },

  // 🔥 MỚI: giá đồng nếu loai_km = FIXED_PRICE
  gia_dong: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // 🔥 MỚI: phạm vi áp dụng
  // ALL: tất cả sản phẩm
  // CATEGORY: 1 danh mục (id_danh_muc)
  // PRODUCT: 1 món cụ thể (id_mon)
  target_type: {
    type: DataTypes.ENUM("ALL", "CATEGORY", "PRODUCT"),
    allowNull: false,
    defaultValue: "ALL",
  },
  id_danh_muc: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  id_mon: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  ngay_bd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  ngay_kt: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  // 🔥 MỚI: giới hạn theo giờ trong ngày (có thể để null = cả ngày)
  gio_bd: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  gio_kt: {
    type: DataTypes.TIME,
    allowNull: true,
  },

  lap_lai_thu: {
    type: DataTypes.TINYINT, // 1–7: 1=Thứ 2, ..., 7=CN
    allowNull: true,
  },
  hien_thi: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  button_text: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  button_link: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: "khuyen_mai",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export default Promotion;
