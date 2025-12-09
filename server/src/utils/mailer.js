import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(); // Đảm bảo biến môi trường được load

// Cấu hình transporter (Lấy từ .env)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: String(process.env.MAIL_SECURE) === "true" || Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production",
  },
});


// Hàm tạo nội dung email HTML (ví dụ)
function createOrderConfirmationHtml(order, orderDetails) {
  const itemsHtml = orderDetails.map(item => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.Product?.ten_mon || 'Sản phẩm'}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.so_luong}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(item.gia).toLocaleString('vi-VN')} ₫</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(Number(item.gia) * item.so_luong).toLocaleString('vi-VN')} ₫</td>
    </tr>
  `).join('');

  const paymentInfo = order.pttt === 'BANK_TRANSFER' ? `
    <p>Vui lòng chuyển khoản ${Number(order.tong_tien).toLocaleString('vi-VN')} ₫ vào tài khoản sau:</p>
    <ul>
      <li>Ngân hàng: <strong>[TÊN NGÂN HÀNG CỦA BẠN]</strong></li>
      <li>Số tài khoản: <strong>[SỐ TÀI KHOẢN CỦA BẠN]</strong></li>
      <li>Chủ tài khoản: <strong>[TÊN CHỦ TÀI KHOẢN]</strong></li>
      <li>Nội dung chuyển khoản: <strong>TT DH ${order.id_don}</strong></li>
    </ul>
    <p>Đơn hàng sẽ được xử lý sau khi chúng tôi nhận được thanh toán.</p>
    <img src="[LINK ĐẾN ẢNH QR CODE CỦA BẠN]" alt="QR Code Thanh toán" style="max-width: 150px; margin-top: 10px;">
  ` : `<p>Bạn đã chọn thanh toán bằng tiền mặt khi nhận hàng (COD).</p>`;

  return `
    <html>
      <body style="font-family: sans-serif; line-height: 1.6;">
        <h2>Chào ${order.ho_ten_nhan},</h2>
        <p>Cảm ơn bạn đã đặt hàng tại LO COFFEE! Đơn hàng #${order.id_don} của bạn đã được ghi nhận.</p>
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
              <td style="padding: 8px; text-align: right;"><strong>${Number(order.tong_tien).toLocaleString('vi-VN')} ₫</strong></td>
            </tr>
          </tfoot>
        </table>
        <h3>Thông tin nhận hàng:</h3>
        <ul>
          <li>Người nhận: ${order.ho_ten_nhan}</li>
          <li>Số điện thoại: ${order.sdt_nhan}</li>
          <li>Địa chỉ: ${order.dia_chi_nhan}</li>
          ${order.ghi_chu ? `<li>Ghi chú: ${order.ghi_chu}</li>` : ''}
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
  if (!order.email_nhan) {
    console.warn(`Đơn hàng #${order.id_don} không có email người nhận, không thể gửi mail.`);
    return;
  }

  const mailOptions = {
    from: `"LO COFFEE" <${process.env.MAIL_USER}>`, // Tên người gửi và địa chỉ email
    to: order.email_nhan,                       // Email người nhận
    subject: `Xác nhận đơn hàng LO COFFEE #${order.id_don}`, // Tiêu đề email
    html: createOrderConfirmationHtml(order, orderDetails), // Nội dung HTML
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email xác nhận đơn hàng #${order.id_don} đã gửi tới ${order.email_nhan}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Lỗi gửi email cho đơn hàng #${order.id_don}:`, error);
    // Bạn có thể thêm xử lý lỗi ở đây, ví dụ: lưu lại để gửi sau
  }
};
