import { Op } from "sequelize";
import db from "../models/index.js"; // Import db để lấy các model
import { sendOrderConfirmationEmail } from "../utils/mailer.js"; // 💡 Import hàm gửi mail

const { Order, OrderDetail, Product, Customer } = db; // Lấy các model từ db

// Trạng thái đơn hàng hợp lệ cho admin update
const ALLOWED_STATUS_UPDATE = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED"]; // Bổ sung PENDING_PAYMENT

/**
 * 🛒 Khách hàng hoặc khách vãng lai tạo đơn hàng mới
 * POST /api/orders
 */
export async function createOrder(req, res) {
  // Lấy thông tin từ request body
  const { ho_ten_nhan, sdt_nhan, dia_chi_nhan, email_nhan, pttt, ghi_chu, items } = req.body;
  const user = req.user; // Lấy thông tin user từ middleware requireAuth (nếu có)

  let customer = null;
  let id_kh = null;

  // Nếu user đã đăng nhập, tìm thông tin customer tương ứng
  if (user?.id_tk) {
    try {
      customer = await Customer.findOne({ where: { id_tk: user.id_tk } });
      if (customer) {
        id_kh = customer.id_kh;
      } else {
         console.warn(`Không tìm thấy Customer cho Account ID: ${user.id_tk}`);
      }
    } catch (findErr) {
       console.error(`Lỗi tìm Customer cho Account ID: ${user.id_tk}`, findErr);
    }
  }

  // --- Tính toán tổng tiền & Kiểm tra sản phẩm ---
  let calculatedTotal = 0;
  const productDetails = []; // Lưu chi tiết sản phẩm để tạo OrderDetail

  try {
    const productIds = items.map(item => item.id_mon);
    const productsInDb = await Product.findAll({
      where: { id_mon: { [Op.in]: productIds } },
      attributes: ['id_mon', 'gia', 'ten_mon'] // Chỉ lấy các trường cần thiết
    });

    // Tạo map để dễ dàng truy xuất giá
    const productMap = new Map(productsInDb.map(p => [p.id_mon, { gia: p.gia, ten_mon: p.ten_mon }]));

    for (const item of items) {
      const productInfo = productMap.get(item.id_mon);
      if (!productInfo) {
        return res.status(400).json({ success: false, message: `Sản phẩm với ID ${item.id_mon} không tồn tại.` });
      }
      const itemPrice = parseFloat(productInfo.gia); // Lấy giá từ DB
      const itemTotal = itemPrice * item.so_luong;
      calculatedTotal += itemTotal;
      productDetails.push({
        id_mon: item.id_mon,
        so_luong: item.so_luong,
        gia: itemPrice, // Lưu giá tại thời điểm đặt hàng
        Product: { ten_mon: productInfo.ten_mon } // Thêm tên món để gửi mail
      });
    }
  } catch (dbError) {
    console.error("❌ Lỗi truy vấn sản phẩm:", dbError);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi kiểm tra sản phẩm." });
  }

  // --- Tạo đơn hàng ---
  let newOrder;
  try {
    newOrder = await Order.create({
      id_kh: id_kh, // Liên kết với khách hàng nếu đã đăng nhập
      ho_ten_nhan,
      sdt_nhan,
      dia_chi_nhan,
      email_nhan,
      pttt,
      ghi_chu,
      // 💡 Quyết định trạng thái dựa trên PTTT
      trang_thai: pttt === 'BANK_TRANSFER' ? 'pending_payment' : 'pending',
      tong_tien: calculatedTotal, // Lưu tổng tiền đã tính toán
    });

    // --- Tạo chi tiết đơn hàng ---
    // Thêm id_don vào từng item trong productDetails
    const orderDetailData = productDetails.map(detail => ({
      ...detail,
      id_don: newOrder.id_don,
    }));

    await OrderDetail.bulkCreate(orderDetailData);

    // --- Gửi email xác nhận ---
    // Gọi hàm gửi mail (không cần chờ, chạy ngầm)
    sendOrderConfirmationEmail(newOrder.toJSON(), productDetails);

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công!",
      data: {
        id_don: newOrder.id_don,
        trang_thai: newOrder.trang_thai,
        tong_tien: newOrder.tong_tien,
      },
    });

  } catch (err) {
    console.error("❌ Lỗi tạo đơn hàng hoặc chi tiết đơn hàng:", err);
    // Nếu có lỗi sau khi tạo Order, cần cân nhắc xóa Order đã tạo (rollback)
    if (newOrder && newOrder.id_don) {
      try {
        await Order.destroy({ where: { id_don: newOrder.id_don } });
        console.log(`Đã rollback đơn hàng #${newOrder.id_don}`);
      } catch (rollbackErr) {
        console.error(`Lỗi rollback đơn hàng #${newOrder.id_don}:`, rollbackErr);
      }
    }
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo đơn hàng." });
  }
}


/**
 * 📊 Admin lấy danh sách đơn hàng (có phân trang, lọc)
 * GET /api/orders/list?status=&from=&to=&q=&page=&limit=
 */
