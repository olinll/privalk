import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { upload, getFileInfo } from "../services/file.service";

const router = Router();

// ── 文件上传接口 ──
router.post("/", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "没有上传文件" });

  const fileInfo = getFileInfo(req.file);
  res.json(fileInfo);
}, (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "文件太大（最大50MB）" });
    return res.status(400).json({ error: error.message });
  }
  if (error) return res.status(400).json({ error: error.message });
  next();
});

export default router;
