// src/models/Review.js (ĐÃ CẬP NHẬT)
import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Review = sequelize.define(
  "Review",
  {
    id_dg: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_kh: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "khach_hang",
        key: "id_kh",
      },
      onDelete: "CASCADE",
    },
    id_mon: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "mon",
        key: "id_mon",
      },
      onDelete: "CASCADE",
    },

    // ===== 💡 PHẦN MỚI THÊM VÀO =====
    // Thêm id_don để xác minh người dùng đã mua hàng
    id_don: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "don_hang", // Tên bảng (tableName) của Order
        key: "id_don",
      },
      onDelete: "CASCADE", // Xóa đánh giá nếu đơn hàng bị xóa
    },
    // ================================

    diem: { // Đây là "xep_hang" (rating)
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    noi_dung: { // Đây là "binh_luan" (comment)
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    dislikes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    ngay_dg: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "danh_gia",
    timestamps: false,
    
    
    // Đảm bảo không ai có thể đánh giá 1 món 2 lần TRONG CÙNG 1 ĐƠN HÀNG
    indexes: [
      {
        unique: true,
        fields: ['id_kh', 'id_mon', 'id_don'],
        name: 'unique_review_per_order_item'
      }
    ]
    // ===================================
  }
);

export default Review;