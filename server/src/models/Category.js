import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Category = sequelize.define("Category", {
  id_dm: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ten_dm: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  anh: {
    type: DataTypes.STRING(200),
  },
}, {
  tableName: "danh_muc",
  timestamps: false,
});

export default Category;
