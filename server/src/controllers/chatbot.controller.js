// server/src/controllers/chatbot.controller.js
import Groq from "groq-sdk";
import { Op } from "sequelize";
import db from "../models/index.js";
import Voucher from "../models/Voucher.js"; // dùng giống voucher.controller

const { Product, Category, Promotion, PromotionProduct } = db;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ==============================
// 1. Thông tin quán + helper
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

function normalizeReservationDate(raw) {
  if (!raw) return "";

  const s = String(raw).trim().toLowerCase();
  const today = new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if (s === "hôm nay" || s === "hom nay" || s === "today") {
    return today.toISOString().slice(0, 10);
  }

  if (s === "ngày mai" || s === "ngay mai" || s === "mai") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return "";
}

function normalizeText(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapOrderJsonToItems(jsonStr, products) {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
    if (!rawItems.length || !Array.isArray(products) || !products.length) {
      return null;
    }

    const mapped = [];

    for (const it of rawItems) {
      const rawName = String(it.name || it.product_name || "").trim();
      if (!rawName) continue;
      const qty = Number(it.quantity) || 1;
      const target = rawName.toLowerCase();

      let product =
        products.find(
          (p) => (p.ten_mon || "").toLowerCase() === target
        ) ||
        products.find((p) =>
          (p.ten_mon || "").toLowerCase().includes(target)
        ) ||
        products.find((p) =>
          target.includes((p.ten_mon || "").toLowerCase())
        );

      if (product) {
        mapped.push({
          id_mon: product.id_mon,
          ten_mon: product.ten_mon,
          gia: product.gia,
          anh: product.anh || product.hinh_anh || null,
          quantity: qty,
        });
      }
    }

    return mapped.length ? mapped : null;
  } catch (e) {
    console.warn("Không parse được ORDER_JSON:", e);
    return null;
  }
}

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
    for (const item of items.slice(0, 20)) {
      text += `   • ${item.ten_mon} (${item.gia} VNĐ)${
        item.mo_ta ? ` – ${item.mo_ta}` : ""
      }\n`;
    }
  }
  return text;
}

function buildRecommendationText(products = []) {
  if (!products.length) {
    return "Chưa có dữ liệu sản phẩm để gợi ý.";
  }

  const clone = [...products];

  const topByCount = clone
    .slice()
    .sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0))
    .filter((p) => (p.rating_count || 0) > 0)
    .slice(0, 8);

  const topByRating = clone
    .slice()
    .filter((p) => (p.rating_avg || 0) > 0)
    .sort((a, b) => {
      const rDiff = (b.rating_avg || 0) - (a.rating_avg || 0);
      if (Math.abs(rDiff) > 0.01) return rDiff;
      return (b.rating_count || 0) - (a.rating_count || 0);
    })
    .slice(0, 8);

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

    if (isTeaLike && !hasCoffeeWord) {
      caffeineFree.push(p);
    }
    if (!hasMilkWord) {
      dairyFree.push(p);
    }
  }

  const pickNames = (arr, limit = 6) =>
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
      "\n3) Gợi ý món ÍT CAFEINE / KHÔNG CAFEINE (trà, nước ép, sinh tố...):\n";
    text += pickNames(caffeineFree) + "\n";
  }

  if (dairyFree.length) {
    text +=
      "\n4) Gợi ý món ÍT SỮA / KHÔNG SỮA (lọc các món không có 'sữa', 'milk'):\n";
    text += pickNames(dairyFree) + "\n";
  }

  const combos = [
    {
      name: "Combo sáng tỉnh táo",
      items: ["Cà phê sữa đá", "Bánh flan"],
    },
    {
      name: "Combo trà trái cây thư giãn",
      items: ["Trà đào cam sả", "Bánh bông lan trứng muối"],
    },
  ];

  if (combos.length) {
    text += "\n5) Một vài combo gợi ý:\n";
    for (const c of combos) {
      text += `• ${c.name}: ${c.items.join(" + ")}\n`;
    }
  }

  return text;
}

