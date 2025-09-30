import Category from "../models/Category.js";

// Lấy tất cả danh mục
export async function getAllCategories(req, res) {
  try {
    const categories = await Category.findAll();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Lấy 1 danh mục theo id
export async function getCategoryById(req, res) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Thêm danh mục
export async function createCategory(req, res) {
  try {
    const { ten_dm, anh } = req.body;
    if (!ten_dm) return res.status(400).json({ message: "Tên danh mục bắt buộc" });

    const newCategory = await Category.create({ ten_dm, anh });
    res.status(201).json(newCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Cập nhật danh mục
export async function updateCategory(req, res) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    await category.update(req.body);
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// Xóa danh mục
export async function deleteCategory(req, res) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    await category.destroy();
    res.json({ message: "Đã xóa danh mục" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
