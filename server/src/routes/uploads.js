import { Router } from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import { requireAuth, requireAdmin } from "../middlewares/authMiddleware.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /uploads/image:
 *   post:
 *     summary: Admin upload image (Cloudinary)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: OK }
 */
router.post("/image", requireAuth, requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    const fileBuffer = req.file.buffer;
    const base64 = `data:${req.file.mimetype};base64,${fileBuffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64, { folder: "coffee-shop" });
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (e) { next(e); }
});

export default router;
