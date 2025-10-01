// ví dụ: server/src/models/_associations.js (hoặc ngay sau khi import model)
import Order from "./Order.js";
import OrderDetail from "./OrderDetail.js";
import Product from "./Product.js";

Order.hasMany(OrderDetail, { foreignKey: "id_don" });
OrderDetail.belongsTo(Order, { foreignKey: "id_don" });

OrderDetail.belongsTo(Product, { foreignKey: "id_mon" });
Product.hasMany(OrderDetail, { foreignKey: "id_mon" });