// ===== Khuyến mãi từ DB =====
async function getActivePromotions() {
  const now = new Date();

  const promos = await Promotion.findAll({
    where: {
      hien_thi: true,
      ngay_bd: { [Op.lte]: now },
      ngay_kt: { [Op.gte]: now },
    },
    include: [
      {
        model: PromotionProduct,
        as: "PromotionProducts",
        attributes: ["id_mon"],
      },
    ],
    order: [["ngay_bd", "ASC"]],
  });

  return promos;
}

function formatDate(d) {
  try {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

function describePromoTarget(promo) {
  if (!promo) return "";

  const tt = promo.target_type || "ALL";

  if (tt === "ALL") {
    return "Áp dụng cho hầu hết menu (theo điều kiện kèm theo).";
  }
  if (tt === "CATEGORY") {
    return "Áp dụng cho một nhóm món cụ thể (theo danh mục).";
  }
  if (tt === "PRODUCT") {
    const count = Array.isArray(promo.PromotionProducts)
      ? promo.PromotionProducts.length
      : 0;
    if (count === 0) return "Áp dụng cho một số món cụ thể.";
    if (count === 1) return "Áp dụng cho 1 món cụ thể.";
    return `Áp dụng cho khoảng ${count} món cụ thể.`;
  }

  return "Áp dụng theo điều kiện của chương trình.";
}

function buildPromotionsText(promos = []) {
  if (!promos.length) {
    return "Hiện tại trong hệ thống chưa có chương trình khuyến mãi nào đang chạy.";
  }

  let text = "Các chương trình khuyến mãi đang áp dụng (lấy từ Database):\n";

  promos.slice(0, 5).forEach((p, idx) => {
    const from = formatDate(p.ngay_bd);
    const to = formatDate(p.ngay_kt);
    const timeRange =
      p.gio_bd && p.gio_kt ? `, khung giờ ${p.gio_bd}–${p.gio_kt}` : "";

    text += `\n${idx + 1}) ${p.ten_km}\n`;
    if (p.mo_ta) {
      text += `   • Mô tả: ${p.mo_ta}\n`;
    }
    text += `   • Thời gian: từ ${from} đến ${to}${timeRange}\n`;
    text += `   • Phạm vi: ${describePromoTarget(p)}\n`;

    if (p.button_text && p.button_link) {
      text += `   • Chi tiết: ${p.button_text} (link: ${p.button_link})\n`;
    }
  });

  return text;
}

// ===== Voucher từ DB (đổi điểm) =====
// lấy tương tự listCatalog trong voucher.controller, nhưng đơn giản hơn một chút :contentReference[oaicite:2]{index=2}
async function getActiveRewardVouchers() {
  const now = new Date();

  const vouchers = await Voucher.findAll({
    where: {
      active: true,
      points_cost: { [Op.gt]: 0 }, // chỉ voucher đổi điểm
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
    },
    order: [["created_at", "DESC"]],
  });

  return vouchers;
}

function describeVoucherDiscount(v) {
  if (!v) return "";
  const type = v.discount_type;
  const val = Number(v.discount_value || 0);
  if (type === "percent") {
    return `${val}% trên tổng giá trị đơn hàng`;
  }
  if (type === "fixed") {
    return `${val.toLocaleString("vi-VN")}₫ trực tiếp vào đơn`;
  }
  return "giảm giá theo thiết lập của voucher";
}

function buildVoucherText(vouchers = []) {
  if (!vouchers.length) {
    return (
      "Hiện tại trong hệ thống chưa có voucher đổi điểm nào đang mở. " +
      "Bạn vẫn có thể tích điểm từ các đơn hàng để đổi voucher khi có chương trình mới nhé!"
    );
  }

  let text = "Các voucher đổi điểm đang mở (dùng điểm tích luỹ để đổi):\n";

  vouchers.slice(0, 6).forEach((v, idx) => {
    const expires = v.expires_at ? formatDate(v.expires_at) : "Không giới hạn";
    const minOrder = v.min_order
      ? `${Number(v.min_order).toLocaleString("vi-VN")}₫`
      : "Không yêu cầu";
    const maxDiscount = v.max_discount
      ? `${Number(v.max_discount).toLocaleString("vi-VN")}₫`
      : "Theo giá trị giảm";

    text += `\n${idx + 1}) ${v.name}\n`;
    if (v.description) {
      text += `   • Mô tả: ${v.description}\n`;
    }
    text += `   • Đổi bằng: ${v.points_cost} điểm\n`;
    text += `   • Ưu đãi: ${describeVoucherDiscount(v)} (tối đa ${maxDiscount})\n`;
    text += `   • Điều kiện: đơn tối thiểu ${minOrder}\n`;
    text += `   • Hạn dùng: ${expires}\n`;
  });

  text +=
    "\nLưu ý: Voucher dùng khi thanh toán, mỗi lần chỉ áp dụng 1 mã, " +
    "và không áp dụng cho đơn hàng đang có sản phẩm khuyến mãi.";

  return text;
}

// ===== System prompt chung =====
function buildSystemPrompt(
  menuText,
  recommendationText,
  promotionsText,
  voucherText
) {
  return `
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

4. Thông tin các chương trình khuyến mãi đang chạy (lấy trực tiếp từ Database):
${promotionsText}

5. Thông tin các voucher đổi điểm đang mở (lấy trực tiếp từ Database):
${voucherText}

6. Quy tắc dùng voucher (dựa trên hệ thống):
- Voucher chỉ dùng được nếu đơn hàng KHÔNG có sản phẩm đang khuyến mãi.
- Mỗi lần thanh toán chỉ áp dụng 1 mã voucher.
- Đơn hàng phải đạt giá trị tối thiểu (min_order) của voucher nếu có.
- Mỗi voucher có thể có mức giảm tối đa (max_discount); không được vượt quá.
- Nếu không thấy voucher phù hợp trong dữ liệu, phải nói là hiện tại hệ thống không ghi nhận.

7. Nhiệm vụ chính:
- Giới thiệu quán, menu đồ uống và bánh.
- Tư vấn, gợi ý đồ uống DỰA TRÊN DANH SÁCH MÓN TRONG DỮ LIỆU.
- Khi khách hỏi "món nào bán chạy", "gợi ý đồ uống phổ biến":
  → Ưu tiên dùng danh sách "món bán chạy" và "được đánh giá cao".
- Khi khách nói "ít cafeine", "không uống được cà phê":
  → Ưu tiên dùng các món trong nhóm "ít cafeine / không cafeine".
- Khi khách nói "không uống được sữa", "dị ứng sữa":
  → Ưu tiên các món trong nhóm "ít sữa / không sữa".
- Khi gợi ý, hãy đưa 2–4 món phù hợp, kèm mô tả cực ngắn (tên và giá).

8. Khi khách hỏi về khuyến mãi / giảm giá:
- Sử dụng thông tin khuyến mãi đã cung cấp. Không bịa ra chương trình mới.
- Có thể gợi ý món phù hợp với các chương trình đó.

9. Khi khách hỏi về voucher / đổi điểm / mã giảm giá:
- Giải thích dựa trên dữ liệu voucher đang mở và quy tắc dùng voucher.
- Nếu cần, hướng khách vào mục "Đổi thưởng / Voucher" hoặc "Ví voucher" trên website/app.
- Không hứa tặng voucher nếu hệ thống không có.

10. Hỗ trợ khách ĐẶT BÀN (booking) theo hội thoại nhiều bước:
- Nhận diện khi khách muốn đặt bàn.
- Hỏi lần lượt các thông tin còn thiếu: ngày, giờ, số người, tên, số điện thoại, ghi chú.
- Không hỏi lại thông tin khách đã cung cấp rõ.
- Khi đủ thông tin, trả lời tự nhiên và ĐỒNG THỜI thêm JSON ở cuối, dạng:
  <RESERVATION_JSON>
  {
    "name": "...",
    "phone": "...",
    "date": "YYYY-MM-DD",
    "time": "HH:mm",
    "people": 2,
    "note": "..."
  }
  </RESERVATION_JSON>
- Không giải thích gì bên trong tag, chỉ để JSON thuần.

11. Hỗ trợ khách ĐẶT MÓN NHANH / THÊM VÀO GIỎ HÀNG:
- Khi khách nói các câu như:
  • "Cho mình 2 ly Trà đào cam sả và 1 ly Cà phê sữa đá"
  • "Mình lấy món số 1 và số 3 bạn vừa gợi ý"
  • "Chốt cho mình 1 ly matcha đá xay size lớn"
- Dùng ĐÚNG tên món trong menu (từ dữ liệu ở trên), không bịa thêm món mới.
- Ở cuối câu trả lời, nếu khách THỰC SỰ muốn đặt món, hãy thêm một khối JSON với cấu trúc:
  <ORDER_JSON>
  {
    "items": [
      { "name": "Trà đào cam sả", "quantity": 2 },
      { "name": "Cà phê sữa đá", "quantity": 1 }
    ]
  }
  </ORDER_JSON>
- Không giải thích gì bên trong tag, chỉ JSON thuần.
- Nếu khách chỉ hỏi gợi ý tham khảo, CHƯA chốt đặt, thì KHÔNG sinh ORDER_JSON.

12. Với các câu hỏi từ HÌNH ẢNH:
- Mục tiêu:
  1) Mô tả nội dung hình (loại đồ uống/bánh, màu sắc, topping, cảm giác hương vị).
  2) Đoán xem đó là loại đồ uống/bánh gì.
  3) ĐỐI CHIẾU với danh sách món trong menu:
     - Nếu tìm được món tương tự hoặc gần giống:
       • Nêu RÕ tên món trong menu và giá.
       • Nói kiểu: "Hình này khá giống với món X trong menu quán, giá Y VNĐ."
     - Nếu KHÔNG có món tương đương:
       • Nói rõ: quán hiện KHÔNG có món y hệt trong hình.
       • Gợi ý 2–4 món trong menu có phong cách/hương vị TƯƠNG TỰ nhất.
- KHÔNG được bịa tên món mới ngoài danh sách menu.
- Nếu khách nói rõ muốn ĐẶT MÓN dựa trên hình (ví dụ: "cho mình 2 ly giống trong hình",
  "đặt giúp mình ly này", "order 1 ly như hình"):
  • Hãy chọn MỘT món trong menu là tương đương nhất với đồ uống trong hình.
  • Ở CUỐI câu trả lời, sinh thêm khối JSON:
    <ORDER_JSON>
    {
      "items": [
        { "name": "[Tên món trong menu]", "quantity": SỐ_LƯỢNG }
      ]
    }
    </ORDER_JSON>
  • Chỉ sinh ORDER_JSON khi khách CHỐT muốn đặt, không chỉ hỏi tham khảo.

13. Quy tắc chung:
- Chỉ sử dụng các món có trong dữ liệu (menuText, recommendationText). Không bịa món không tồn tại.
- Chỉ nói về khuyến mãi và voucher dựa trên dữ liệu được cung cấp. Nếu không thấy chương trình tương ứng, hãy nói rõ không có.
- Nếu câu hỏi không liên quan tới quán cà phê, hãy nói ngắn gọn rằng bạn chỉ hỗ trợ về menu, đặt món, đặt bàn, khuyến mãi, voucher.
- Luôn thân thiện, không sử dụng ngôn ngữ tục tĩu.
`;
}

// FAQ cơ bản
const faqRules = [
  {
    id: "open_hours",
    keywords: [
      "gio mo cua",
      "may gio mo cua",
      "gio dong cua",
      "mo cua luc nao",
    ],
    answer: () =>
      `Quán ${SHOP_INFO.name} mở cửa từ ${SHOP_INFO.openHours}. Nếu bạn cần giữ bàn giờ cụ thể, cứ nói mình biết nhé!`,
  },
  {
    id: "address",
    keywords: ["dia chi", "dia chi quan", "o dau"],
    answer: () =>
      `Hiện tại quán ${SHOP_INFO.name} ở: ${SHOP_INFO.address}. Nếu cần chỉ đường chi tiết, bạn có thể xem thêm ở trang Liên hệ trên website nha.`,
  },
  {
    id: "phone",
    keywords: ["so dien thoai", "sdt", "hotline", "lien he"],
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
];

// Từ khóa (đã bỏ dấu để khớp với normalizeText)
const PROMOTION_KEYWORDS = [
  "khuyen mai",
  "giam gia",
  "uu dai",
];

const VOUCHER_KEYWORDS = [
  "voucher",
  "ma giam gia",
  "doi diem",
  "tich diem",
  "diem tich luy",
  "doi voucher",
];

// ==============================
// 2. Chat TEXT
// ==============================
export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập câu hỏi." });
    }

    const normalized = normalizeText(message);

    // 2.0. Nếu khách hỏi rõ về voucher → trả lời trực tiếp từ DB voucher
    const isVoucherIntent = VOUCHER_KEYWORDS.some((kw) =>
      normalized.includes(kw)
    );

    if (isVoucherIntent) {
      try {
        const vouchers = await getActiveRewardVouchers();
        if (!vouchers.length) {
          const reply =
            "Mình vừa kiểm tra trong hệ thống thì hiện tại chưa có voucher đổi điểm nào đang mở. " +
            "Bạn vẫn có thể tích điểm từ các đơn hàng để đổi voucher khi có chương trình mới nhé!";
          return res.json({ reply });
        }

        const voucherText = buildVoucherText(vouchers);
        const reply =
          "Mình kiểm tra trong hệ thống thì hiện tại có một số voucher đổi điểm như sau:\n\n" +
          voucherText +
          "\n\nĐể sử dụng, bạn đăng nhập tài khoản, vào mục 'Đổi thưởng' hoặc 'Ví voucher' để đổi và áp dụng khi thanh toán nhé.";

        return res.json({ reply });
      } catch (e) {
        console.error("Lỗi lấy voucher cho chatbot:", e);
        const reply =
          "Hiện hệ thống voucher đang bị lỗi nên mình chưa xem được danh sách. " +
          "Bạn giúp mình thử lại sau chút nhé hoặc xem trực tiếp ở mục Voucher trên website.";
        return res.json({ reply });
      }
    }

    // 2.0b. Khách hỏi khuyến mãi (không nhất thiết nói voucher)
    const isPromotionIntent = PROMOTION_KEYWORDS.some((kw) =>
      normalized.includes(kw)
    );

    if (isPromotionIntent) {
      try {
        const promos = await getActivePromotions();
        const vouchers = await getActiveRewardVouchers();

        if (!promos.length && !vouchers.length) {
          const reply =
            "Mình vừa kiểm tra trong hệ thống thì hiện tại quán chưa có chương trình khuyến mãi hay voucher nào đang chạy. " +
            "Bạn vẫn có thể hỏi mình về menu hoặc gợi ý đồ uống phù hợp với sở thích của bạn nhé!";
          return res.json({ reply });
        }

        const promoText = buildPromotionsText(promos);
        const voucherText = buildVoucherText(vouchers);

        let reply = "Mình vừa xem trong hệ thống, hiện tại có:\n\n";

        if (promos.length) {
          reply += promoText + "\n\n";
        } else {
          reply +=
            "- Chưa có chương trình khuyến mãi trực tiếp nào đang chạy.\n\n";
        }

        if (vouchers.length) {
          reply += voucherText + "\n\n";
        } else {
          reply +=
            "- Chưa có voucher đổi điểm nào đang mở, bạn vẫn có thể tích điểm để đổi sau nhé.\n\n";
        }

        reply +=
          "Nếu bạn muốn mình gợi ý món phù hợp với một chương trình cụ thể, bạn cứ nói rõ giúp mình nhé!";

        return res.json({ reply });
      } catch (e) {
        console.error("Lỗi lấy khuyến mãi + voucher cho chatbot:", e);
        const reply =
          "Hiện hệ thống khuyến mãi/voucher đang bị lỗi nên mình chưa xem được chương trình đang chạy. " +
          "Bạn giúp mình thử lại sau hoặc xem trực tiếp ở mục Khuyến mãi / Voucher trên website nha.";
        return res.json({ reply });
      }
    }

    // 2.1. Thử match FAQ
    for (const rule of faqRules) {
      const hit = rule.keywords.some((kw) => normalized.includes(kw));
      if (hit) {
        const reply = rule.answer();
        return res.json({ reply });
      }
    }

    // 2.2. Lấy menu đầy đủ từ DB
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho chatbot:", err);
    }

    // 2.2.b. Lấy khuyến mãi & voucher từ DB cho system prompt
    let promotions = [];
    let vouchers = [];
    try {
      promotions = await getActivePromotions();
    } catch (err) {
      console.error("Lỗi lấy khuyến mãi cho system prompt chatbot:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher cho system prompt chatbot:", err);
    }

    const menuText = buildMenuText(products);
    const recommendationText = buildRecommendationText(products);
    const promotionsText = buildPromotionsText(promotions);
    const voucherText = buildVoucherText(vouchers);
    const systemPrompt = buildSystemPrompt(
      menuText,
      recommendationText,
      promotionsText,
      voucherText
    );

    // 2.3. Chuẩn bị history
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

    // 2.4. Gọi Groq
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

    // 2.5. RESERVATION_JSON
    let reservationData = null;
    const match = reply.match(
      /<RESERVATION_JSON>([\s\S]+?)<\/RESERVATION_JSON>/
    );

    if (match) {
      const jsonStr = match[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === "object") {
          const rawDate = parsed.date || "";
          const normalizedDate = normalizeReservationDate(rawDate);

          reservationData = {
            name: String(parsed.name || "").slice(0, 100),
            phone: String(parsed.phone || "").slice(0, 20),
            date: normalizedDate,
            time: String(parsed.time || "").slice(0, 5),
            people: Number(parsed.people) || 1,
            note: parsed.note ? String(parsed.note).slice(0, 255) : "",
          };
        }
      } catch (e) {
        console.warn("Không parse được RESERVATION_JSON:", e);
      }

      reply = reply.replace(match[0], "").trim();
    }

    // 2.6. ORDER_JSON
    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);

    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    return res.json({ reply, reservationData, orderItems });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi, vui lòng thử lại.",
    });
  }
};

