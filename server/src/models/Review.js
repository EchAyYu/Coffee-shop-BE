// src/models/Review.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Review = sequelize.define(
  "Review",
  {
    id_dg: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_kh: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "khach_hang",
        key: "id_kh",
      },
      onDelete: "CASCADE",
    },
    id_mon: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "mon",
        key: "id_mon",
      },
      onDelete: "CASCADE",
    },
    diem: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    noi_dung: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    ngay_dg: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "danh_gia",
    timestamps: false,
  }
);

export default Review;
