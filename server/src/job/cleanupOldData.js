// src/jobs/cleanupOldData.js
import cron from "node-cron";
import { Op } from "sequelize";
import db from "../models/index.js";

const { Order, OrderDetail, Reservation } = db;

/**
 * Hàm tính mốc thời gian "bao lâu trước" cần xóa
 * Ví dụ: giữ lại 12 tháng gần nhất
 */
function getCutoffDate(months = 12) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
}

export function initCleanupJobs() {
  // 🕒 Chạy lúc 3h sáng mỗi ngày
  cron.schedule("0 3 * * *", async () => {
    console.log("🧹 [CLEANUP] Bắt đầu dọn dữ liệu cũ...");

    const cutoff = getCutoffDate(12); // 🔧 Đổi 12 thành 6 nếu chỉ muốn giữ 6 tháng

    try {
      // 1️⃣ Lấy danh sách id_don đơn hàng cũ hơn cutoff
      const oldOrders = await Order.findAll({
        where: {
          ngay_dat: { [Op.lt]: cutoff },
        },
        attributes: ["id_don"],
        raw: true,
      });

      const oldOrderIds = oldOrders.map((o) => o.id_don);

      // Nếu có đơn cũ thì xóa chi tiết + đơn
      if (oldOrderIds.length > 0) {
        // Xóa chi tiết đơn trước (nếu FK không có CASCADE)
        const deletedDetails = await OrderDetail.destroy({
          where: { id_don: { [Op.in]: oldOrderIds } },
        });

        const deletedOrders = await Order.destroy({
          where: {
            id_don: { [Op.in]: oldOrderIds },
          },
        });

        console.log(
          `🧾 [CLEANUP] Đã xóa ${deletedOrders} đơn hàng và ${deletedDetails} chi tiết đơn cũ hơn ${cutoff.toISOString().slice(0, 10)}`
        );
      } else {
        console.log("🧾 [CLEANUP] Không có đơn hàng nào quá hạn cần xóa.");
      }

      // 2️⃣ Xóa các đặt bàn cũ hơn cutoff
      const deletedReservations = await Reservation.destroy({
        where: {
          ngay_dat: { [Op.lt]: cutoff },
        },
      });

      if (deletedReservations > 0) {
        console.log(
          `📅 [CLEANUP] Đã xóa ${deletedReservations} đặt bàn cũ hơn ${cutoff.toISOString().slice(0, 10)}`
        );
      } else {
        console.log("📅 [CLEANUP] Không có đặt bàn nào quá hạn cần xóa.");
      }

      console.log("✅ [CLEANUP] Hoàn tất dọn dữ liệu cũ.");
    } catch (err) {
      console.error("❌ [CLEANUP] Lỗi khi dọn dữ liệu cũ:", err);
    }
  });
}
