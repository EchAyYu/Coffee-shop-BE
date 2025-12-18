import Groq from "groq-sdk";
import { Op } from "sequelize";
import db from "../models/index.js";
import Voucher from "../models/Voucher.js";

const { Product, Category, Promotion, PromotionProduct } = db;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ==============================
// 1) SHOP INFO + helpers
// ==============================
const SHOP_INFO = {
  name: "LO Coffee",
  address: "326A Nguyễn Văn Linh, An Khánh, Ninh Kiều, Cần Thơ Vietnam",
  openHours: "6:00 - 23:00 mỗi ngày",
  phone: "0292 3943 516",
  payments: "Tiền mặt, chuyển khoản, ví điện tử (Momo, ZaloPay) và quét QR ngân hàng.",
  delivery: "Giao hàng trong bán kính 5km, phí ship tùy khoảng cách và bên vận chuyển.",
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
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return "";
}

function normalizeText(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ==============================
// 2) Output control: clamp + sanitize
// ==============================
function sanitizeUserFacingText(s) {
  if (!s) return s;
  return String(s)
    .replace(/\(từ\s*database\)/gi, "")
    .replace(/\bfrom\s*database\b/gi, "")
    .replace(/\bdatabase\b/gi, "")
    .replace(/\bmenu\s*\(.*?\)\s*:/gi, "Menu:")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampReply(reply, maxLines = 4, maxChars = 520) {
  if (!reply) return reply;

  let s = String(reply).trim();

  // remove "1) 2) 3)" style
  s = s.replace(/^\s*\d+\)\s*/gm, "");
  // normalize bullets
  s = s.replace(/^\s*[•\-]\s*/gm, "• ");
  // remove excessive blank lines
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  // hard clamp by chars
  if (s.length > maxChars) s = s.slice(0, maxChars).trim() + "…";

  // clamp by lines
  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.slice(0, maxLines).join("\n");
}

// ==============================
// 3) ORDER JSON mapper (giữ logic)
// ==============================
function mapOrderJsonToItems(jsonStr, products) {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
    if (!rawItems.length || !Array.isArray(products) || !products.length) return null;

    const mapped = [];

    for (const it of rawItems) {
      const rawName = String(it.name || it.product_name || "").trim();
      if (!rawName) continue;

      const qty = Number(it.quantity) || 1;
      const target = rawName.toLowerCase();

      let product =
        products.find((p) => (p.ten_mon || "").toLowerCase() === target) ||
        products.find((p) => (p.ten_mon || "").toLowerCase().includes(target)) ||
        products.find((p) => target.includes((p.ten_mon || "").toLowerCase()));

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

// ==============================
// 4) Build prompt data (rút gọn để model không lan man)
// ==============================
function buildMenuText(products = []) {
  if (!products.length) return "Menu trống.";
  const items = products.slice(0, 45).map((p) => {
    const catName = p.Category?.ten_dm || "Khác";
    const price = Number(p.gia || 0).toLocaleString("vi-VN");
    return `• ${p.ten_mon} - ${price}₫ (${catName})`;
  });
  // lưu ý: đây là dữ liệu cho model, không phải text trả khách
  return `MENU:\n${items.join("\n")}`;
}

function buildRecommendationText(products = []) {
  if (!products.length) return "GỢI Ý: (không có dữ liệu)";

  const clone = [...products];

  const topByCount = clone
    .slice()
    .sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0))
    .filter((p) => (p.rating_count || 0) > 0)
    .slice(0, 6);

  const fmt = (p) => {
    const price = Number(p.gia || 0).toLocaleString("vi-VN");
    return `${p.ten_mon} (${price}₫)`;
  };

  const lines = [];
  if (topByCount.length) lines.push(`Bán chạy: ${topByCount.slice(0, 4).map(fmt).join(" | ")}`);

  return `GỢI Ý:\n${lines.join("\n")}`.trim();
}

// ==============================
// 5) Promotions & Vouchers
// ==============================
async function getActivePromotions() {
  const now = new Date();
  return Promotion.findAll({
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
  if (tt === "ALL") return "Áp dụng toàn menu (theo điều kiện).";
  if (tt === "CATEGORY") return "Áp dụng theo danh mục.";
  if (tt === "PRODUCT") {
    const count = Array.isArray(promo.PromotionProducts) ? promo.PromotionProducts.length : 0;
    if (count <= 1) return "Áp dụng cho món cụ thể.";
    return `Áp dụng cho ~${count} món.`;
  }
  return "Áp dụng theo điều kiện.";
}

function buildPromotionsTextUser(promos = []) {
  if (!promos.length) return "Hiện chưa có khuyến mãi đang chạy.";

  const lines = promos.slice(0, 4).map((p) => {
    const from = formatDate(p.ngay_bd);
    const to = formatDate(p.ngay_kt);
    const timeRange = p.gio_bd && p.gio_kt ? ` (${p.gio_bd}-${p.gio_kt})` : "";
    return `• ${p.ten_km} • ${from}→${to}${timeRange}\n  ${describePromoTarget(p)}`;
  });

  return `Mình kiểm tra hiện có ${promos.length} khuyến mãi:\n${lines.join("\n")}`;
}

async function getActiveRewardVouchers() {
  const now = new Date();
  return Voucher.findAll({
    where: {
      active: true,
      points_cost: { [Op.gt]: 0 },
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }],
    },
    order: [["created_at", "DESC"]],
  });
}

function describeVoucherDiscount(v) {
  if (!v) return "";
  const type = v.discount_type;
  const val = Number(v.discount_value || 0);
  if (type === "percent") return `${val}%`;
  if (type === "fixed") return `${val.toLocaleString("vi-VN")}₫`;
  return "ưu đãi theo voucher";
}

function buildVoucherTextUser(vouchers = []) {
  if (!vouchers.length) return "Hiện chưa có voucher đổi điểm đang mở.";

  const lines = vouchers.slice(0, 4).map((v) => {
    const expires = v.expires_at ? formatDate(v.expires_at) : "Không giới hạn";
    return `• ${v.name} • ${v.points_cost} điểm • Giảm ${describeVoucherDiscount(v)} • Hạn: ${expires}`;
  });

  return `Voucher đổi điểm hiện có:\n${lines.join("\n")}`;
}

function buildRedeemGuideText() {
  return (
    "Cách đổi điểm lấy voucher:\n" +
    "• Bạn đăng nhập → vào mục Đổi thưởng/Voucher.\n" +
    "• Chọn voucher muốn đổi → xác nhận.\n" +
    "• Khi thanh toán, nhập/áp dụng voucher trong giỏ hàng.\n" +
    "Nếu bạn nói mình biết bạn đang có bao nhiêu điểm, mình gợi ý voucher phù hợp nhé."
  );
}

// ==============================
// 6) System prompt (ngắn gọn bắt buộc)
// ==============================
function buildSystemPrompt(menuText, recommendationText, promotionsText, voucherText) {
  return `
Bạn là trợ lý bán hàng của quán ${SHOP_INFO.name}. Trả lời tiếng Việt, thân thiện, NGẮN GỌN.

Thông tin quán:
- Địa chỉ: ${SHOP_INFO.address}
- Giờ mở cửa: ${SHOP_INFO.openHours}
- Hotline: ${SHOP_INFO.phone}
- Thanh toán: ${SHOP_INFO.payments}
- Giao hàng: ${SHOP_INFO.delivery}

Dữ liệu menu & gợi ý (dùng để tham chiếu, KHÔNG bịa thêm):
${menuText}

${recommendationText}

Khuyến mãi & voucher (tham chiếu):
${promotionsText}
${voucherText}

QUY TẮC NGẮN GỌN:
- Tối đa 4 dòng, tránh dài dòng, tránh chia mục 1)2)3).
- Nếu gợi ý đồ uống: chỉ đưa 2–3 món + giá.
- Nếu cần hỏi thêm: hỏi tối đa 1–2 câu.

ĐẶT BÀN:
- Hỏi lần lượt thông tin còn thiếu: ngày, giờ, số người, tên, SĐT, ghi chú.
- Khi đủ thông tin và khách đồng ý/chốt: kèm JSON:
<RESERVATION_JSON>
{"name":"...","phone":"...","date":"YYYY-MM-DD","time":"HH:mm","people":2,"note":""}
</RESERVATION_JSON>

THÊM GIỎ NHANH:
- Khi khách chốt món ("chốt", "lấy", "thêm vào giỏ", "order"): kèm JSON:
<ORDER_JSON>
{"items":[{"name":"Tên món trong menu","quantity":1}]}
</ORDER_JSON>
- Nếu khách chỉ hỏi tham khảo: KHÔNG sinh ORDER_JSON.
`.trim();
}

// ==============================
// 7) FAQ + Keywords (tách intent chuẩn hơn)
// ==============================
const faqRules = [
  {
    id: "open_hours",
    keywords: ["gio mo cua", "may gio mo cua", "gio dong cua", "mo cua luc nao"],
    answer: () => `Quán ${SHOP_INFO.name} mở cửa ${SHOP_INFO.openHours}. Bạn muốn mình giữ bàn giờ nào không?`,
  },
  {
    id: "address",
    keywords: ["dia chi", "dia chi quan", "o dau"],
    answer: () => `Quán ${SHOP_INFO.name} ở: ${SHOP_INFO.address}. Bạn muốn mình gửi link Google Maps không?`,
  },
  {
    id: "phone",
    keywords: ["so dien thoai", "sdt", "hotline", "lien he"],
    answer: () => `Hotline quán: ${SHOP_INFO.phone}. Bạn cần mình hỗ trợ đặt bàn hay đặt món luôn không?`,
  },
  {
    id: "payment",
    keywords: ["thanh toan", "tra tien", "payment", "hinh thuc thanh toan"],
    answer: () => `Quán hỗ trợ: ${SHOP_INFO.payments} Bạn muốn thanh toán khi nhận hàng hay quét QR?`,
  },
];

const PROMOTION_KEYWORDS = ["khuyen mai", "uu dai", "giam gia"];
// voucher đổi điểm
const VOUCHER_KEYWORDS = ["voucher", "doi diem", "tich diem", "diem tich luy", "doi voucher"];
// mã giảm giá / code (có thể là voucher hoặc promo)
const DISCOUNT_CODE_KEYWORDS = ["ma giam gia", "code giam", "coupon", "coupon code"];

// ==============================
// 8) TEXT CHAT
// ==============================
export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: "Vui lòng nhập câu hỏi." });

    const normalized = normalizeText(message);

    // 8.1 FAQ direct
    for (const rule of faqRules) {
      if (rule.keywords.some((kw) => normalized.includes(kw))) {
        return res.json({ reply: rule.answer() });
      }
    }

    // 8.2 Intent: "đổi điểm lấy voucher như thế nào" => trả hướng dẫn (không phụ thuộc DB)
    const isRedeemHowTo =
      (normalized.includes("doi diem") || normalized.includes("tich diem") || normalized.includes("diem")) &&
      (normalized.includes("nhu the nao") || normalized.includes("lam sao") || normalized.includes("cach"));

    if (isRedeemHowTo) {
      return res.json({ reply: clampReply(buildRedeemGuideText(), 4, 520) });
    }

    // 8.3 Intent: mã giảm giá hôm nay? => check BOTH promos & vouchers
    const isDiscountCodeIntent = DISCOUNT_CODE_KEYWORDS.some((kw) => normalized.includes(kw));
    if (isDiscountCodeIntent) {
      try {
        const [promos, vouchers] = await Promise.all([getActivePromotions(), getActiveRewardVouchers()]);
        if (!promos.length && !vouchers.length) {
          return res.json({
            reply:
              "Hiện mình chưa thấy khuyến mãi hoặc voucher nào đang mở.\n" +
              "Bạn muốn mình gợi ý đồ uống theo khẩu vị (ít ngọt/đậm cà phê/ít caffeine) không?",
          });
        }

        let reply = "";
        if (promos.length) reply += buildPromotionsTextUser(promos) + "\n";
        if (vouchers.length) reply += buildVoucherTextUser(vouchers) + "\n";
        reply += "Bạn muốn mình gợi ý món phù hợp với ưu đãi nào không?";

        reply = sanitizeUserFacingText(reply);
        return res.json({ reply: clampReply(reply, 4, 520) });
      } catch (e) {
        console.error("Lỗi kiểm tra mã giảm giá:", e);
        return res.json({
          reply: "Mình chưa kiểm tra được ưu đãi lúc này. Bạn thử lại sau hoặc xem mục Khuyến mãi/Voucher trên website nhé.",
        });
      }
    }

    // 8.4 Intent: voucher đổi điểm (có voucher không?)
    const isVoucherIntent = VOUCHER_KEYWORDS.some((kw) => normalized.includes(kw));
    if (isVoucherIntent) {
      try {
        const vouchers = await getActiveRewardVouchers();
        if (!vouchers.length) {
          return res.json({
            reply:
              "Hiện chưa có voucher đổi điểm đang mở.\n" +
              "Bạn vẫn có thể tích điểm, khi có voucher mới mình sẽ gợi ý loại phù hợp nhé.",
          });
        }

        let reply = buildVoucherTextUser(vouchers) + "\nBạn muốn mình gợi ý voucher phù hợp theo giá trị đơn dự kiến không?";
        reply = sanitizeUserFacingText(reply);
        return res.json({ reply: clampReply(reply, 4, 520) });
      } catch (e) {
        console.error("Lỗi lấy voucher:", e);
        return res.json({
          reply: "Mình chưa tải được danh sách voucher lúc này. Bạn thử lại sau hoặc xem mục Voucher trên website nhé.",
        });
      }
    }

    // 8.5 Intent: promotion (khuyến mãi)
    const isPromotionIntent = PROMOTION_KEYWORDS.some((kw) => normalized.includes(kw));
    if (isPromotionIntent) {
      try {
        const promos = await getActivePromotions();
        if (!promos.length) {
          return res.json({
            reply: "Hiện chưa có khuyến mãi đang chạy.\nBạn muốn mình gợi ý đồ uống theo khẩu vị không?",
          });
        }

        let reply = buildPromotionsTextUser(promos) + "\nBạn muốn áp dụng cho món nào để mình gợi ý nhanh?";
        reply = sanitizeUserFacingText(reply);
        return res.json({ reply: clampReply(reply, 4, 520) });
      } catch (e) {
        console.error("Lỗi lấy khuyến mãi:", e);
        return res.json({
          reply: "Mình chưa xem được khuyến mãi lúc này. Bạn thử lại sau hoặc xem mục Khuyến mãi trên website nhé.",
        });
      }
    }

    // ==============================
    // 8.6 Fallback to LLM (menu-based, giữ JSON flows)
    // ==============================
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho chatbot:", err);
    }

    let promotions = [];
    let vouchers = [];
    try {
      promotions = await getActivePromotions();
    } catch (err) {
      console.error("Lỗi lấy khuyến mãi cho system prompt:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher cho system prompt:", err);
    }

    const menuText = buildMenuText(products);
    const recommendationText = buildRecommendationText(products);

    // dữ liệu cho model (không show ra UI)
    const promotionsText = promosToPrompt(promotions);
    const voucherText = vouchersToPrompt(vouchers);

    const systemPrompt = buildSystemPrompt(menuText, recommendationText, promotionsText, voucherText);

    let chatHistory = [];
    if (Array.isArray(history)) {
      chatHistory = history
        .filter((m) => m && m.role && m.content)
        .slice(-8)
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content).slice(0, 800),
        }));
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, ...chatHistory, { role: "user", content: message }],
      temperature: 0.35,
      max_tokens: 260,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Mình chưa hiểu ý bạn lắm. Bạn nói rõ hơn 1 chút giúp mình nhé.";

    // Parse RESERVATION_JSON
    let reservationData = null;
    const match = reply.match(/<RESERVATION_JSON>([\s\S]+?)<\/RESERVATION_JSON>/);
    if (match) {
      const jsonStr = match[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === "object") {
          const normalizedDate = normalizeReservationDate(parsed.date || "");
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

    // Parse ORDER_JSON
    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);
    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    reply = sanitizeUserFacingText(reply);
    reply = clampReply(reply, 4, 520);

    return res.json({ reply, reservationData, orderItems });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({ message: "Chatbot đang gặp lỗi, vui lòng thử lại." });
  }
};

