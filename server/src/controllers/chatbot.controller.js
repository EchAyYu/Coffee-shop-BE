import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const handleChatbotMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập nội dung câu hỏi.",
      });
    }

    const systemPrompt = `
Bạn là chatbot thân thiện của quán cà phê LO Coffee trong một dự án luận văn.
Nhiệm vụ của bạn:
- Giới thiệu quán, menu đồ uống và bánh.
- Gợi ý món theo sở thích (ít đắng, nhiều sữa, ít ngọt...).
- Giải thích khuyến mãi, voucher, tích điểm (nếu khách hỏi).
- Hướng dẫn khách cách đặt món online, đặt bàn, thanh toán (COD, VNPay).
Quy tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, thân thiện.
- Xưng "mình" và gọi khách là "bạn".
- Nếu câu hỏi không liên quan tới quán cà phê, trả lời ngắn gọn rồi hướng lại về chủ đề quán.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 512,
    });

    const reply = completion.choices?.[0]?.message?.content ?? 
      "Xin lỗi, mình chưa hiểu ý bạn lắm. Bạn hỏi lại giúp mình nhé.";

    return res.json({ reply });
  } catch (error) {
    console.error("Lỗi chatbot:", error);
    return res.status(500).json({
      message: "Chatbot đang gặp sự cố, bạn thử lại sau nhé.",
    });
  }
};
