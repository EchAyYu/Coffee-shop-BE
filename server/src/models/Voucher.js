import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";

const Voucher = sequelize.define(
  "Voucher",
  {
    id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name:          { type: DataTypes.STRING(150), allowNull: false },
    description:   { type: DataTypes.STRING(500) },
    code_prefix:   { type: DataTypes.STRING(20), defaultValue: "VCH" },
    discount_type: { type: DataTypes.ENUM("fixed", "percent"), allowNull: false },
    discount_value:{ type: DataTypes.DECIMAL(10,2), allowNull: false },
    min_order:     { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
    max_discount:  { type: DataTypes.DECIMAL(10,2), allowNull: true },
    points_cost:   { type: DataTypes.INTEGER, defaultValue: 0 },
    expires_at:    { type: DataTypes.DATE, allowNull: true },
    active:        { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    total_quantity: { type: DataTypes.INTEGER, allowNull: true }, 
    redeemed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: "vouchers", timestamps: false }
);

export default Voucher;
