import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const ReviewReply = sequelize.define(
  "ReviewReply",
  {
    id_phan_hoi: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Liên kết đến đánh giá mà nó phản hồi
    id_danh_gia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, 
      references: {
        model: "danh_gia",
        key: "id_dg",
      },
      onDelete: "CASCADE", 
    },
    // Liên kết đến tài khoản admin/employee đã phản hồi
    id_tk: {
      type: DataTypes.INTEGER,
      // ===== 💡 SỬA LỖI TẠI ĐÂY =====
      // Cho phép NULL để 'ON DELETE SET NULL' hoạt động
      allowNull: true, 
      // =============================
      references: {
        model: "tai_khoan",
        key: "id_tk",
      },
      onDelete: "SET NULL", // Giữ lại phản hồi nếu tài khoản admin bị xóa
    },
    noi_dung: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ngay_phan_hoi: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "phan_hoi_danh_gia",
    timestamps: false, 
  }
);

export default ReviewReply;