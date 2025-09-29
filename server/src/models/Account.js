import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Account = sequelize.define("Account", {
  id_tk: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ten_dn: {
    type: DataTypes.STRING(200),
    unique: true,
    allowNull: false,
  },
  mat_khau: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM("customer", "employee", "admin"),
    defaultValue: "customer",
  },
}, {
  tableName: "tai_khoan",
  timestamps: false,
});

export default Account;
