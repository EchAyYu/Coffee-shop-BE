// src/utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); // Đảm bảo biến môi trường được load

// =======================
// ✅ Nodemailer Transporter
// =======================
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure:
    String(process.env.MAIL_SECURE) === "true" ||
    Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production",
  },
});

// =========================================
// ✅ ORDER EMAIL (Xác nhận đơn hàng)
// =========================================

// Hàm tạo nội dung email HTML (Order)
function createOrderConfirmationHtml(order, orderDetails) {
  const itemsHtml = (orderDetails || [])
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${
        item.Product?.ten_mon || "Sản phẩm"
      }</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
        item.so_luong
      }</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(
        item.gia
      ).toLocaleString("vi-VN")} ₫</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(
        Number(item.gia) * Number(item.so_luong)
      ).toLocaleString("vi-VN")} ₫</td>
    </tr>
  `
    )
    .join("");

  const paymentInfo =
    String(order.pttt || "").toUpperCase() === "BANK_TRANSFER"
      ? `
    <p>Bạn đã chọn <b>chuyển khoản</b>. Vui lòng chuyển khoản <b>${Number(
      order.tong_tien || 0
    ).toLocaleString("vi-VN")} ₫</b> theo hướng dẫn trên website (mục thanh toán).</p>
    <p>Đơn hàng sẽ được xử lý sau khi chúng tôi xác nhận thanh toán.</p>
  `
      : `<p>Bạn đã chọn thanh toán bằng tiền mặt khi nhận hàng (COD).</p>`;

  return `
    <html>
      <body style="font-family: sans-serif; line-height: 1.6;">
        <h2>Chào ${order.ho_ten_nhan || "bạn"},</h2>
        <p>Cảm ơn bạn đã đặt hàng tại LO COFFEE! Đơn hàng <b>#${order.id_don}</b> của bạn đã được ghi nhận.</p>

        <h3>Chi tiết đơn hàng:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sản phẩm</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Số lượng</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Đơn giá</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right;"><strong>Tổng cộng:</strong></td>
              <td style="padding: 8px; text-align: right;"><strong>${Number(
                order.tong_tien || 0
              ).toLocaleString("vi-VN")} ₫</strong></td>
            </tr>
          </tfoot>
        </table>

        <h3>Thông tin nhận hàng:</h3>
        <ul>
          <li>Người nhận: ${order.ho_ten_nhan || ""}</li>
          <li>Số điện thoại: ${order.sdt_nhan || ""}</li>
          <li>Địa chỉ: ${order.dia_chi_nhan || ""}</li>
          ${order.ghi_chu ? `<li>Ghi chú: ${order.ghi_chu}</li>` : ""}
        </ul>

        <h3>Phương thức thanh toán:</h3>
        ${paymentInfo}

        <p>Cảm ơn bạn đã lựa chọn LO COFFEE!</p>
        <p>Trân trọng,<br/>Đội ngũ LO COFFEE</p>
      </body>
    </html>
  `;
}

// Hàm gửi email xác nhận đơn hàng
export const sendOrderConfirmationEmail = async (order, orderDetails) => {
  if (!order?.email_nhan) {
    console.warn(
      `Đơn hàng #${order?.id_don} không có email người nhận, không thể gửi mail.`
    );
    return;
  }

  const mailOptions = {
    from: `"LO COFFEE" <${process.env.MAIL_USER}>`,
    to: order.email_nhan,
    subject: `Xác nhận đơn hàng LO COFFEE #${order.id_don}`,
    html: createOrderConfirmationHtml(order, orderDetails),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Email xác nhận đơn hàng #${order.id_don} đã gửi tới ${order.email_nhan}: ${info.messageId}`
    );
  } catch (error) {
    console.error(`❌ Lỗi gửi email cho đơn hàng #${order.id_don}:`, error);
  }
};

// =========================================
// ✅ RESERVATION EMAIL (Đặt bàn)
// =========================================

function fmtDateVN(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("vi-VN");
  } catch {
    return String(date);
  }
}

function fmtTimeVN(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}

