import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";

const Reservation = sequelize.define("Reservation", {
  id_res: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  id_kh: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ho_ten: DataTypes.STRING(100),
  sdt: DataTypes.STRING(20),
  ngay_dat: DataTypes.DATE,
  so_nguoi: DataTypes.INTEGER,
  ghi_chu: DataTypes.STRING(200),
  status: {
    type: DataTypes.ENUM("PENDING", "CONFIRMED", "CANCELLED"),
    defaultValue: "PENDING",
  },
}, {
  tableName: "dat_ban",
  timestamps: false,
});

Reservation.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Reservation, { foreignKey: "id_kh" });

export default Reservation;
