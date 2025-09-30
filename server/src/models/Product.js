import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Product = sequelize.define("Product", {
  id_mon: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_dm: {
    type: DataTypes.INTEGER,
    allowNull: false,            
  },
  ten_mon: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  gia: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  mo_ta: {
    type: DataTypes.STRING(250),
  },
  anh: {
    type: DataTypes.STRING(200),
  },
  trang_thai: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: "mon",
  timestamps: false,
});

export default Product;
