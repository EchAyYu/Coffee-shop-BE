import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Account from "../models/Account.js";
import Customer from "../models/Customer.js";

const JWT_SECRET = "secret_key"; // ⚠️ bạn nên lưu trong .env

// Đăng ký
export async function register(req, res) {
  try {
    const { ten_dn, mat_khau, ho_ten, email, sdt, dia_chi } = req.body;

    const hash = await bcrypt.hash(mat_khau, 10);

    const account = await Account.create({ ten_dn, mat_khau: hash, role: "customer" });
    const customer = await Customer.create({
      ho_ten,
      email,
      sdt,
      dia_chi,
      id_tk: account.id_tk,
    });

    res.json({ message: "Đăng ký thành công", account, customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Đăng nhập
export async function login(req, res) {
  try {
    const { ten_dn, mat_khau } = req.body;

    const account = await Account.findOne({ where: { ten_dn } });
    if (!account) return res.status(401).json({ message: "Sai tài khoản" });

    const valid = await bcrypt.compare(mat_khau, account.mat_khau);
    if (!valid) return res.status(401).json({ message: "Sai mật khẩu" });

    const token = jwt.sign({ id: account.id_tk, role: account.role }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ token, account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
}
