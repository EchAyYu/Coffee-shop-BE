// server/src/models/index.js
import sequelize from "../utils/db.js";
import { Sequelize } from "sequelize";

import Category from "./Category.js";
import Product from "./Product.js";
import Order from "./Order.js";
import OrderDetail from "./OrderDetail.js"; // ✅ thêm dòng này
import Reservation from "./Reservation.js";
import Customer from "./Customer.js";
import Account from "./Account.js";
import Review from "./Review.js";

// ===============================
// 🔗 Thiết lập quan hệ
// ===============================

// --- Danh mục & sản phẩm ---
Category.hasMany(Product, { foreignKey: "id_dm" });
Product.belongsTo(Category, { foreignKey: "id_dm" });

// --- Tài khoản & khách hàng ---
Account.hasOne(Customer, { foreignKey: "id_tk" });
Customer.belongsTo(Account, { foreignKey: "id_tk" });

// --- Khách hàng & đơn hàng ---
Customer.hasMany(Order, { foreignKey: "id_kh" });
Order.belongsTo(Customer, { foreignKey: "id_kh" });

// --- Đơn hàng & chi tiết ---
Order.hasMany(OrderDetail, { foreignKey: "id_don" });
OrderDetail.belongsTo(Order, { foreignKey: "id_don" });

// --- Sản phẩm & chi tiết ---
Product.hasMany(OrderDetail, { foreignKey: "id_mon" });
OrderDetail.belongsTo(Product, { foreignKey: "id_mon" });

// --- Khách hàng & đặt bàn ---
Customer.hasMany(Reservation, { foreignKey: "id_kh" });
Reservation.belongsTo(Customer, { foreignKey: "id_kh" });

// --- Đánh giá ---
Customer.hasMany(Review, { foreignKey: "id_kh" });
Review.belongsTo(Customer, { foreignKey: "id_kh" });
Product.hasMany(Review, { foreignKey: "id_mon" });
Review.belongsTo(Product, { foreignKey: "id_mon" });

// ✅ Xuất toàn bộ
const db = {
  sequelize,
  Sequelize,
  Category,
  Product,
  Order,
  OrderDetail, // ✅ thêm vào export
  Reservation,
  Customer,
  Account,
  Review,
};

export default db;
