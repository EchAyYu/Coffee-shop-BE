import { Sequelize } from "sequelize";

const sequelize = new Sequelize("coffee_shop", "root", "H@u29072003", {
  host: "localhost",
  dialect: "mysql",
});

export default sequelize;
