// src/models/index.js
import { Sequelize } from "sequelize";
import { config } from "../config/config.js";

// 🔌 Khởi tạo Sequelize
const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.pass,
  {
    host: config.db.host,
    dialect: config.db.dialect,
    logging: false,
  }
);

// 🧩 Import models đã khai báo với sequelize riêng
import Category from "./Category.js";
import Product from "./Product.js";
import Order from "./Order.js";
import Reservation from "./Reservation.js";
import Customer from "./Customer.js";
import Account from "./Account.js";

// 🔗 Thiết lập quan hệ giữa các bảng (nếu có)
Category.hasMany(Product, { foreignKey: "id_dm" });
Product.belongsTo(Category, { foreignKey: "id_dm" });

Account.hasOne(Customer, { foreignKey: "id_tk" });
Customer.belongsTo(Account, { foreignKey: "id_tk" });

Customer.hasMany(Order, { foreignKey: "id_kh" });
Order.belongsTo(Customer, { foreignKey: "id_kh" });

Customer.hasMany(Reservation, { foreignKey: "id_kh" });
Reservation.belongsTo(Customer, { foreignKey: "id_kh" });

// ✅ Export Sequelize instance và models
const db = {
  sequelize,
  Sequelize,
  Category,
  Product,
  Order,
  Reservation,
  Customer,
  Account,
};

export default db;
