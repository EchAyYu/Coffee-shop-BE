import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Account from "./Account.js";

const Customer = sequelize.define("Customer", {
  id_kh: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_tk: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "tai_khoan", // hoặc "Account" nếu tableName là account
      key: "id_tk",
    },
  },
  ho_ten: DataTypes.STRING(100),
  email: DataTypes.STRING(100),
  sdt: DataTypes.STRING(20),
  dia_chi: DataTypes.STRING(200),
  anh: DataTypes.STRING(200),
  diem: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: "khach_hang",
  timestamps: false,
});


Customer.belongsTo(Account, { foreignKey: "id_tk" });
Account.hasOne(Customer, { foreignKey: "id_tk" });

export default Customer;
