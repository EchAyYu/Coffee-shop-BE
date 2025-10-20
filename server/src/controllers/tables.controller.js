// ===============================
// ☕ Coffee Shop Backend - Tables Controller (Full version)
// ===============================

import { Op } from "sequelize";
import Table from "../models/Table.js";

/**
 * 📋 Lấy danh sách bàn (public)
 * Query params: khu_vuc, trang_thai, suc_chua_min
 */
export async function getAllTables(req, res) {
  try {
    const { khu_vuc, trang_thai, suc_chua_min } = req.query;
    const where = {};

    if (khu_vuc && khu_vuc !== "all") where.khu_vuc = khu_vuc;
    if (trang_thai && trang_thai !== "all") where.trang_thai = trang_thai;
    if (suc_chua_min && !isNaN(suc_chua_min))
      where.suc_chua = { [Op.gte]: parseInt(suc_chua_min) };

    const tables = await Table.findAll({
      where,
      order: [["id_ban", "ASC"]],
    });

    console.log(`✅ Lấy danh sách bàn thành công (${tables.length} kết quả)`);

    res.json({
      success: true,
      data: tables,
      count: tables.length,
    });
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách bàn:", err.message);
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách bàn",
      error: err.message,
    });
  }
}

/**
 * 🔍 Lấy chi tiết 1 bàn
 */
export async function getTableById(req, res) {
  try {
    const { id } = req.params;
    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bàn",
      });
    }

    res.json({
      success: true,
      data: table,
    });
  } catch (err) {
    console.error("❌ Lỗi lấy chi tiết bàn:", err.message);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin bàn",
      error: err.message,
    });
  }
}

/**
 * ➕ Tạo bàn mới (Admin)
 */
export async function createTable(req, res) {
  try {
    const { so_ban, ten_ban, khu_vuc, suc_chua, hinh_anh, mo_ta, gia_dat_ban } =
      req.body;

    // Kiểm tra trùng số bàn
    const existing = await Table.findOne({ where: { so_ban } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Bàn số ${so_ban} đã tồn tại`,
      });
    }

    const newTable = await Table.create({
      so_ban,
      ten_ban,
      khu_vuc: khu_vuc || "main",
      suc_chua: suc_chua || 4,
      hinh_anh:
        hinh_anh ||
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
      mo_ta: mo_ta || "Không có mô tả",
      gia_dat_ban: gia_dat_ban || 0,
      trang_thai: "available",
    });

    res.status(201).json({
      success: true,
      message: "Tạo bàn thành công",
      data: newTable,
    });
  } catch (err) {
    console.error("❌ Lỗi tạo bàn:", err.message);
    res.status(500).json({
      success: false,
      message: "Lỗi tạo bàn",
      error: err.message,
    });
  }
}

/**
 * ✏️ Cập nhật thông tin bàn
 */
export async function updateTable(req, res) {
  try {
    const { id } = req.params;
    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bàn",
      });
    }

    await table.update(req.body);

    res.json({
      success: true,
      message: "Cập nhật bàn thành công",
      data: table,
    });
  } catch (err) {
    console.error("❌ Lỗi cập nhật bàn:", err.message);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật bàn",
      error: err.message,
    });
  }
}

/**
 * 🗑️ Xóa bàn
 */
export async function deleteTable(req, res) {
  try {
    const { id } = req.params;
    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bàn",
      });
    }

    await table.destroy();

    res.json({
      success: true,
      message: "Xóa bàn thành công",
    });
  } catch (err) {
    console.error("❌ Lỗi xóa bàn:", err.message);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa bàn",
      error: err.message,
    });
  }
}

/**
 * 🔄 Cập nhật trạng thái bàn
 */
export async function updateTableStatus(req, res) {
  try {
    const { id } = req.params;
    const { trang_thai } = req.body;

    const validStatuses = [
      "available",
      "occupied",
      "reserved",
      "maintenance",
    ];

    if (!validStatuses.includes(trang_thai)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(
          ", "
        )}`,
      });
    }

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bàn",
      });
    }

    await table.update({ trang_thai });

    res.json({
      success: true,
      message: "Cập nhật trạng thái bàn thành công",
      data: table,
    });
  } catch (err) {
    console.error("❌ Lỗi cập nhật trạng thái bàn:", err.message);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật trạng thái bàn",
      error: err.message,
    });
  }
}
