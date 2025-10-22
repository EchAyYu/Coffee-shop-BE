import HomeContent from "../models/HomeContent.js";

// 🔹 Lấy danh sách nội dung
export const getAllContents = async (req, res) => {
  try {
    const contents = await HomeContent.findAll({ order: [["order", "ASC"]] });
    res.json(contents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Thêm nội dung mới
export const createContent = async (req, res) => {
  try {
    const { title, description, imageUrl, order } = req.body;
    const newContent = await HomeContent.create({ title, description, imageUrl, order });
    res.status(201).json(newContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Cập nhật nội dung theo ID
export const updateContent = async (req, res) => {
  try {
    const content = await HomeContent.findByPk(req.params.id);
    if (!content) return res.status(404).json({ message: "Content not found" });

    await content.update(req.body);
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Xóa nội dung
export const deleteContent = async (req, res) => {
  try {
    const content = await HomeContent.findByPk(req.params.id);
    if (!content) return res.status(404).json({ message: "Content not found" });

    await content.destroy();
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
