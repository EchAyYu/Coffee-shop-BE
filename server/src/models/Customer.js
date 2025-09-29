import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Account from "./Account.js";

const Customer = sequelize.define("Customer", {
  id_kh: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ho_ten: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    unique: true,
  },
  sdt: {
    type: DataTypes.STRING(20),
  },
  dia_chi: {
    type: DataTypes.STRING(200),
  },
  anh: {
    type: DataTypes.STRING(200),
  },
  diem: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "khach_hang",
  timestamps: false,
});

Customer.belongsTo(Account, { foreignKey: "id_tk" });
Account.hasOne(Customer, { foreignKey: "id_tk" });

export default Customer;
