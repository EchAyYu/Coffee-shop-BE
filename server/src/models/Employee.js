import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Account from "./Account.js";

const Employee = sequelize.define(
  "Employee",
  {
    id_nv: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ten_nv: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,        // ✅ cho phép null
      // ⚠️ KHÔNG đặt unique ở đây nữa để tránh ALTER TABLE thêm index
      validate: {
        isEmail: true,
      },
    },
    sdt: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    dia_chi: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    anh: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    ngay_sinh: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Nếu bảng thật còn các cột khác (ngay_tao, ngay_cap_nhat, id_tk...)
    // mà bạn muốn map thêm thì có thể khai báo tiếp ở đây
  },
  {
    tableName: "nhan_vien",
    timestamps: false, // vì bảng đang không dùng createdAt/updatedAt mặc định
  }
);

// Quan hệ với Account (bảng tai_khoan)
Employee.belongsTo(Account, { foreignKey: "id_tk" });
Account.hasOne(Employee, { foreignKey: "id_tk" });

export default Employee;
