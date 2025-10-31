import { Op } from "sequelize";
import Notification from "../models/Notification.js";

export async function myNotifications(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const unreadOnly = String(req.query.unread_only || "0") === "1";
    const where = { id_tk, ...(unreadOnly ? { is_read: false } : {}) };
    const rows = await Notification.findAll({ where, order: [["created_at", "DESC"]], limit: 50 });
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi lấy thông báo." });
  }
}

export async function markAsRead(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    const { id } = req.params;
    const n = await Notification.findOne({ where: { id, id_tk } });
    if (!n) return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    await n.update({ is_read: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi cập nhật thông báo." });
  }
}

export async function markAllRead(req, res) {
  try {
    const id_tk = req.user?.id_tk || req.user?.id;
    await Notification.update({ is_read: true }, { where: { id_tk, is_read: false } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Lỗi cập nhật tất cả thông báo." });
  }
}
