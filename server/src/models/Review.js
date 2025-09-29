import { DataTypes } from "sequelize";
import sequelize from "../utils/db.js";
import Customer from "./Customer.js";
import Product from "./Product.js";

const Review = sequelize.define("Review", {
  id_dg: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  diem: {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 },
  },
  noi_dung: {
    type: DataTypes.STRING(250),
  },
  ngay_dg: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "danh_gia",
  timestamps: false,
});

Review.belongsTo(Customer, { foreignKey: "id_kh" });
Customer.hasMany(Review, { foreignKey: "id_kh" });

Review.belongsTo(Product, { foreignKey: "id_mon" });
Product.hasMany(Review, { foreignKey: "id_mon" });

export default Review;
