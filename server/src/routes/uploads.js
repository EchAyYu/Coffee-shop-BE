// server/src/routes/uploads.js
import { Router } from "express";
import multer from "multer";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
// Import hàm uploadToCloudinary mà bạn đã định nghĩa trong utils
import { uploadToCloudinary } from "../utils/cloudinary.js"; 

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * POST /api/uploads/image
 * Upload ảnh lên Cloudinary và trả về URL
 */
router.post("/image", requireAuth, requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Chưa chọn file ảnh" });
    }

    // Upload buffer lên Cloudinary qua Stream
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "coffee-shop",
    });

    // Trả về URL để Frontend sử dụng
    res.json({ 
      success: true, 
      url: result.secure_url, 
      public_id: result.public_id 
    });

  } catch (e) {
    console.error("Upload error:", e);
    next(e);
  }
});

export default router;