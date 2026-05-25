import { rooms, typingUsers, Message, getRoomUsers } from "./room.service";

// ── 常量 ──
export const MAX_MSG_LEN = 500;
export const RATE_WINDOW_MS = 5000;
export const RATE_MAX_EVENTS = 30;

// ── 输入清理 ──
export function sanitiseText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > MAX_MSG_LEN) return null;
  return s;
}

// ── 速率限制器 ──
export function makeRateLimiter() {
  let count = 0, resetAt = Date.now() + RATE_WINDOW_MS;
  return function check(): boolean {
    const now = Date.now();
    if (now > resetAt) { count = 0; resetAt = now + RATE_WINDOW_MS; }
    return ++count <= RATE_MAX_EVENTS;
  };
}

// ── 消息处理 ──
export function createMessage(
  socketId: string,
  userName: string,
  text: string,
  fileUrl?: string,
  fileName?: string,
  fileType?: string
): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    socketId,
    name: userName || "匿名",
    text: text || "",
    fileUrl,
    fileName,
    fileType,
    ts: Date.now(),
  };
}

export function addMessageToRoom(roomId: string, message: Message): void {
  if (!rooms[roomId]) return;

  rooms[roomId].messages.push(message);
  if (rooms[roomId].messages.length > 200) {
    rooms[roomId].messages.shift();
  }

  // 清除输入状态
  if (typingUsers[roomId]) {
    typingUsers[roomId].delete(message.name);
  }
}

export function getRoomMessages(roomId: string, limit: number = 50): Message[] {
  if (!rooms[roomId]) return [];
  return rooms[roomId].messages.slice(-limit);
}

// ── 输入状态管理 ──
export function setTyping(roomId: string, userName: string, isTyping: boolean): void {
  if (!typingUsers[roomId]) return;

  if (isTyping) {
    typingUsers[roomId].add(userName);
  } else {
    typingUsers[roomId].delete(userName);
  }
}

export function getTypingUsers(roomId: string, excludeUser?: string): string[] {
  if (!typingUsers[roomId]) return [];
  return Array.from(typingUsers[roomId]).filter(n => n !== excludeUser);
}
