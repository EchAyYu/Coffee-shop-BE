import Customer from "../models/Customer.js";
import { composeFullAddress } from "../utils/address.js";

function userIdFromReq(req) {
  return req.user?.id_tk || req.user?.id;
}

export async function getMyCheckoutProfile(req, res) {
  const id_tk = userIdFromReq(req);
  if (!id_tk) return res.status(401).json({ success: false, message: "UNAUTHORIZED" });

  const u = await Customer.findOne({
    where: { id_tk },
    attributes: ["id_kh","ho_ten","email","sdt","street","ward","district","province","dia_chi"]
  });

  if (!u) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });

  const full = u.dia_chi || composeFullAddress({
    street: u.street, ward: u.ward, district: u.district, province: u.province || "Cần Thơ"
  });

  return res.json({
    success: true,
    data: {
      user: { id_kh: u.id_kh, fullName: u.ho_ten, email: u.email, phone: u.sdt },
      address: {
        street: u.street || "",
        ward: u.ward || "",
        district: u.district || "",
        province: u.province || "Cần Thơ",
        full
      }
    }
  });
}

export async function updateMyCheckoutProfile(req, res) {
  const id_tk = userIdFromReq(req);
  if (!id_tk) return res.status(401).json({ success: false, message: "UNAUTHORIZED" });

  const { fullName, phone, street, ward, district, province = "Cần Thơ" } = req.body || {};
  const payload = {};

  if (typeof fullName === "string") payload.ho_ten = fullName;
  if (typeof phone === "string")    payload.sdt    = phone;
  if (street !== undefined)   payload.street   = street;
  if (ward !== undefined)     payload.ward     = ward;
  if (district !== undefined) payload.district = district;
  payload.province = province;

  payload.dia_chi = composeFullAddress({
    street: payload.street, ward: payload.ward, district: payload.district, province: payload.province
  });

  const [n] = await Customer.update(payload, { where: { id_tk } });
  if (!n) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });

  return res.json({ success: true });
}
