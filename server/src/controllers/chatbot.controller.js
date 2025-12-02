import Groq from "groq-sdk";
import db from "../models/index.js";

const { Product, Category } = db;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ==============================
// 1. Thông tin quán + FAQ cố định
// ==============================
const SHOP_INFO = {
  name: "LO Coffee",
  address: "326A Nguyễn Văn Linh, An Khánh, Ninh Kiều, Cần Thơ Vietnam",
  openHours: "6:00 - 23:00 mỗi ngày",
  phone: "0292 3943 516",
  payments:
    "Tiền mặt, chuyển khoản, ví điện tử (Momo, ZaloPay) và quét QR ngân hàng.",
  delivery:
    "Giao hàng trong bán kính 5km, phí ship tùy khoảng cách và bên vận chuyển.",
};

// Chuẩn hóa text để match keyword FAQ (bỏ dấu tiếng Việt)
function normalizeText(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Gom menu thô (theo danh mục) để AI thấy được danh sách món
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

// Phân tích menu để tạo dữ liệu gợi ý nâng cao
function buildRecommendationText(products = []) {
  if (!products.length) {
    return "Chưa có dữ liệu sản phẩm để gợi ý.";
  }

  const clone = [...products];

  // Top món bán chạy (dựa vào rating_count)
  const topByCount = clone
    .slice()
    .sort(
      (a, b) =>
        (b.rating_count || 0) - (a.rating_count || 0)
    )
    .filter((p) => (p.rating_count || 0) > 0)
    .slice(0, 5);

  // Top món được đánh giá cao (rating_avg, ưu tiên món có nhiều rating)
  const topByRating = clone
    .slice()
    .filter((p) => (p.rating_avg || 0) > 0)
    .sort((a, b) => {
      const rDiff = (b.rating_avg || 0) - (a.rating_avg || 0);
      if (Math.abs(rDiff) > 0.01) return rDiff;
      return (b.rating_count || 0) - (a.rating_count || 0);
    })
    .slice(0, 5);

  const caffeineFree = [];
  const dairyFree = [];

  for (const p of products) {
    const name = (p.ten_mon || "").toLowerCase();
    const desc = (p.mo_ta || "").toLowerCase();
    const cat = (p.Category?.ten_dm || "").toLowerCase();

    const isTeaLike =
      cat.includes("trà") ||
      cat.includes("tea") ||
      cat.includes("soda") ||
      cat.includes("nước ép") ||
      cat.includes("nuoc ep") ||
      cat.includes("sinh tố") ||
      cat.includes("sinh to") ||
      name.includes("trà") ||
      name.includes("tea") ||
      name.includes("soda") ||
      name.includes("nước ép") ||
      name.includes("nuoc ep") ||
      name.includes("sinh tố") ||
      name.includes("sinh to");

    const hasCoffeeWord =
      name.includes("cà phê") ||
      name.includes("ca phe") ||
      name.includes("espresso") ||
      name.includes("latte") ||
      name.includes("americano") ||
      cat.includes("cà phê") ||
      cat.includes("ca phe");

    const hasMilkWord =
      name.includes("sữa") ||
      name.includes("sua") ||
      name.includes("milk") ||
      desc.includes("sữa") ||
      desc.includes("sua") ||
      desc.includes("milk") ||
      cat.includes("trà sữa");

    // Nhóm gợi ý ít cafeine / không cafeine
    if (isTeaLike && !hasCoffeeWord) {
      caffeineFree.push(p);
    }

    // Nhóm gợi ý ít/không sữa
    if (!hasMilkWord) {
      dairyFree.push(p);
    }
  }

  const pickNames = (arr, limit = 5) =>
    arr
      .slice(0, limit)
      .map((p) => `• ${p.ten_mon} (${p.gia} VNĐ)`)
      .join("\n");

  let text = "DỮ LIỆU GỢI Ý MÓN (từ hệ thống):\n";

  if (topByCount.length) {
    text += "\n1) Một số món bán chạy (nhiều lượt đánh giá / mua):\n";
    text += pickNames(topByCount) + "\n";
  }

  if (topByRating.length) {
    text += "\n2) Một số món được đánh giá cao:\n";
    text += pickNames(topByRating) + "\n";
  }

  if (caffeineFree.length) {
    text +=
      "\n3) Gợi ý món ÍT CAFEINE / KHÔNG CAFEINE (ưu tiên trà, nước ép, sinh tố...):\n";
    text += pickNames(caffeineFree) + "\n";
  }

  if (dairyFree.length) {
    text +=
      "\n4) Gợi ý món ÍT SỮA / KHÔNG SỮA (lọc các món không có 'sữa', 'milk'):\n";
    text += pickNames(dairyFree) + "\n";
  }

  return text;
}

// Một số rule FAQ cơ bản
const faqRules = [
  {
    id: "open_hours",
    keywords: [
      "gio mo cua",
      "mấy giờ mở cửa",
      "may gio mo cua",
      "gio dong cua",
      "mo cua luc nao",
    ],
    answer: () =>
      `Quán ${SHOP_INFO.name} mở cửa từ ${SHOP_INFO.openHours}. Nếu bạn cần giữ bàn giờ cụ thể, cứ nói mình biết nhé!`,
  },
  {
    id: "address",
    keywords: [
      "dia chi",
      "địa chỉ quán",
      "dia chi quan",
      "ở đâu",
      "o dau",
    ],
    answer: () =>
      `Hiện tại quán ${SHOP_INFO.name} ở: ${SHOP_INFO.address}. Nếu cần chỉ đường chi tiết, bạn có thể xem thêm ở trang Liên hệ trên website nha.`,
  },
  {
    id: "phone",
    keywords: ["so dien thoai", "sdt", "hotline", "liên hệ", "lien he"],
    answer: () =>
      `Hotline của quán là: ${SHOP_INFO.phone}. Bạn có thể gọi trực tiếp nếu cần hỗ trợ gấp hoặc xác nhận đơn/đặt bàn.`,
  },
  {
    id: "payment",
    keywords: [
      "thanh toan",
      "tra tien",
      "payment",
      "hinh thuc thanh toan",
      "nhan nhung hinh thuc thanh toan nao",
    ],
    answer: () =>
      `Hiện tại quán hỗ trợ: ${SHOP_INFO.payments}. Khi đặt món online, bạn có thể chọn thanh toán khi nhận hàng hoặc quét QR.`,
  },
  {
    id: "promotion",
    keywords: [
      "khuyen mai",
      "giam gia",
      "uu dai",
      "voucher",
      "ma giam gia",
    ],
    answer: () =>
      "Khuyến mãi thường xuyên được cập nhật trên website mục Khuyến mãi / Vouchers. Hiện tại bạn có thể vào trang đó để xem chi tiết các chương trình đang áp dụng nhé! Mình không tự tạo thêm chương trình ngoài hệ thống.",
  },
];

// ==============================
// 2. Controller chính
// ==============================
export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập câu hỏi." });
    }

    const normalized = normalizeText(message);

    // 2.1. Thử match FAQ trước (không cần gọi AI)
    for (const rule of faqRules) {
      const hit = rule.keywords.some((kw) => normalized.includes(kw));
      if (hit) {
        const reply = rule.answer();
        return res.json({ reply });
      }
    }

    // 2.2. Lấy menu đầy đủ từ DB cho AI tham khảo
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho chatbot:", err);
    }

    const menuText = buildMenuText(products);
    const recommendationText = buildRecommendationText(products);

    // 2.3. Chuẩn bị history từ FE
    let chatHistory = [];
    if (Array.isArray(history)) {
      chatHistory = history
        .filter((m) => m && m.role && m.content)
        .slice(-8)
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content).slice(0, 1000),
        }));
    }

    // 2.4. System prompt – FAQ + gợi ý món + ĐẶT BÀN + JSON
    const systemPrompt = `
Bạn là chatbot hỗ trợ khách hàng của quán ${SHOP_INFO.name}.
Trả lời thân thiện, ngắn gọn, bằng tiếng Việt. Xưng "mình", gọi khách là "bạn".

1. Thông tin cơ bản của quán:
- Địa chỉ: ${SHOP_INFO.address}
- Giờ mở cửa: ${SHOP_INFO.openHours}
- Số điện thoại: ${SHOP_INFO.phone}
- Thanh toán: ${SHOP_INFO.payments}
- Giao hàng: ${SHOP_INFO.delivery}

2. Menu thật của quán (lấy từ hệ thống):
${menuText}

3. Dữ liệu gợi ý món nâng cao (bán chạy, được đánh giá cao, ít cafeine, ít sữa):
${recommendationText}

4. Nhiệm vụ chính:
- Giới thiệu quán, menu đồ uống và bánh.
- Tư vấn, gợi ý đồ uống DỰA TRÊN DANH SÁCH MÓN TRONG DỮ LIỆU, đặc biệt:
  • Khi khách hỏi "món nào bán chạy", "gợi ý đồ uống phổ biến":
      -> Ưu tiên dùng danh sách "món bán chạy" và "được đánh giá cao".
  • Khi khách nói "ít cafeine", "không uống được cà phê":
      -> Ưu tiên dùng các món trong nhóm "ít cafeine / không cafeine".
  • Khi khách nói "không uống được sữa", "dị ứng sữa":
      -> Ưu tiên các món trong nhóm "ít sữa / không sữa".
  • Khi gợi ý, hãy đưa 2–4 món phù hợp, kèm mô tả ngắn theo thông tin có sẵn (tên và giá).
- Hướng dẫn cách đặt món online, thanh toán trên website.
- Hỗ trợ khách ĐẶT BÀN (booking) theo hội thoại nhiều bước:
  - Nhận diện khi khách muốn đặt bàn (các câu như: "mình muốn đặt bàn", "đặt chỗ", "booking", "giữ bàn", ...).
  - Hỏi lần lượt những thông tin còn thiếu:
    1) Ngày (date) - định dạng cuối cùng cần là YYYY-MM-DD
    2) Giờ (time) - định dạng cuối cùng cần là HH:mm (24h)
    3) Số lượng người (people)
    4) Tên người đặt (name)
    5) Số điện thoại liên hệ (phone)
    6) Ghi chú thêm (note) – có thể để trống
  - Không hỏi lại thông tin khách đã cung cấp rõ ràng.
  - Khi đã có đủ các trường trên:
    • Trả lời tự nhiên rằng bạn đã ghi nhận thông tin và sẽ gửi cho hệ thống xử lý.
    • ĐỒNG THỜI, ở cuối câu trả lời, hãy thêm một khối JSON ĐÚNG CẤU TRÚC, chỉ chứa các field:
      {
        "name": "...",
        "phone": "...",
        "date": "YYYY-MM-DD",
        "time": "HH:mm",
        "people": 2,
        "note": "..."
      }
      và BỌC JSON bằng tag:
      <RESERVATION_JSON> ... </RESERVATION_JSON>
    • Không giải thích gì thêm bên trong tag, chỉ để JSON thuần.

5. Quy tắc chung:
- Chỉ sử dụng các món có trong dữ liệu (menuText, recommendationText). Không bịa ra món hoàn toàn mới.
- Nếu câu hỏi không liên quan tới quán cà phê, hãy nói ngắn gọn rằng bạn chỉ hỗ trợ về menu, đặt món, đặt bàn, khuyến mãi.
- Không bịa thêm giá tiền hoặc chương trình khuyến mãi chi tiết nếu không có trong dữ liệu.
- Luôn thân thiện, không sử dụng ngôn ngữ tục tĩu.
`;

    // 2.5. Gọi Groq
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: message },
      ],
      temperature: 0.5,
      max_tokens: 512,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Xin lỗi, mình chưa hiểu ý bạn. Bạn có thể nói lại không?";

    // 2.6. Tìm JSON đặt bàn (nếu có)
    let reservationData = null;
    const match = reply.match(
      /<RESERVATION_JSON>([\s\S]+?)<\/RESERVATION_JSON>/
    );

    if (match) {
      const jsonStr = match[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === "object") {
          reservationData = {
            name: String(parsed.name || "").slice(0, 100),
            phone: String(parsed.phone || "").slice(0, 20),
            date: String(parsed.date || "").slice(0, 10),
            time: String(parsed.time || "").slice(0, 5),
            people: Number(parsed.people) || 1,
            note: parsed.note ? String(parsed.note).slice(0, 255) : "",
          };
        }
      } catch (e) {
        console.warn("Không parse được RESERVATION_JSON:", e);
      }

      // Xoá block JSON khỏi reply hiển thị cho user
      reply = reply.replace(match[0], "").trim();
    }

    return res.json({ reply, reservationData });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi, vui lòng thử lại.",
    });
  }
};