// ==============================
// Helpers for prompt-only (không show UI)
// ==============================
function promosToPrompt(promos = []) {
  if (!promos.length) return "KHUYENMAI: none";
  return "KHUYENMAI:\n" + promos.slice(0, 5).map((p) => `- ${p.ten_km} (${formatDate(p.ngay_bd)}→${formatDate(p.ngay_kt)})`).join("\n");
}

function vouchersToPrompt(vouchers = []) {
  if (!vouchers.length) return "VOUCHER: none";
  return "VOUCHER:\n" + vouchers.slice(0, 5).map((v) => `- ${v.name} (${v.points_cost} điểm)`).join("\n");
}

// ==============================
// 9) IMAGE CHAT (ngắn gọn)
// ==============================
export const handleChatbotImageMessage = async (req, res) => {
  try {
    const { history } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "Vui lòng gửi kèm hình ảnh." });

    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu cho image chatbot:", err);
    }

    let promotions = [];
    let vouchers = [];
    try {
      promotions = await getActivePromotions();
    } catch (err) {
      console.error("Lỗi lấy khuyến mãi cho image:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher cho image:", err);
    }

    const menuText = buildMenuText(products);
    const recommendationText = buildRecommendationText(products);
    const promotionsText = promosToPrompt(promotions);
    const voucherText = vouchersToPrompt(vouchers);
    const systemPrompt = buildSystemPrompt(menuText, recommendationText, promotionsText, voucherText);

    let chatHistory = [];
    if (history) {
      try {
        const parsed = typeof history === "string" ? JSON.parse(history) : history;
        if (Array.isArray(parsed)) {
          chatHistory = parsed.slice(-8).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 800),
          }));
        }
      } catch (e) {
        console.warn("Không parse được history cho image chat:", e);
      }
    }

    const base64Image = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64Image}`;

    const imagePrompt = `
Trả lời NGẮN GỌN tối đa 3 câu:
- 1 câu mô tả nhanh đồ uống trong ảnh.
- 1 câu gợi ý 1–2 món trong menu + giá (nếu không có đúng y hệt thì nói rõ và gợi ý 2 món gần nhất).
- 1 câu hỏi chốt: bạn muốn thêm món nào vào giỏ / ít ngọt hay ngọt vừa?

Không chia mục 1)2)3). Không dài dòng. Không bịa tên món ngoài menu.
Nếu khách CHỐT muốn đặt theo ảnh ("lấy 2 ly giống hình", "thêm vào giỏ"), sinh <ORDER_JSON> ở cuối.
`.trim();

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        {
          role: "user",
          content: [
            { type: "text", text: imagePrompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.45,
      max_tokens: 220,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Mình chưa đọc rõ hình này. Bạn thử gửi lại giúp mình nhé.";

    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);
    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    reply = sanitizeUserFacingText(reply);
    reply = clampReply(reply, 3, 420);

    return res.json({ reply, orderItems });
  } catch (error) {
    console.error("Chatbot image error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi khi xử lý ảnh, bạn thử lại sau nhé.",
    });
  }
};
