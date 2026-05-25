import fs from "fs";
import path from "path";

// ── 常量 ──
export const MAX_NAME_LEN = 24;
export const MAX_ROOM_NAME = 32;
export const MAX_ROOMS = 50;
export const MAX_USERS_ROOM = 20;

// ── 接口定义 ──
export interface User {
  name: string;
  muted: boolean;
  socketId: string;
}

export interface Room {
  users: Map<string, User>;
  messages: Message[];
  owner: string | null;
  defaultMuted: boolean;
  isPrivate: boolean;
}

export interface Message {
  id: string;
  socketId: string;
  name: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  ts: number;
}

// ── 持久化配置 ──
const DATA_DIR = process.env.NODE_ENV === "production"
  ? path.join(__dirname, "..", "..", "data")
  : path.join(__dirname, "..", "..");
const CHANNELS_FILE = path.join(DATA_DIR, "channels.json");
const CHAT_DIR = path.join(DATA_DIR, "chat");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true });

interface ChannelChatFile {
  name: string;
  createdAt: string;
  deletedAt: string | null;
  messages: Message[];
}

// ── 输入清理 ──
export function sanitiseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s || s.length > MAX_NAME_LEN) return null;
  if (["__proto__", "constructor", "prototype", "toString", "valueOf"].includes(s)) return null;
  return s;
}

export function sanitiseRoomName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s || s.length > MAX_ROOM_NAME) return null;
  if (["__proto__", "constructor", "prototype", "toString", "valueOf"].includes(s)) return null;
  return s;
}

// ── 房间管理 ──
export const rooms: Record<string, Room> = Object.create(null);
export const typingUsers: Record<string, Set<string>> = Object.create(null);

interface ChannelMeta {
  name: string;
  defaultMuted: boolean;
  isPrivate: boolean;
  owner: string | null;
}

function loadChannels(): ChannelMeta[] {
  try {
    if (!fs.existsSync(CHANNELS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
    if (!Array.isArray(raw)) return [];
    // 兼容旧格式（纯字符串数组）
    return raw
      .map(n => {
        if (typeof n === "string") return { name: sanitiseRoomName(n), defaultMuted: false, isPrivate: false, owner: null };
        return { name: sanitiseRoomName(n.name), defaultMuted: !!n.defaultMuted, isPrivate: !!n.isPrivate, owner: n.owner || null };
      })
      .filter((n): n is ChannelMeta => n.name !== null)
      .slice(0, MAX_ROOMS);
  } catch (e: unknown) {
    console.error("加载频道失败:", e instanceof Error ? e.message : e);
    return [];
  }
}

export function saveChannels(): void {
  try {
    const data = Object.entries(rooms).map(([name, room]) => ({
      name,
      defaultMuted: room.defaultMuted,
      isPrivate: room.isPrivate,
      owner: room.owner,
    }));
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2));
  } catch (e: unknown) {
    console.error("保存频道失败:", e instanceof Error ? e.message : e);
  }
}

function chatFilePath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
  return path.join(CHAT_DIR, `${safe}.json`);
}

function loadChannelChat(name: string): Message[] {
  try {
    const fp = chatFilePath(name);
    if (!fs.existsSync(fp)) return [];
    const raw: ChannelChatFile = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (raw.deletedAt) return [];
    return Array.isArray(raw.messages) ? raw.messages : [];
  } catch {
    return [];
  }
}

export function saveChannelChat(name: string): void {
  try {
    const room = rooms[name];
    if (!room || room.isPrivate) return;
    const fp = chatFilePath(name);
    const data: ChannelChatFile = {
      name,
      createdAt: fs.existsSync(fp)
        ? (JSON.parse(fs.readFileSync(fp, "utf8")).createdAt || new Date().toISOString())
        : new Date().toISOString(),
      deletedAt: null,
      messages: room.messages,
    };
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  } catch (e: unknown) {
    console.error("保存频道消息失败:", e instanceof Error ? e.message : e);
  }
}

export function markChannelDeleted(name: string): void {
  try {
    const fp = chatFilePath(name);
    if (fs.existsSync(fp)) {
      const raw: ChannelChatFile = JSON.parse(fs.readFileSync(fp, "utf8"));
      raw.deletedAt = new Date().toISOString();
      fs.writeFileSync(fp, JSON.stringify(raw, null, 2));
    }
    // 重命名文件以区分同名频道
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    const newPath = path.join(CHAT_DIR, `${safe}_deleted_${ts}.json`);
    if (fs.existsSync(fp)) fs.renameSync(fp, newPath);
  } catch (e: unknown) {
    console.error("标记频道删除失败:", e instanceof Error ? e.message : e);
  }
}

// 初始化加载频道和消息
for (const meta of loadChannels()) {
  rooms[meta.name] = { users: new Map(), messages: loadChannelChat(meta.name), owner: meta.owner, defaultMuted: meta.defaultMuted, isPrivate: meta.isPrivate };
  typingUsers[meta.name] = new Set();
}
console.log(`[~] 已加载 ${Object.keys(rooms).length} 个频道:`, Object.keys(rooms));

export function getRoomList() {
  return Object.entries(rooms).map(([id, room]) => ({
    id, name: id, count: room.users.size,
    users: Array.from(room.users.values()),
    owner: room.owner,
    defaultMuted: room.defaultMuted,
    isPrivate: room.isPrivate,
  }));
}

export function getRoomUsers(roomId: string): User[] {
  const room = rooms[roomId];
  if (!room) return [];
  return Array.from(room.users.values());
}
