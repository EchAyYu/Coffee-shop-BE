// models/HomeContent.js
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const HomeContent = sequelize.define("HomeContent", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "home_contents",
  timestamps: true,
});

export default HomeContent;
