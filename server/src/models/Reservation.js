import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";

const Reservation = sequelize.define("Reservation", {
  id_datban: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_kh: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ho_ten: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sdt: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  ngay_dat: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  so_nguoi: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  ghi_chu: {
    type: DataTypes.STRING(255),
  },
  trang_thai: {
    type: DataTypes.ENUM("PENDING", "CONFIRMED", "CANCELLED", "DONE"),
    defaultValue: "PENDING",
  },
}, {
  tableName: "dat_ban",
  timestamps: false,
});

Reservation.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Reservation, { foreignKey: "id_kh" });

export default Reservation;
