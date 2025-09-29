import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Order from "./Order.js";
import Product from "./Product.js";

const OrderDetail = sequelize.define("OrderDetail", {
  id_ct: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  so_luong: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  gia: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: "ct_don_hang",
  timestamps: false,
});

OrderDetail.belongsTo(Order, { foreignKey: "id_don" });
Order.hasMany(OrderDetail, { foreignKey: "id_don" });

OrderDetail.belongsTo(Product, { foreignKey: "id_mon" });
Product.hasMany(OrderDetail, { foreignKey: "id_mon" });

export default OrderDetail;
