// src/models/PromotionProduct.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const PromotionProduct = sequelize.define(
  "PromotionProduct",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_km: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_mon: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "khuyen_mai_mon",
    timestamps: false,
  }
);

export default PromotionProduct;
