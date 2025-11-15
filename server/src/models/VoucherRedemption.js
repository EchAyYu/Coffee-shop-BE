import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Voucher from "./Voucher.js";

const VoucherRedemption = sequelize.define(
  "VoucherRedemption",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    voucher_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Voucher, key: "id" },
    },
    id_tk: { type: DataTypes.INTEGER, allowNull: false },
    code: {
    type: DataTypes.STRING(40),
    // unique: true, // Đảm bảo bạn đã comment dòng này
    allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "used", "expired", "cancelled"),
      defaultValue: "active",
    },
    used_order_id: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    used_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "voucher_redemptions", timestamps: false }
);
VoucherRedemption.belongsTo(Voucher, { foreignKey: "voucher_id" });

export default VoucherRedemption;