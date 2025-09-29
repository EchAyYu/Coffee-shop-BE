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
  },
  ngay_bd: {
    type: DataTypes.DATE,
  },
  ngay_kt: {
    type: DataTypes.DATE,
  },
  pt_giam: {
    type: DataTypes.INTEGER, // % giảm giá
  },
}, {
  tableName: "khuyen_mai",
  timestamps: false,
});

export default Promotion;
