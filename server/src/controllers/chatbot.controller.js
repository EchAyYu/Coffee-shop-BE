// server/src/controllers/chatbot.controller.js
import Groq from "groq-sdk";
import { Op } from "sequelize";
import db from "../models/index.js";
import Voucher from "../models/Voucher.js";

const { Product, Category, Promotion, PromotionProduct } = db;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ==============================
// CONFIG: ép format 4 dòng
// ==============================
const FORMAT_CFG = {
  maxLines: 4,
  maxChars: 520, // buffer trước khi ép format
  maxBullets: 2,
  defaultFollowUp: "Bạn muốn mình gợi ý theo khẩu vị: ngọt/ít ngọt/đậm không?",
};

// ==============================
// 1) Thông tin quán + helper
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

  if (s === "ngày mai" || s === "ngay mai" || s === "mai" || s === "tomorrow") {
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

function hasAnyKeyword(normalizedText, keywords = []) {
  return keywords.some((kw) => normalizedText.includes(normalizeText(kw)));
}

function moneyVND(n) {
  const v = Number(n || 0);
  return `${v.toLocaleString("vi-VN")}₫`;
}

// ==============================
// 2) EP FORMAT 4 LINES (HARD)
// ==============================
// - line1: main sentence
// - line2-3: up to 2 bullets
// - line4: follow-up (if missingInfo) else defaultFollowUp
function force4LineFormat({
  main = "",
  bullets = [],
  followUp = "",
  missingInfo = false,
} = {}) {
  const clean = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .replace(/[•\-\*]\s*/g, "")
      .trim();

  const line1 = clean(main) || "Mình có thể hỗ trợ bạn về menu, đặt món, đặt bàn, khuyến mãi và voucher.";
  const b = (Array.isArray(bullets) ? bullets : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, FORMAT_CFG.maxBullets)
    .map((x) => `• ${x}`);

  const line4 = clean(missingInfo ? followUp : followUp) || FORMAT_CFG.defaultFollowUp;

  // Ensure exactly 4 lines (fill if thiếu)
  const out = [line1, b[0] || "• Bạn muốn uống cà phê hay trà?", b[1] || "• Bạn thích ngọt hay ít ngọt?", line4]
    .slice(0, 4)
    .join("\n");

  return out;
}

// Extract: main + bullets from a free-form reply (LLM / direct text)
// Then re-pack to 4 lines consistently.
function packReplyTo4Lines(rawText, { followUp = "", missingInfo = false } = {}) {
  let t = String(rawText || "").trim();

  // cắt bớt rườm rà & giới hạn ký tự trước khi tách dòng
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > FORMAT_CFG.maxChars) t = t.slice(0, FORMAT_CFG.maxChars).trim() + "…";

  // split lines
  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // main: lấy dòng đầu hoặc câu đầu
  let main = lines[0] || t.split(/[.!?]\s/)[0] || t;

  // bullets: lấy các dòng bắt đầu bằng bullet, hoặc các dòng còn lại
  const bulletLines = lines
    .filter((l) => /^[•\-\*]/.test(l))
    .map((l) => l.replace(/^[•\-\*]\s*/, "").trim());

  let bullets = bulletLines.length ? bulletLines : lines.slice(1);

  // làm ngắn bullet
  bullets = bullets
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, FORMAT_CFG.maxBullets);

  // nếu main quá dài => rút ngắn nhẹ
  if (main.length > 140) main = main.slice(0, 140).trim() + "…";

  return force4LineFormat({ main, bullets, followUp, missingInfo });
}

// ==============================
// 3) Map ORDER_JSON -> items theo DB (match không dấu)
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
      const target = normalizeText(rawName);

      const product =
        products.find((p) => normalizeText(p.ten_mon || "") === target) ||
        products.find((p) => normalizeText(p.ten_mon || "").includes(target)) ||
        products.find((p) => target.includes(normalizeText(p.ten_mon || "")));

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
// 4) Build dữ liệu gọn cho prompt (giảm lan man)
// ==============================
function buildMenuText(products = []) {
  if (!products.length) return "Menu trống.";
  return products
    .slice()
    .sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0))
    .slice(0, 10)
    .map((p) => `• ${p.ten_mon} — ${moneyVND(p.gia)}`)
    .join("\n");
}

