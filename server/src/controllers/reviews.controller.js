import Review from "../models/Review.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

// Lấy đánh giá theo sản phẩm
export async function getReviewsByProduct(req, res) {
  try {
    const reviews = await Review.findAll({
      where: { id_mon: req.params.productId },
      include: [Customer, Product],
    });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Tạo đánh giá
export async function createReview(req, res) {
  try {
    const { id_kh, id_mon, diem, noi_dung } = req.body;
    const review = await Review.create({ id_kh, id_mon, diem, noi_dung });
    res.json({ message: "Đánh giá thành công", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
