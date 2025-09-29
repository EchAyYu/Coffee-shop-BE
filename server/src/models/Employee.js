import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Account from "./Account.js";

const Employee = sequelize.define("Employee", {
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
  ngay_sinh: {
    type: DataTypes.DATE,
  },
}, {
  tableName: "nhan_vien",
  timestamps: false,
});

Employee.belongsTo(Account, { foreignKey: "id_tk" });
Account.hasOne(Employee, { foreignKey: "id_tk" });

export default Employee;