function buildRecommendationText(products = []) {
  if (!products.length) return "Không có.";
  const top = products
    .slice()
    .sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0))
    .slice(0, 4)
    .map((p) => `• ${p.ten_mon} — ${moneyVND(p.gia)}`);
  return top.join("\n");
}

// ==============================
// 5) Promotions / Vouchers
// ==============================
async function getActivePromotions() {
  const now = new Date();
  return Promotion.findAll({
    where: { hien_thi: true, ngay_bd: { [Op.lte]: now }, ngay_kt: { [Op.gte]: now } },
    include: [{ model: PromotionProduct, as: "PromotionProducts", attributes: ["id_mon"] }],
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
  if (!promo) return "Theo điều kiện.";
  const tt = promo.target_type || "ALL";
  if (tt === "ALL") return "Áp dụng rộng.";
  if (tt === "CATEGORY") return "Theo danh mục.";
  if (tt === "PRODUCT") {
    const c = Array.isArray(promo.PromotionProducts) ? promo.PromotionProducts.length : 0;
    if (c <= 0) return "Một số món.";
    if (c === 1) return "1 món.";
    return `~${c} món.`;
  }
  return "Theo điều kiện.";
}

function buildPromotionsText(promos = []) {
  if (!promos.length) return "Không có.";
  return promos
    .slice(0, 3)
    .map((p) => `• ${p.ten_km} — ${formatDate(p.ngay_bd)}→${formatDate(p.ngay_kt)} — ${describePromoTarget(p)}`)
    .join("\n");
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
  if (!v) return "theo thiết lập";
  const type = v.discount_type;
  const val = Number(v.discount_value || 0);
  if (type === "percent") return `${val}%`;
  if (type === "fixed") return `${val.toLocaleString("vi-VN")}₫`;
  return "theo thiết lập";
}

function buildVoucherText(vouchers = []) {
  if (!vouchers.length) return "Không có.";
  return vouchers
    .slice(0, 3)
    .map((v) => {
      const exp = v.expires_at ? formatDate(v.expires_at) : "Không giới hạn";
      return `• ${v.name} — ${v.points_cost}đ — Hạn: ${exp} — Giảm: ${describeVoucherDiscount(v)}`;
    })
    .join("\n");
}

// ==============================
// 6) System prompt (ép 4 dòng)
// ==============================
function buildSystemPrompt(menuText, promotionsText, voucherText) {
  return (
    `Bạn là chatbot của quán ${SHOP_INFO.name}. Trả lời tiếng Việt, thân thiện.\n` +
    `BẮT BUỘC: Output chỉ tối đa 4 dòng theo format:\n` +
    `D1: câu trả lời chính (1 câu).\n` +
    `D2-D3: tối đa 2 bullet '•'.\n` +
    `D4: 1 câu hỏi ngắn nếu thiếu thông tin; nếu đủ thì gợi ý tiếp.\n\n` +
    `QUY TẮC:\n` +
    `- Chỉ dùng tên món trong MENU; không bịa.\n` +
    `- Chỉ sinh <ORDER_JSON> khi khách CHỐT đặt món; <RESERVATION_JSON> khi khách CHỐT đặt bàn.\n` +
    `- JSON phải đặt CUỐI, thuần JSON, không giải thích.\n\n` +
    `Thông tin quán: ${SHOP_INFO.address} • ${SHOP_INFO.openHours} • ${SHOP_INFO.phone}\n\n` +
    `MENU (tóm tắt):\n${menuText}\n\n` +
    `KHUYẾN MÃI:\n${promotionsText}\n` +
    `VOUCHER:\n${voucherText}\n`
  );
}

// ==============================
// 7) FAQ + keywords/intent
// ==============================
const faqRules = [
  { id: "open_hours", keywords: ["gio mo cua", "gio dong cua", "mo cua luc nao"], answer: () => `Quán mở cửa ${SHOP_INFO.openHours}.` },
  { id: "address", keywords: ["dia chi", "o dau"], answer: () => `Quán ở: ${SHOP_INFO.address}.` },
  { id: "phone", keywords: ["so dien thoai", "sdt", "hotline", "lien he"], answer: () => `Hotline của quán là ${SHOP_INFO.phone}.` },
  { id: "payment", keywords: ["thanh toan", "hinh thuc thanh toan", "payment"], answer: () => `Quán hỗ trợ: ${SHOP_INFO.payments}.` },
];

const PROMOTION_KEYWORDS = ["khuyen mai", "giam gia", "uu dai"];
const VOUCHER_KEYWORDS = ["voucher", "ma giam gia", "doi diem", "tich diem", "diem tich luy", "doi voucher"];
const ORDER_KEYWORDS = ["cho mình", "mình lấy", "mình muốn", "đặt món", "order", "chốt", "mua", "lấy"];
const RESERVATION_KEYWORDS = ["đặt bàn", "đặt chỗ", "booking", "giữ bàn", "reserve"];

// detect thiếu info đặt bàn (đơn giản nhưng hiệu quả)
function detectReservationMissingInfo(message) {
  const n = normalizeText(message);
  const hasDate = /\b\d{4}-\d{2}-\d{2}\b/.test(n) || n.includes("hom nay") || n.includes("ngay mai") || /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/.test(n);
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(n);
  const hasPeople = /\b(\d+)\s*(nguoi|ng)\b/.test(n);
  const hasPhone = /\b0\d{8,10}\b/.test(n);
  // tên khó detect, bỏ qua
  const missing = [];
  if (!hasDate) missing.push("ngày");
  if (!hasTime) missing.push("giờ");
  if (!hasPeople) missing.push("số người");
  if (!hasPhone) missing.push("số điện thoại");
  return missing;
}

// ==============================
// 8) Chat TEXT
// ==============================
export const handleChatbotMessage = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập câu hỏi." });
    }

    const normalized = normalizeText(message);

    const isOrderIntent = hasAnyKeyword(normalized, ORDER_KEYWORDS);
    const isReservationIntent = hasAnyKeyword(normalized, RESERVATION_KEYWORDS);
    const isVoucherIntent = hasAnyKeyword(normalized, VOUCHER_KEYWORDS);
    const isPromotionIntent = hasAnyKeyword(normalized, PROMOTION_KEYWORDS);

    // 8.1 Voucher -> trả DB trực tiếp (ép format)
    if (isVoucherIntent) {
      try {
        const vouchers = await getActiveRewardVouchers();
        if (!vouchers.length) {
          const reply = force4LineFormat({
            main: "Hiện tại chưa có voucher đổi điểm đang mở.",
            bullets: ["Bạn vẫn có thể tích điểm từ các đơn hàng", "Khi có voucher mới mình sẽ gợi ý ngay"],
            followUp: FORMAT_CFG.defaultFollowUp,
            missingInfo: false,
          });
          return res.json({ reply });
        }

        const lines = buildVoucherText(vouchers).split("\n").filter(Boolean);
        const reply = force4LineFormat({
          main: "Voucher đổi điểm đang có:",
          bullets: lines.slice(0, 2).map((l) => l.replace(/^•\s*/, "")),
          followUp: "Bạn muốn mình gợi ý voucher theo giá trị đơn hàng dự kiến không?",
          missingInfo: false,
        });
        return res.json({ reply });
      } catch (e) {
        console.error("Lỗi lấy voucher:", e);
        const reply = force4LineFormat({
          main: "Hệ thống voucher đang bận nên mình chưa xem được.",
          bullets: ["Bạn thử lại sau giúp mình nha", "Hoặc xem mục Voucher/Đổi thưởng trên website"],
          followUp: FORMAT_CFG.defaultFollowUp,
          missingInfo: false,
        });
        return res.json({ reply });
      }
    }

    // 8.2 Khuyến mãi -> trả DB trực tiếp (ép format)
    if (isPromotionIntent) {
      try {
        const promos = await getActivePromotions();
        const vouchers = await getActiveRewardVouchers();

        if (!promos.length && !vouchers.length) {
          const reply = force4LineFormat({
            main: "Hiện tại chưa có khuyến mãi/voucher đang chạy.",
            bullets: ["Bạn muốn mình gợi ý món bán chạy không?", "Hay bạn thích đồ uống nóng/lạnh?"],
            followUp: FORMAT_CFG.defaultFollowUp,
            missingInfo: false,
          });
          return res.json({ reply });
        }

        const promoLines = buildPromotionsText(promos).split("\n").filter(Boolean);
        const voucherLines = buildVoucherText(vouchers).split("\n").filter(Boolean);

        const reply = force4LineFormat({
          main: "Chương trình đang có:",
          bullets: [
            promoLines[0]?.replace(/^•\s*/, "") || "Không có khuyến mãi trực tiếp.",
            voucherLines[0]?.replace(/^•\s*/, "") || "Không có voucher đổi điểm.",
          ],
          followUp: "Bạn muốn áp dụng ưu đãi cho món nào (hoặc khẩu vị của bạn là gì)?",
          missingInfo: false,
        });

        return res.json({ reply });
      } catch (e) {
        console.error("Lỗi lấy khuyến mãi:", e);
        const reply = force4LineFormat({
          main: "Hệ thống khuyến mãi đang bận nên mình chưa xem được.",
          bullets: ["Bạn thử lại sau giúp mình nha", "Hoặc xem mục Khuyến mãi/Voucher trên website"],
          followUp: FORMAT_CFG.defaultFollowUp,
          missingInfo: false,
        });
        return res.json({ reply });
      }
    }

    // 8.3 FAQ -> ép format
    for (const rule of faqRules) {
      const hit = rule.keywords.some((kw) => normalized.includes(kw));
      if (hit) {
        const reply = force4LineFormat({
          main: rule.answer(),
          bullets: ["Bạn muốn mình gợi ý món phù hợp không?", "Hay bạn muốn đặt bàn/đặt món nhanh?"],
          followUp: FORMAT_CFG.defaultFollowUp,
          missingInfo: false,
        });
        return res.json({ reply });
      }
    }

    // 8.4 Load DB context cho LLM
    let products = [];
    try {
      products = await Product.findAll({
        where: { trang_thai: true },
        include: [{ model: Category, required: false }],
      });
    } catch (err) {
      console.error("Lỗi lấy menu:", err);
    }

    let promotions = [];
    let vouchers = [];
    try {
      promotions = await getActivePromotions();
    } catch (err) {
      console.error("Lỗi lấy promo:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher:", err);
    }

    const menuText = buildMenuText(products);
    const promotionsText = buildPromotionsText(promotions);
    const voucherText = buildVoucherText(vouchers);
    const systemPrompt = buildSystemPrompt(menuText, promotionsText, voucherText);

    // 8.5 Build history (ngắn)
    let chatHistory = [];
    if (Array.isArray(history)) {
      chatHistory = history
        .filter((m) => m && m.role && m.content)
        .slice(-6)
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content).slice(0, 900),
        }));
    }

    // 8.6 Intent hint + call Groq
    const messages = [{ role: "system", content: systemPrompt }];

    if (isReservationIntent) {
      const missing = detectReservationMissingInfo(message);
      const ask =
        missing.length > 0
          ? `Bạn cho mình xin ${missing.join(", ")} để mình giữ bàn nhé?`
          : "Bạn xác nhận giúp mình: tên + sđt + ngày + giờ + số người nhé?";
      messages.push({
        role: "system",
        content:
          "INTENT_HINT: Đây là đặt bàn. Nếu chưa đủ thông tin thì hỏi 1 câu ngắn. Nếu user xác nhận đầy đủ thì sinh <RESERVATION_JSON> ở cuối.",
      });
      // thêm 1 dòng “soft force” (nếu model lỡ dài, mình vẫn ép ở post-process)
      messages.push({ role: "system", content: `FOLLOWUP_SUGGESTION: ${ask}` });
    } else if (isOrderIntent) {
      messages.push({
        role: "system",
        content:
          "INTENT_HINT: Đây là đặt món. Nếu user chưa chốt thì hỏi 1 câu ngắn để xác nhận tên món/số lượng. Nếu chốt thì sinh <ORDER_JSON> ở cuối.",
      });
    }

    messages.push(...chatHistory);
    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.2,
      max_tokens: 220,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Mình chưa hiểu ý bạn. Bạn nói lại giúp mình ngắn gọn nha?";

    // 8.7 Parse JSON tags
    let reservationData = null;
    const resMatch = reply.match(/<RESERVATION_JSON>([\s\S]+?)<\/RESERVATION_JSON>/);
    if (resMatch) {
      const jsonStr = resMatch[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === "object") {
          reservationData = {
            name: String(parsed.name || "").slice(0, 100),
            phone: String(parsed.phone || "").slice(0, 20),
            date: normalizeReservationDate(parsed.date || ""),
            time: String(parsed.time || "").slice(0, 5),
            people: Number(parsed.people) || 1,
            note: parsed.note ? String(parsed.note).slice(0, 255) : "",
          };
        }
      } catch (e) {
        console.warn("Không parse được RESERVATION_JSON:", e);
      }
      reply = reply.replace(resMatch[0], "").trim();
    }

    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);
    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    // 8.8 HARD EP FORMAT
    // Nếu intent đặt bàn mà còn thiếu info -> line4 hỏi đúng missing
    let followUp = FORMAT_CFG.defaultFollowUp;
    let missingInfo = false;

    if (isReservationIntent && !reservationData) {
      const missing = detectReservationMissingInfo(message);
      if (missing.length) {
        missingInfo = true;
        followUp = `Bạn cho mình xin ${missing.join(", ")} để mình giữ bàn nhé?`;
      } else {
        missingInfo = true;
        followUp = "Bạn xác nhận giúp mình: tên + sđt + ngày + giờ + số người nhé?";
      }
    } else if (isOrderIntent && !orderItems) {
      // đặt món nhưng chưa có ORDER_JSON -> hỏi xác nhận cực ngắn
      missingInfo = true;
      followUp = "Bạn chốt giúp mình: tên món và số lượng nha?";
    }

    const finalReply = packReplyTo4Lines(reply, { followUp, missingInfo });

    return res.json({ reply: finalReply, reservationData, orderItems });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi, vui lòng thử lại.",
    });
  }
};

