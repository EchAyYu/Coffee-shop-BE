import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Promotion = sequelize.define("Promotion", {
  id_km: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ten_km: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  mo_ta: {
    type: DataTypes.STRING(255), // Mô tả ngắn hiển thị trên banner
    allowNull: true,
  },
  hinh_anh: {
    type: DataTypes.STRING(255), // URL ảnh banner
    allowNull: true,
  },
  pt_giam: {
    type: DataTypes.INTEGER, // Phần trăm giảm (VD: 10, 20)
    defaultValue: 0,
  },
  ngay_bd: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ngay_kt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // LOGIC LẶP LẠI HÀNG TUẦN
  // 0: CN, 1: T2, ..., 5: T6, 6: T7. Nếu null thì là khuyến mãi thường (theo ngày)
  lap_lai_thu: {
    type: DataTypes.INTEGER, 
    allowNull: true, 
    validate: { min: 0, max: 6 } 
  },
  hien_thi: { // Admin có muốn hiện lên trang chủ không
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: "khuyen_mai",
  timestamps: false,
});

export default Promotion;