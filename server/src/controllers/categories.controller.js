import Category from "../models/Category.js";

export async function getAllCategories(req, res) {
  try {
    const cats = await Category.findAll();
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