// ==============================
// 9) Chat IMAGE (ép format 4 dòng)
// ==============================
export const handleChatbotImageMessage = async (req, res) => {
  try {
    const { history } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Vui lòng gửi kèm hình ảnh." });
    }

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
      console.error("Lỗi lấy khuyến mãi cho image chatbot:", err);
    }
    try {
      vouchers = await getActiveRewardVouchers();
    } catch (err) {
      console.error("Lỗi lấy voucher cho image chatbot:", err);
    }

    const menuText = buildMenuText(products);
    const promotionsText = buildPromotionsText(promotions);
    const voucherText = buildVoucherText(vouchers);
    const systemPrompt = buildSystemPrompt(menuText, promotionsText, voucherText);

    // history
    let chatHistory = [];
    if (history) {
      try {
        const parsed = typeof history === "string" ? JSON.parse(history) : history;
        if (Array.isArray(parsed)) {
          chatHistory = parsed.slice(-6).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 900),
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
              "BẮT BUỘC: trả lời đúng 4 dòng theo format D1-D4, tự nhiên, dễ hiểu.\n" +
              "D1: 1 câu mô tả ảnh + nhận định nhanh.\n" +
              "D2-D3: 1–2 bullet '•' giải thích ngắn vì sao bạn nhận định như vậy (màu sắc, topping, dạng ly, đồ ăn/đồ uống...).\n" +
              "QUAN TRỌNG:\n" +
              "- Nếu ảnh KHÔNG phải đồ uống/đồ ăn hoặc KHÔNG khớp MENU => nói rõ 'menu hiện chưa có món trùng' và KHÔNG nêu tên món.\n" +
              "- Nếu ảnh có thể khớp MENU => nêu tối đa 1–2 món gần nhất (tên + giá).\n" +
              "- Tuyệt đối KHÔNG bịa món ngoài MENU.\n" +
              "- Chỉ sinh <ORDER_JSON> khi khách CHỐT đặt.\n" +
              "D4: hỏi 1 câu ngắn để làm rõ nhu cầu (khẩu vị, nóng/lạnh, cà phê/trà, số lượng)."
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 240,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "Mình chưa đọc được hình này, bạn gửi lại giúp mình nha.";

    // Parse ORDER_JSON
    let orderItems = null;
    const orderMatch = reply.match(/<ORDER_JSON>([\s\S]+?)<\/ORDER_JSON>/);
    if (orderMatch) {
      const jsonStr = orderMatch[1].trim();
      orderItems = mapOrderJsonToItems(jsonStr, products);
      reply = reply.replace(orderMatch[0], "").trim();
    }

    // ép format luôn
    const finalReply = packReplyTo4Lines(reply, {
      missingInfo: true,
      followUp:
        "Bạn muốn mình gợi ý theo khẩu vị: cà phê hay trà, nóng hay lạnh, ngọt hay ít ngọt?",
    });

    return res.json({ reply: finalReply, orderItems });
  } catch (error) {
    console.error("Chatbot image error:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp lỗi khi xử lý ảnh, bạn thử lại sau nhé.",
    });
  }
};
