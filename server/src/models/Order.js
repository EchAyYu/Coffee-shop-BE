import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";

const Order = sequelize.define("Order", {
  id_don: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ho_ten_nhan: {
    type: DataTypes.STRING(100),
  },
  sdt_nhan: {
    type: DataTypes.STRING(20),
  },
  dia_chi_nhan: {
    type: DataTypes.STRING(200),
  },
  pttt: {
    type: DataTypes.ENUM("COD", "VNPAY"),
    defaultValue: "COD",
  },
  trang_thai: {
    type: DataTypes.ENUM("pending", "confirmed", "completed", "cancelled"),
    defaultValue: "pending",
  },
  ngay_dat: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "don_hang",
  timestamps: false,
});

Order.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Order, { foreignKey: "id_kh" });

export default Order;
