// server/src/models/index.js (ĐÃ CẬP NHẬT)

import sequelize from "../utils/db.js";
import { Sequelize } from "sequelize";

import Category from "./Category.js";
import Product from "./Product.js";
import Order from "./Order.js";
import OrderDetail from "./OrderDetail.js";
import Reservation from "./Reservation.js";
import Customer from "./Customer.js";
import Account from "./Account.js";
import Review from "./Reviews.js";
import Notification from "./Notification.js"; 
import ReviewReply from "./ReviewReply.js";

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
Order.hasMany(Review, { foreignKey: "id_don" });
Review.belongsTo(Order, { foreignKey: "id_don" });

// --- Thông báo ---
Account.hasMany(Notification, { foreignKey: "id_tk" });
Notification.belongsTo(Account, { foreignKey: "id_tk" });

// Mỗi Đánh giá (Review) chỉ có MỘT Phản hồi (ReviewReply)
Review.hasOne(ReviewReply, { foreignKey: 'id_danh_gia' });
ReviewReply.belongsTo(Review, { foreignKey: 'id_danh_gia' });

// Mỗi Tài khoản (Account) có thể tạo NHIỀU Phản hồi (ReviewReply)
Account.hasMany(ReviewReply, { foreignKey: 'id_tk' });
ReviewReply.belongsTo(Account, { foreignKey: 'id_tk' });


// ✅ Xuất toàn bộ
const db = {
  sequelize,
  Sequelize,
  Category,
  Product,
  Order,
  OrderDetail,
  Reservation,
  Customer,
  Account,
  Review,
  Notification, 
  ReviewReply,
};

export default db;