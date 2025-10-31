import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Notification = sequelize.define(
  "Notification",
  {
    id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_tk:     { type: DataTypes.INTEGER, allowNull: false }, // người nhận
    type:      { type: DataTypes.ENUM("order", "reservation"), defaultValue: "order" },
    title:     { type: DataTypes.STRING(200), allowNull: false },
    message:   { type: DataTypes.STRING(500), allowNull: false },
    is_read:   { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at:{ type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "notifications", timestamps: false }
);

export default Notification;
