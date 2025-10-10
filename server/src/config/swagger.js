import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export function swaggerDocs(app) {
  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "☕ Coffee Shop REST API Documentation",
        version: "1.0.0",
       description: `
### 📘 Giới thiệu
Tài liệu API cho hệ thống **Coffee Shop Website**, được xây dựng bằng **Node.js (Express) + Sequelize + MySQL**.

Hệ thống gồm các nhóm API chính:
- 🔐 Authentication (đăng ký, đăng nhập, refresh token, đổi mật khẩu)
- 🏷️ Categories (quản lý danh mục)
- 🛒 Products (CRUD sản phẩm)
- 📦 Orders (đặt hàng)
- 📅 Reservations (đặt bàn)
- 📊 Stats (thống kê doanh thu)

### 👤 Xác thực
Đa số các API yêu cầu \`JWT Bearer Token\` ở phần **Authorize** (góc phải trên).
`,
        contact: {
          name: "Hệ thống Coffee Shop",
          email: "support@coffeeshop.vn",
        },
        license: {
          name: "MIT License",
        },
      },
      servers: [
        {
          url: "http://localhost:4000",
          description: "Local development server",
        },
        {
          url: "https://your-deployed-api-url.com",
          description: "Deployed (production) server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    // 🧭 Đường dẫn đọc mô tả từ các file routes
    apis: ["./src/routes/*.js"],
  };

  const swaggerSpec = swaggerJsdoc(options);

  // Giao diện Swagger UI với tùy chỉnh
  const uiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info h1 { font-size: 2em; color: #533825; }
      .swagger-ui .markdown p { font-size: 1.05em; }
    `,
    customSiteTitle: "Coffee Shop API Docs ☕",
  };

  // Đăng ký route /api-docs
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, uiOptions));

  console.log("📘 Swagger Docs available at: http://localhost:4000/api-docs");
}
