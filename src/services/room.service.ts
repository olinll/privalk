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

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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

function loadChannels(): string[] {
  try {
    if (!fs.existsSync(CHANNELS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map(n => sanitiseRoomName(n))
      .filter((n): n is string => n !== null)
      .slice(0, MAX_ROOMS);
  } catch (e: unknown) {
    console.error("加载频道失败:", e instanceof Error ? e.message : e);
    return [];
  }
}

export function saveChannels(): void {
  try {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(Object.keys(rooms), null, 2));
  } catch (e: unknown) {
    console.error("保存频道失败:", e instanceof Error ? e.message : e);
  }
}

// 初始化加载频道
for (const name of loadChannels()) {
  rooms[name] = { users: new Map(), messages: [], owner: null, defaultMuted: false };
  typingUsers[name] = new Set();
}
console.log(`[~] 已加载 ${Object.keys(rooms).length} 个频道:`, Object.keys(rooms));

export function getRoomList() {
  return Object.entries(rooms).map(([id, room]) => ({
    id, name: id, count: room.users.size,
    users: Array.from(room.users.values()),
    owner: room.owner,
    defaultMuted: room.defaultMuted,
  }));
}

export function getRoomUsers(roomId: string): User[] {
  const room = rooms[roomId];
  if (!room) return [];
  return Array.from(room.users.values());
}
