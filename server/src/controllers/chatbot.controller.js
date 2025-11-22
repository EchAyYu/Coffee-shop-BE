import Groq from "groq-sdk";
import db from "../models/index.js";

const { Product, Category } = db;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Gom menu từ DB thành text gọn
function buildMenuText(products = []) {
  if (!products.length) return "Menu trống hoặc không lấy được dữ liệu.";

  const byCat = {};

  for (const p of products) {
    const catName = p.Category?.ten_dm || "Khác";
    if (!byCat[catName]) byCat[catName] = [];
    byCat[catName].push(p);
  }

  let text = "MENU hiện tại (lấy từ Database):\n";
  for (const [cat, items] of Object.entries(byCat)) {
    text += `- ${cat}:\n`;
    for (const item of items.slice(0, 5)) {
      text += `   • ${item.ten_mon} (${item.gia} VNĐ)\n`;
    }
  }

  return text;
}

export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập câu hỏi." });
    }

    // ==============================
    // 1. Lấy menu từ DB
    // ==============================
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
        limit: 40,
        order: [["id_mon", "ASC"]],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho chatbot:", err);
    }

    const menuText = buildMenuText(products);

    // ==============================
    // 2. Chuẩn bị lịch sử hội thoại (history)
    //    history FE gửi lên dạng:
    //    [{ role: "user" | "assistant", content: "..." }, ...]
    // ==============================
    let chatHistory = [];
    if (Array.isArray(history)) {
      chatHistory = history
        .filter((m) => m && m.role && m.content)
        // giới hạn tối đa 8 lượt để tránh prompt quá dài
        .slice(-8)
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));
    }

    // ==============================
    // 3. System prompt: thêm logic ĐẶT BÀN
    // ==============================
    const systemPrompt = `
Bạn là chatbot hỗ trợ khách hàng của quán LO Coffee. 
Trả lời thân thiện, ngắn gọn, bằng tiếng Việt. Xưng "mình", gọi khách là "bạn".

1. Nhiệm vụ:
- Giới thiệu quán, menu đồ uống và bánh.
- Gợi ý món phù hợp theo sở thích (ít đắng, nhiều sữa, ít ngọt, không uống được cà phê...).
- Hướng dẫn cách đặt món online, thanh toán (COD, VNPay) trên website.
- HỖ TRỢ ĐẶT BÀN (booking) qua hội thoại nhiều bước.

2. Menu thật của quán (lấy từ hệ thống):
${menuText}

3. Quy tắc khi khách muốn ĐẶT BÀN:
- Nhận diện các câu có ý nghĩa như: "mình muốn đặt bàn", "booking", "giữ chỗ", "đặt chỗ", ...
- Nếu khách muốn đặt bàn nhưng CHƯA đủ thông tin, hãy HỎI LẦN LƯỢT:
  1) Ngày (theo kiểu "ngày 21/11", "ngày mai", "thứ bảy tuần này"...)
  2) Giờ (ví dụ: 19:00)
  3) Số lượng người
  4) Tên người đặt
  5) Số điện thoại liên hệ
- Chỉ cần hỏi những thông tin còn thiếu, không hỏi lại những gì khách đã cung cấp.
- Khi đã đủ 5 thông tin trên, hãy:
  - TÓM TẮT lại đầy đủ: ngày, giờ, số người, tên, số điện thoại.
  - Hỏi khách xác nhận lần cuối kiểu: 
    "Mình ghi nhận đặt bàn lúc ... cho ... người, tên ..., số điện thoại .... Đúng vậy không?"
- Không tự khẳng định là đã ghi vào hệ thống, chỉ nói là "mình đã ghi nhận thông tin đặt bàn".
  (Phần lưu database sẽ do hệ thống xử lý sau.)

4. Quy tắc chung:
- Nếu câu hỏi không liên quan tới quán cà phê, hãy nói ngắn gọn rằng bạn chỉ hỗ trợ về menu, đặt món, đặt bàn, khuyến mãi.
- Không bịa thêm giá tiền hoặc chương trình khuyến mãi chi tiết nếu không có trong dữ liệu.
`;

    // ==============================
    // 4. Gọi Groq với history + câu mới
    // ==============================
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 512,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Xin lỗi, mình chưa hiểu ý bạn. Bạn có thể nói lại không?";

    return res.json({ reply });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi, vui lòng thử lại.",
    });
  }
};
