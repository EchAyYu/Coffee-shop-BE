// src/controllers/reviews.controller.js
import Review from "../models/Review.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

// 🟢 Tạo đánh giá
export async function createReview(req, res) {
  try {
    const { id_mon, diem, noi_dung } = req.body;
    const id_kh = req.user.id_tk; // lấy ID tài khoản đang đăng nhập

    const review = await Review.create({ id_kh, id_mon, diem, noi_dung });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    console.error("❌ [createReview]", err);
    res.status(500).json({ success: false, message: "Lỗi khi tạo đánh giá" });
  }
}

// 🟢 Lấy danh sách đánh giá theo sản phẩm
export async function getReviewsByProduct(req, res) {
  try {
    const { id } = req.params;
    const reviews = await Review.findAll({
      where: { id_mon: id },
      include: [
        { model: Customer, attributes: ["ho_ten", "anh"] },
        { model: Product, attributes: ["ten_mon"] },
      ],
      order: [["ngay_dg", "DESC"]],
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    console.error("❌ [getReviewsByProduct]", err);
    res.status(500).json({ success: false, message: "Lỗi khi lấy đánh giá" });
  }
}

// 🟢 (Tuỳ chọn) Admin xem tất cả đánh giá
export async function getAllReviews(req, res) {
  try {
    const reviews = await Review.findAll({
      include: [
        { model: Customer, attributes: ["ho_ten", "email"] },
        { model: Product, attributes: ["ten_mon"] },
      ],
      order: [["ngay_dg", "DESC"]],
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    console.error("❌ [getAllReviews]", err);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đánh giá" });
  }
}
