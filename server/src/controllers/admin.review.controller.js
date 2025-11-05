import db from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sequelize from "../utils/db.js"; // Import sequelize để dùng transaction
import { Op } from "sequelize";

const { Review, Customer, Product, ReviewReply, Account } = db;

/**
 * 💡 Helper: Tính toán và cập nhật điểm trung bình cho món ăn
 * (Copy từ review.controller.js)
 */
async function updateProductRating(id_mon, transaction) {
  const reviews = await Review.findAll({
    where: { id_mon },
    attributes: ["diem"],
    transaction,
  });

  const rating_count = reviews.length;
  let rating_avg = 0.0;

  if (rating_count > 0) {
    const total_diem = reviews.reduce((sum, r) => sum + r.diem, 0);
    rating_avg = (total_diem / rating_count).toFixed(2);
  }

  await Product.update(
    { rating_avg, rating_count },
    { where: { id_mon }, transaction }
  );
}


/**
 * 📦 (Admin) LẤY TẤT CẢ ĐÁNH GIÁ
 * (GET /api/admin/reviews)
 */
export const getAllReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || 1, 10);
  const limit = parseInt(req.query.limit || 10, 10);
  const offset = (page - 1) * limit;

  // Logic lọc (ví dụ)
  const where = {};
  if (req.query.rating) {
    where.diem = req.query.rating;
  }
  if (req.query.id_mon) {
    where.id_mon = req.query.id_mon;
  }

  const { count, rows } = await Review.findAndCountAll({
    where,
    include: [
      { model: Product, attributes: ["ten_mon", "anh"] },
      { model: Customer, attributes: ["ho_ten", "email"] },
      { 
        model: ReviewReply,
        include: [{ model: Account, attributes: ["ten_dn"] }] // Lấy tên admin/employee đã phản hồi
      }
    ],
    order: [["ngay_dg", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      totalItems: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      limit,
    },
  });
});

/**
 * 💬 (Admin) PHẢN HỒI MỘT ĐÁNH GIÁ
 * (POST /api/admin/reviews/:id_danh_gia/reply)
 */
export const replyToReview = asyncHandler(async (req, res) => {
  const { id_danh_gia } = req.params;
  const { noi_dung } = req.body;
  const { id_tk } = req.user; // Lấy ID của admin/employee đang đăng nhập

  // 1. Kiểm tra xem đánh giá có tồn tại không
  const review = await Review.findByPk(id_danh_gia);
  if (!review) {
    return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá này." });
  }

  // 2. Tạo hoặc cập nhật phản hồi
  // (findOrCreate để tránh 2 admin phản hồi cùng lúc)
  const [reply, created] = await ReviewReply.findOrCreate({
    where: { id_danh_gia: id_danh_gia },
    defaults: {
      id_tk,
      noi_dung,
    },
  });

  if (!created) {
    // Nếu đã có, chỉ cập nhật nội dung
    reply.noi_dung = noi_dung;
    reply.id_tk = id_tk; // Cập nhật người phản hồi cuối cùng
    await reply.save();
  }
  
  // Lấy lại thông tin đầy đủ để trả về (bao gồm tên Admin)
  const fullReply = await ReviewReply.findByPk(reply.id_phan_hoi, {
     include: [{ model: Account, attributes: ["ten_dn"] }]
  });

  res.status(201).json({ success: true, data: fullReply });
});

/**
 * 🗑️ (Admin) XÓA MỘT ĐÁNH GIÁ
 * (DELETE /api/admin/reviews/:id_danh_gia)
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const { id_danh_gia } = req.params;

  // Bắt buộc dùng transaction
  const result = await sequelize.transaction(async (t) => {
    // 1. Tìm đánh giá để biết nó thuộc món ăn nào
    const review = await Review.findByPk(id_danh_gia, { transaction: t });
    if (!review) {
      throw new Error("Không tìm thấy đánh giá.");
    }
    const { id_mon } = review;

    // 2. Xóa đánh giá
    await review.destroy({ transaction: t });

    // 3. Cập nhật lại điểm trung bình cho món ăn đó
    await updateProductRating(id_mon, t);

    return true;
  });

  if (result) {
    res.status(200).json({ success: true, message: "Đã xóa đánh giá thành công." });
  } else {
    // Trường hợp 'throw new Error' ở trên
    res.status(404).json({ success: false, message: "Không tìm thấy đánh giá." });
  }
});