function createReservationEmailHtml({
  reservation,
  customer,
  table,
  statusLabel,
  preOrder,
  preOrderDetails,
}) {
  const hasPreOrder = !!preOrder;

  const itemsHtml = (preOrderDetails || [])
    .map(
      (item) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${
          item.Product?.ten_mon || "Sản phẩm"
        }</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
          item.so_luong
        }</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(
          item.gia
        ).toLocaleString("vi-VN")} ₫</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(
          Number(item.gia) * Number(item.so_luong)
        ).toLocaleString("vi-VN")} ₫</td>
      </tr>
    `
    )
    .join("");

  const tableText = table
    ? `${table.ten_ban || "Bàn"}${table.so_ban ? ` (Số ${table.so_ban})` : ""}`
    : reservation.id_ban
    ? `Bàn #${reservation.id_ban}`
    : "Chưa gán bàn";

  const preOrderBlock = hasPreOrder
    ? `
    <h3>Đặt món trước (Pre-order)</h3>
    <p>Mã đơn đặt trước: <b>#${preOrder.id_don}</b></p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sản phẩm</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">SL</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Đơn giá</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || ""}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 8px; text-align: right;"><strong>Tổng pre-order:</strong></td>
          <td style="padding: 8px; text-align: right;"><strong>${Number(
            preOrder.tong_tien || 0
          ).toLocaleString("vi-VN")} ₫</strong></td>
        </tr>
      </tfoot>
    </table>
  `
    : `<p><i>Bạn chưa đặt món trước.</i></p>`;

  return `
  <html>
    <body style="font-family: sans-serif; line-height: 1.6;">
      <h2>LO COFFEE - ${statusLabel}</h2>

      <p>Chào <b>${reservation.ho_ten || customer?.ho_ten || "bạn"}</b>,</p>

      <p>
        Yêu cầu đặt bàn của bạn đã được cập nhật trạng thái:
        <b>${statusLabel}</b>
      </p>

      <h3>Thông tin đặt bàn</h3>
      <ul>
        <li>Mã đặt bàn: <b>#${reservation.id_datban}</b></li>
        <li>Ngày: <b>${fmtDateVN(reservation.ngay_dat)}</b></li>
        <li>Giờ: <b>${fmtTimeVN(reservation.gio_dat)}</b></li>
        <li>Số người: <b>${reservation.so_nguoi}</b></li>
        <li>Bàn: <b>${tableText}</b></li>
        <li>SĐT: <b>${reservation.sdt}</b></li>
        ${reservation.ghi_chu ? `<li>Ghi chú: ${reservation.ghi_chu}</li>` : ""}
      </ul>

      ${preOrderBlock}

      <p style="margin-top:14px">
        Nếu bạn cần hỗ trợ, vui lòng liên hệ LO COFFEE.
      </p>

      <p>Trân trọng,<br/>Đội ngũ LO COFFEE</p>
    </body>
  </html>
  `;
}

export const sendReservationEmail = async ({
  reservation,
  customer,
  table,
  status, // PENDING | CONFIRMED | CANCELLED | DONE | ARRIVED ...
  preOrder,
  preOrderDetails,
}) => {
  const toEmail = customer?.email;
  if (!toEmail) {
    console.warn(
      `Đặt bàn #${reservation?.id_datban} không có email khách hàng -> bỏ qua gửi mail.`
    );
    return;
  }

  const normalized = String(status || "").toUpperCase();
  const statusLabelMap = {
    PENDING: "Đã nhận yêu cầu đặt bàn",
    CONFIRMED: "Đặt bàn đã được xác nhận",
    ARRIVED: "Khách đã đến",
    DONE: "Đặt bàn đã hoàn thành",
    CANCELLED: "Đặt bàn đã bị hủy",
  };

  const statusLabel =
    statusLabelMap[normalized] || `Cập nhật đặt bàn (${normalized || "—"})`;

  const subjectPrefix =
    normalized === "CONFIRMED"
      ? "Xác nhận đặt bàn"
      : normalized === "CANCELLED"
      ? "Thông báo hủy đặt bàn"
      : "Thông tin đặt bàn";

  const mailOptions = {
    from: `"LO COFFEE" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: `${subjectPrefix} #${reservation.id_datban}`,
    html: createReservationEmailHtml({
      reservation,
      customer,
      table,
      statusLabel,
      preOrder,
      preOrderDetails,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Email đặt bàn #${reservation.id_datban} (${normalized}) đã gửi tới ${toEmail}: ${info.messageId}`
    );
  } catch (error) {
    console.error(`❌ Lỗi gửi email đặt bàn #${reservation.id_datban}:`, error);
  }
};
