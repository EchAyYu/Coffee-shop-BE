// server/src/models/index.js

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
import Promotion from "./Promotion.js";

// 💥 THÊM: bảng trung gian khuyến mãi – món
import PromotionProduct from "./PromotionProduct.js";

// 💥 (khuyến nghị) THÊM: model voucher nếu bạn dùng db.index ở chỗ khác
import Voucher from "./Voucher.js";
import VoucherRedemption from "./VoucherRedemption.js";

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

// --- Phản hồi đánh giá ---
Review.hasOne(ReviewReply, { foreignKey: "id_danh_gia" });
ReviewReply.belongsTo(Review, { foreignKey: "id_danh_gia" });

Account.hasMany(ReviewReply, { foreignKey: "id_tk" });
ReviewReply.belongsTo(Account, { foreignKey: "id_tk" });

// ===============================
// 🔗 QUAN HỆ KHUYẾN MÃI & SẢN PHẨM
// ===============================

// Many–to–Many: Promotion <-> Product qua PromotionProduct
Promotion.belongsToMany(Product, {
  through: PromotionProduct,
  foreignKey: "id_km",
  otherKey: "id_mon",
});

Product.belongsToMany(Promotion, {
  through: PromotionProduct,
  foreignKey: "id_mon",
  otherKey: "id_km",
});

// Để controller có thể include "PromotionProducts"
Promotion.hasMany(PromotionProduct, {
  foreignKey: "id_km",
  as: "PromotionProducts",
});
PromotionProduct.belongsTo(Promotion, { foreignKey: "id_km" });
PromotionProduct.belongsTo(Product, { foreignKey: "id_mon" });
Product.hasMany(PromotionProduct, { foreignKey: "id_mon" });

// ===============================
// 🔗 VOUCHER & REDEMPTION (nếu bạn dùng)
// ===============================
Voucher.hasMany(VoucherRedemption, {
  foreignKey: "voucher_id",
});
VoucherRedemption.belongsTo(Voucher, {
  foreignKey: "voucher_id",
});

// Nếu muốn gắn với Account / Customer thì thêm:
// Account.hasMany(VoucherRedemption, { foreignKey: "id_tk" });
// VoucherRedemption.belongsTo(Account, { foreignKey: "id_tk" });

// ===============================
// ✅ Xuất toàn bộ
// ===============================
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
  Promotion,
  PromotionProduct,
  Voucher,
  VoucherRedemption,
};

export default db;