export async function getOrdersAdmin(req, res) {
  try {
    const { status, from, to, q, page = 1, limit = 10 } = req.query; // Giới hạn mặc định là 10
    const where = {};

    // Lọc theo trạng thái (chuyển sang chữ thường nếu model dùng chữ thường)
    if (status) {
       // Kiểm tra xem status có hợp lệ không nếu cần
       where.trang_thai = status.toLowerCase();
    }
    // Lọc theo ngày đặt
    if (from || to) {
      where.ngay_dat = {
        ...(from ? { [Op.gte]: new Date(from) } : {}),
        ...(to ? { [Op.lte]: new Date(to) } : {}),
      };
    }
    // Tìm kiếm (tên, sđt, địa chỉ)
    if (q) {
      where[Op.or] = [
        { ho_ten_nhan: { [Op.like]: `%${q}%` } },
        { sdt_nhan: { [Op.like]: `%${q}%` } },
        { dia_chi_nhan: { [Op.like]: `%${q}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: Customer, attributes: ['id_kh', 'ho_ten', 'email'] }, // Lấy thông tin khách hàng nếu có
        {
          model: OrderDetail,
          required: false, // Left join để vẫn lấy được đơn hàng dù không có chi tiết
          include: [{ model: Product, attributes: ["id_mon", "ten_mon"] }] // Lấy tên món
        }
      ],
      order: [["ngay_dat", "DESC"]], // Sắp xếp mới nhất trước
      limit: Number(limit),
      offset,
      distinct: true, // Cần thiết khi dùng include và limit/offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: Number(page),
        totalPages: Math.ceil(count / Number(limit)),
        limit: Number(limit),
      }
    });
  } catch (e) {
    console.error("❌ Lỗi [getOrdersAdmin]:", e);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách đơn hàng." });
  }
}


/**
 * 🏷️ Lấy chi tiết một đơn hàng
 * GET /api/orders/:id
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user; // Lấy thông tin user đăng nhập (nếu có)

    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, attributes: ['id_kh', 'ho_ten', 'email'] },
        {
          model: OrderDetail,
          required: false,
          include: [{ model: Product, attributes: ["id_mon", "ten_mon", "anh"] }] // Lấy ảnh món
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // --- Kiểm tra quyền xem ---
    // Admin hoặc Employee có thể xem mọi đơn
    const isAdminOrEmployee = user?.role === 'admin' || user?.role === 'employee';

    // Nếu không phải admin/employee, kiểm tra xem có phải chủ đơn hàng không
    if (!isAdminOrEmployee) {
       // Cần đảm bảo user đã đăng nhập và đơn hàng có id_kh
       if (!user || !order.id_kh) {
           return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
       }
       // Tìm customer của user đăng nhập
       const customerOfUser = await Customer.findOne({where: {id_tk: user.id_tk}});
       if (!customerOfUser || customerOfUser.id_kh !== order.id_kh) {
           return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
       }
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error(`❌ Lỗi [getOrderById ${req.params.id}]:`, err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy chi tiết đơn hàng." });
  }
}


/**
 * 🔄 Admin/Employee cập nhật trạng thái đơn hàng
 * PUT /api/orders/:id/status
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { trang_thai } = req.body; // Trạng thái mới (chữ thường từ route validation)

    // Validate trạng thái hợp lệ (đã được làm ở route)
    // const validStatuses = ["pending", "pending_payment", "confirmed", "completed", "cancelled"];
    // if (!validStatuses.includes(trang_thai)) { ... } // Không cần lặp lại validation

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // Optional: Thêm logic kiểm tra chuyển đổi trạng thái nếu cần
    // Ví dụ: không cho chuyển từ completed về pending
    const currentStatus = order.trang_thai;
    if (currentStatus === 'completed' && trang_thai !== 'completed') {
       return res.status(400).json({ success: false, message: "Không thể thay đổi trạng thái của đơn hàng đã hoàn thành." });
    }
    if (currentStatus === 'cancelled' && trang_thai !== 'cancelled') {
        return res.status(400).json({ success: false, message: "Không thể thay đổi trạng thái của đơn hàng đã hủy." });
    }


    await order.update({ trang_thai });

    // TODO: Gửi email thông báo cập nhật trạng thái nếu cần

    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: { id_don: order.id_don, trang_thai: order.trang_thai },
    });
  } catch (e) {
    console.error(`❌ Lỗi [updateOrderStatus ${req.params.id}]:`, e);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật trạng thái." });
  }
}


/**
 * 🗑️ Admin/Employee xóa đơn hàng
 * DELETE /api/orders/:id
 */
export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;

    // Nên dùng transaction để đảm bảo xóa cả order và order details
    const result = await sequelize.transaction(async (t) => {
        // Xóa chi tiết đơn hàng trước
        await OrderDetail.destroy({
          where: { id_don: id },
          transaction: t
        });
        // Sau đó xóa đơn hàng
        const deletedOrderRows = await Order.destroy({
          where: { id_don: id },
          transaction: t
        });
        return deletedOrderRows; // Số lượng hàng đã xóa
    });


    if (result === 0) { // Nếu không có hàng nào bị xóa (ID không tồn tại)
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    res.json({ success: true, message: "Đã xóa đơn hàng thành công" });

  } catch (err) {
    console.error(`❌ Lỗi [deleteOrder ${req.params.id}]:`, err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa đơn hàng." });
  }
}
