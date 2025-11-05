// src/controllers/review.controller.js

import db from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sequelize from "../utils/db.js";      // ⬅️ default import
import { Op } from "sequelize";               // ⬅️ import Op chuẩn

const { Review, Customer, Order, OrderDetail, Product } = db;

/** Cập nhật rating trung bình cho món */
async function updateProductRating(id_mon, transaction) {
  const reviews = await Review.findAll({
    where: { id_mon },
    attributes: ["diem"],
    transaction,
  });

  const rating_count = reviews.length;
  let rating_avg = 0.0;

  if (rating_count > 0) {
    const total_diem = reviews.reduce((sum, r) => sum + Number(r.diem || 0), 0);
    rating_avg = Number((total_diem / rating_count).toFixed(2));
  }

  await Product.update(
    { rating_avg, rating_count },
    { where: { id_mon }, transaction }
  );
}

/** POST /api/reviews */
export const createReview = asyncHandler(async (req, res) => {
  const { id_tk } = req.user;
  const { id_mon, id_don, diem, noi_dung } = req.body;

  // 1) map id_tk -> id_kh
  const customer = await Customer.findOne({ where: { id_tk }, attributes: ["id_kh"] });
  if (!customer) {
    return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ khách hàng." });
  }
  const id_kh = customer.id_kh;

  // 2) kiểm tra đơn thuộc khách này & có chứa món này
  const order = await Order.findOne({
    where: { id_don, id_kh },
    include: [{ model: OrderDetail, where: { id_mon }, required: true }],
  });
  if (!order) {
    return res.status(403).json({ success: false, message: "Bạn không thể đánh giá món ăn bạn chưa mua." });
  }

  // 3) trạng thái hoàn thành
  const orderStatus = String(order.trang_thai || "").toLowerCase();
  if (orderStatus !== "completed" && orderStatus !== "done") {
    return res.status(400).json({ success: false, message: "Chỉ có thể đánh giá đơn hàng đã hoàn thành." });
  }

  // 4) tạo đánh giá + cập nhật rating trong transaction
  try {
    const newReview = await sequelize.transaction(async (t) => {
      const review = await Review.create(
        { id_kh, id_mon, id_don, diem, noi_dung },
        { transaction: t }
      );
      await updateProductRating(id_mon, t);
      return review;
    });

    return res.status(201).json({ success: true, data: newReview });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Bạn đã đánh giá món này cho đơn hàng này rồi." });
    }
    throw err;
  }
});

/** GET /api/reviews/product/:id_mon */
export const getProductReviews = asyncHandler(async (req, res) => {
  const { id_mon } = req.params;

  const reviews = await Review.findAll({
    where: { id_mon },
    include: [{ model: Customer, attributes: ["ho_ten", "anh"] }],
    order: [["ngay_dg", "DESC"]],
  });

  return res.status(200).json({ success: true, data: reviews });
});

/** GET /api/reviews/order-status/:id_don */
export const getReviewStatusForOrder = asyncHandler(async (req, res) => {
  const { id_tk } = req.user;
  const { id_don } = req.params;

  const customer = await Customer.findOne({ where: { id_tk }, attributes: ["id_kh"] });
  if (!customer) {
    return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ khách hàng." });
  }

  const orderDetails = await OrderDetail.findAll({
    where: { id_don },
    attributes: ["id_mon"],
    raw: true,
  });
  const productIds = orderDetails.map((i) => i.id_mon);

  if (productIds.length === 0) {
    return res.status(200).json({ success: true, data: {} });
  }

  const reviews = await Review.findAll({
    where: {
      id_kh: customer.id_kh,
      id_don,
      id_mon: { [Op.in]: productIds },   // ⬅️ dùng Op.in
    },
    attributes: ["id_mon"],
    raw: true,
  });

  const reviewed = new Set(reviews.map((r) => r.id_mon));
  const statusMap = {};
  for (const pid of productIds) statusMap[pid] = reviewed.has(pid);

  return res.status(200).json({ success: true, data: statusMap });
});