// ==============================
// 3. Chat bằng HÌNH ẢNH
// ==============================
export const handleChatbotImageMessage = async (req, res) => {
  try {
    const { history } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Vui lòng gửi kèm hình ảnh." });
    }

    // Lấy menu từ DB cho mode ảnh
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho image chatbot:", err);
    }

    // Lấy khuyến mãi & voucher cho mode ảnh
    let promotions = [];
    let vouchers = [];
    try {
      promotions = await getActivePromotions();
    } catch (err) {
      console.error("Lỗi lấy khuyến mãi cho image chatbot:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher cho image chatbot:", err);
    }

    const menuText = buildMenuText(products);
    const recommendationText = buildRecommendationText(products);
    const promotionsText = buildPromotionsText(promotions);
    const voucherText = buildVoucherText(vouchers);
    const systemPrompt = buildSystemPrompt(
      menuText,
      recommendationText,
      promotionsText,
      voucherText
    );

    // Parse history từ FE
    let chatHistory = [];
    if (history) {
      try {
        const parsed =
          typeof history === "string" ? JSON.parse(history) : history;

        if (Array.isArray(parsed)) {
          chatHistory = parsed.slice(-8).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 1000),
          }));
        }
      } catch (e) {
        console.warn("Không parse được history cho image chat:", e);
      }
    }

    const base64Image = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64Image}`;

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Hãy phân tích hình ảnh này theo từng bước:\n" +
                "1) Mô tả ngắn gọn hình ảnh (loại đồ uống/bánh, màu sắc, topping, cảm giác hương vị).\n" +
                "2) Đoán xem đây là loại đồ uống/bánh gì.\n" +
                "3) ĐỐI CHIẾU với menu ở trên:\n" +
                '   - Nếu có món tương đương trong menu, hãy ghi rõ: "Trong menu quán, món này giống với [TÊN MÓN] (GIÁ VND)".\n' +
                "   - Nếu không có món y hệt, hãy nói rõ quán không có món chính xác như vậy và gợi ý 2–4 món trong menu có hương vị/phong cách tương tự.\n" +
                "4) Tất cả tên món và giá phải lấy từ danh sách menu, không bịa thêm món mới.\n" +
                "5) Nếu khách có hỏi về khuyến mãi hoặc voucher, hãy dùng đúng các chương trình trong dữ liệu đã được cung cấp, không bịa thêm.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.6,
      max_tokens: 512,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Mình chưa đọc được hình này, bạn thử gửi lại giúp mình nhé.";

    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);

    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    return res.json({ reply, orderItems });
  } catch (error) {
    console.error("Chatbot image error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi khi xử lý ảnh, bạn thử lại sau nhé.",
    });
  }
};