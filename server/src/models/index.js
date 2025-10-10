// src/models/index.js
import sequelize from "../utils/db.js"; // ✅ Dùng lại instance có sẵn
import { Sequelize } from "sequelize";

// 🧩 Import models (tất cả đều dùng chung sequelize từ utils/db.js)
import Category from "./Category.js";
import Product from "./Product.js";
import Order from "./Order.js";
import Reservation from "./Reservation.js";
import Customer from "./Customer.js";
import Account from "./Account.js";
import Review from "./Review.js";

// 🔗 Thiết lập quan hệ giữa các bảng (chung một sequelize)
Category.hasMany(Product, { foreignKey: "id_dm" });
Product.belongsTo(Category, { foreignKey: "id_dm" });

Account.hasOne(Customer, { foreignKey: "id_tk" });
Customer.belongsTo(Account, { foreignKey: "id_tk" });

Customer.hasMany(Order, { foreignKey: "id_kh" });
Order.belongsTo(Customer, { foreignKey: "id_kh" });

Customer.hasMany(Reservation, { foreignKey: "id_kh" });
Reservation.belongsTo(Customer, { foreignKey: "id_kh" });

// 🔗 Liên kết đánh giá (review)
Customer.hasMany(Review, { foreignKey: "id_kh" });
Review.belongsTo(Customer, { foreignKey: "id_kh" });

Product.hasMany(Review, { foreignKey: "id_mon" });
Review.belongsTo(Product, { foreignKey: "id_mon" });

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
  Review,
};

export default db;
