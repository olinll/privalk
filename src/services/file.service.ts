import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// ── 常量 ──
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ── 上传目录配置 ──
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── 存储配置 ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// ── 文件过滤 ──
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/ogg",
    "audio/mpeg", "audio/wav", "audio/ogg",
    "application/pdf", "application/zip", "application/x-rar-compressed",
    "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("文件类型不允许"));
};

// ── Multer 实例 ──
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

// ── 文件信息接口 ──
export interface FileInfo {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
}

// ── 获取文件信息 ──
export function getFileInfo(file: Express.Multer.File): FileInfo {
  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`
  };
}

// ── 检查文件类型 ──
export function isImage(mimetype: string): boolean {
  return mimetype.startsWith("image/");
}

export function isVideo(mimetype: string): boolean {
  return mimetype.startsWith("video/");
}

export function isAudio(mimetype: string): boolean {
  return mimetype.startsWith("audio/");
}

// ── 获取上传目录路径 ──
export function getUploadDir(): string {
  return UPLOAD_DIR;
}
