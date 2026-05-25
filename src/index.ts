import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

// 导入服务
import {
  rooms,
  typingUsers,
  saveChannels,
  markChannelDeleted,
  getRoomList,
  getRoomUsers,
  sanitiseName,
  sanitiseRoomName,
  MAX_ROOMS,
  MAX_USERS_ROOM
} from "./services/room.service";

import {
  sanitiseText,
  makeRateLimiter,
  createMessage,
  addMessageToRoom,
  getRoomMessages,
  setTyping,
  getTypingUsers
} from "./services/chat.service";

import { getUploadDir } from "./services/file.service";

// 导入路由
import uploadRouter from "./routes/upload.route";

// 导入 Socket.io 类型
import { Socket } from "socket.io";

// ── 自定义 Socket 接口 ──
interface CustomSocket extends Socket {
  currentRoom?: string;
  userName?: string;
}

// ── 创建 Express 应用 ──
const app = express();
const server = http.createServer(app);

// ── 安全头 ──
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "connect-src 'self' wss: ws:; " +
    "media-src *; " +
    "img-src 'self' data:;"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// ── 静态文件和路由 ──
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(getUploadDir()));
app.use("/upload", uploadRouter);

// ── Socket.io 配置 ──
const io = new Server(server, {
  cors: {
    origin: true, // 允许所有来源（私有部署）
    methods: ["GET", "POST"],
  },
});

// ── Socket 连接处理 ──
io.on("connection", (socket: CustomSocket) => {
  console.log(`[+] 已连接: ${socket.id}`);
  socket.emit("room-list", getRoomList());

  const rateCheck = makeRateLimiter();

  const guard = (fn: (...args: any[]) => void) => (...args: any[]) => {
    if (!rateCheck()) {
      console.warn(`[!] 超出速率限制: ${socket.id}`);
      socket.emit("error-msg", "请求过多，请稍后再试。");
      return;
    }
    try { fn(...args); } catch (e: unknown) { console.error("处理错误:", e instanceof Error ? e.message : e); }
  };

  // ── 创建频道 ──
  socket.on("create-room", guard(({ roomName, defaultMuted, isPrivate }: { roomName: string; defaultMuted?: boolean; isPrivate?: boolean }, cb: Function) => {
    if (typeof cb !== "function") return;
    const name = sanitiseRoomName(roomName);
    if (!name) return cb({ error: "频道名称无效" });
    if (rooms[name]) return cb({ error: "频道已存在" });
    if (Object.keys(rooms).length >= MAX_ROOMS) return cb({ error: "已达到最大频道数" });

    rooms[name] = { users: new Map(), messages: [], owner: null, defaultMuted: !!defaultMuted, isPrivate: !!isPrivate };
    typingUsers[name] = new Set();
    saveChannels();
    io.emit("room-list", getRoomList());
    cb({ ok: true });
  }));

  // ── 加入频道 ──
  socket.on("join-room", guard(({ roomId, userName }: { roomId: string; userName: string }) => {
    const cleanRoom = sanitiseRoomName(roomId);
    const cleanName = sanitiseName(userName);
    if (!cleanRoom || !cleanName) return;

    if (socket.currentRoom) leaveRoom(socket);

    if (!rooms[cleanRoom]) {
      if (Object.keys(rooms).length >= MAX_ROOMS) return;
      rooms[cleanRoom] = { users: new Map(), messages: [], owner: null, defaultMuted: false, isPrivate: false };
      typingUsers[cleanRoom] = new Set();
    }
    if (!typingUsers[cleanRoom]) typingUsers[cleanRoom] = new Set();

    const room = rooms[cleanRoom];
    if (room.users.size >= MAX_USERS_ROOM) return;

    const existingUsers = Array.from(room.users.keys());
    if (!room.owner) room.owner = cleanName;

    room.users.set(socket.id, { name: cleanName, muted: false, socketId: socket.id });
    socket.currentRoom = cleanRoom;
    socket.userName = cleanName;
    socket.join(cleanRoom);

    socket.emit("room-joined", {
      roomId: cleanRoom,
      peers: existingUsers,
      users: getRoomUsers(cleanRoom),
      messages: getRoomMessages(cleanRoom),
      owner: room.owner,
      defaultMuted: room.defaultMuted,
      isPrivate: room.isPrivate,
    });

    socket.to(cleanRoom).emit("user-joined", {
      socketId: socket.id, name: cleanName,
      users: getRoomUsers(cleanRoom),
      owner: room.owner,
    });

    io.emit("room-list", getRoomList());
    console.log(`[~] ${cleanName} 加入: ${cleanRoom}`);
  }));

  // ── 聊天消息 ──
  socket.on("chat-message", guard(({ text, fileUrl, fileName, fileType }: { text: string; fileUrl?: string; fileName?: string; fileType?: string }) => {
    if (!socket.currentRoom || !rooms[socket.currentRoom]) return;
    const cleanText = sanitiseText(text);
    if (!cleanText && !fileUrl) return;

    const msg = createMessage(
      socket.id,
      socket.userName || "匿名",
      cleanText || "",
      fileUrl,
      fileName,
      fileType
    );

    addMessageToRoom(socket.currentRoom, msg);

    io.to(socket.currentRoom).emit("chat-message", msg);
    io.to(socket.currentRoom).emit("typing-update", {
      users: getTypingUsers(socket.currentRoom)
    });
  }));

  // ── 输入状态 ──
  socket.on("typing", guard(({ isTyping }: { isTyping: boolean }) => {
    if (!socket.currentRoom || !socket.userName) return;
    if (typeof isTyping !== "boolean") return;

    setTyping(socket.currentRoom, socket.userName, isTyping);

    socket.to(socket.currentRoom).emit("typing-update", {
      users: getTypingUsers(socket.currentRoom, socket.userName)
    });
  }));

  // ── 踢出用户 ──
  socket.on("kick-user", guard(({ targetSocketId }: { targetSocketId: string }, cb: Function) => {
    if (typeof cb !== "function") return;
    const roomId = socket.currentRoom;
    if (!roomId || !rooms[roomId]) return cb({ error: "未在频道中" });
    if (rooms[roomId].owner !== socket.userName) return cb({ error: "没有权限" });
    if (typeof targetSocketId !== "string") return cb({ error: "目标无效" });
    if (targetSocketId === socket.id) return cb({ error: "不能踢出自己" });

    const targetSocket = io.sockets.sockets.get(targetSocketId) as CustomSocket | undefined;
    if (!targetSocket || targetSocket.currentRoom !== roomId) return cb({ error: "用户不在此频道" });

    const targetName = targetSocket.userName;
    targetSocket.emit("kicked", { roomId, by: socket.userName });
    leaveRoom(targetSocket);
    io.to(roomId).emit("user-kicked", {
      name: targetName,
      users: getRoomUsers(roomId),
      owner: rooms[roomId]?.owner,
    });
    cb({ ok: true });
  }));

  // ── 重命名频道 ──
  socket.on("rename-channel", guard(({ roomId, newName }: { roomId: string; newName: string }, cb: Function) => {
    if (typeof cb !== "function") return;
    const cleanOld = sanitiseRoomName(roomId);
    const cleanNew = sanitiseRoomName(newName);
    if (!cleanOld || !cleanNew) return cb({ error: "名称无效" });
    if (!rooms[cleanOld]) return cb({ error: "频道不存在" });
    if (rooms[cleanOld].owner !== socket.userName) return cb({ error: "没有权限" });
    if (cleanOld === cleanNew) return cb({ error: "名称相同" });
    if (rooms[cleanNew]) return cb({ error: "名称已被占用" });

    rooms[cleanNew] = { ...rooms[cleanOld], users: rooms[cleanOld].users, messages: rooms[cleanOld].messages };
    delete rooms[cleanOld];
    if (typingUsers[cleanOld]) {
      typingUsers[cleanNew] = typingUsers[cleanOld];
      delete typingUsers[cleanOld];
    }

    for (const [, s] of io.sockets.sockets) {
      const cs = s as CustomSocket;
      if (cs.currentRoom === cleanOld) cs.currentRoom = cleanNew;
    }

    saveChannels();
    io.emit("room-list", getRoomList());
    io.to(cleanNew).emit("channel-renamed", { oldId: cleanOld, newId: cleanNew });
    cb({ ok: true });
  }));

  // ── 删除频道 ──
  socket.on("delete-channel", guard(({ roomId }: { roomId: string }, cb: Function) => {
    if (typeof cb !== "function") return;
    const cleanRoom = sanitiseRoomName(roomId);
    if (!cleanRoom) return cb({ error: "频道名称无效" });
    if (!rooms[cleanRoom]) return cb({ error: "频道不存在" });
    if (rooms[cleanRoom].owner !== socket.userName) return cb({ error: "没有权限" });

    io.to(cleanRoom).emit("channel-deleted", { roomId: cleanRoom });
    markChannelDeleted(cleanRoom);
    delete rooms[cleanRoom];
    if (typingUsers[cleanRoom]) delete typingUsers[cleanRoom];
    saveChannels();
    io.emit("room-list", getRoomList());
    cb({ ok: true });
  }));

  // ── WebRTC信令 ──
  socket.on("offer", guard(({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
    if (typeof to !== "string" || !offer || typeof offer !== "object") return;
    const targetSocket = io.sockets.sockets.get(to) as CustomSocket | undefined;
    if (!targetSocket || targetSocket.currentRoom !== socket.currentRoom) return;
    io.to(to).emit("offer", { from: socket.id, offer });
  }));

  socket.on("answer", guard(({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
    if (typeof to !== "string" || !answer || typeof answer !== "object") return;
    const targetSocket = io.sockets.sockets.get(to) as CustomSocket | undefined;
    if (!targetSocket || targetSocket.currentRoom !== socket.currentRoom) return;
    io.to(to).emit("answer", { from: socket.id, answer });
  }));

  socket.on("ice-candidate", guard(({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
    if (typeof to !== "string") return;
    const targetSocket = io.sockets.sockets.get(to) as CustomSocket | undefined;
    if (!targetSocket || targetSocket.currentRoom !== socket.currentRoom) return;
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  }));

  // ── 静音 ──
  socket.on("toggle-mute", guard(({ muted }: { muted: boolean }) => {
    if (!socket.currentRoom || !rooms[socket.currentRoom]) return;
    if (typeof muted !== "boolean") return;
    const user = rooms[socket.currentRoom].users.get(socket.id);
    if (user) {
      user.muted = muted;
      io.to(socket.currentRoom).emit("user-muted", {
        socketId: socket.id, muted,
        users: getRoomUsers(socket.currentRoom),
      });
    }
  }));

  // ── 重命名用户 ──
  socket.on("rename-user", guard(({ newName }: { newName: string }, cb: Function) => {
    if (typeof cb !== "function") return;
    const cleanName = sanitiseName(newName);
    if (!cleanName) return cb({ error: "名称无效" });
    if (cleanName === socket.userName) return cb({ error: "名称未改变" });

    const oldName = socket.userName;
    socket.userName = cleanName;

    if (socket.currentRoom && rooms[socket.currentRoom]) {
      const room = rooms[socket.currentRoom];
      const user = room.users.get(socket.id);
      if (user) {
        user.name = cleanName;
        if (room.owner === oldName) room.owner = cleanName;
        if (typingUsers[socket.currentRoom]?.has(oldName || "")) {
          typingUsers[socket.currentRoom].delete(oldName || "");
          typingUsers[socket.currentRoom].add(cleanName);
        }
        io.to(socket.currentRoom).emit("user-renamed", {
          socketId: socket.id,
          oldName,
          newName: cleanName,
          users: getRoomUsers(socket.currentRoom),
          owner: room.owner,
        });
      }
      io.emit("room-list", getRoomList());
    }

    cb({ ok: true });
  }));

  // ── 离开/断开 ──
  socket.on("leave-room", guard(() => leaveRoom(socket)));
  socket.on("disconnect", () => {
    console.log(`[-] 已断开: ${socket.id}`);
    leaveRoom(socket);
  });

  function leaveRoom(sock: CustomSocket): void {
    const roomId = sock.currentRoom;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    const leavingName = sock.userName;
    room.users.delete(sock.id);

    if (typingUsers[roomId]) {
      typingUsers[roomId].delete(leavingName || "");
      sock.to(roomId).emit("typing-update", { users: Array.from(typingUsers[roomId]) });
    }

    if (room.owner === leavingName && room.users.size > 0) {
      const nextUser = Array.from(room.users.values())[0];
      room.owner = nextUser.name;
      io.to(roomId).emit("owner-changed", { owner: room.owner, users: getRoomUsers(roomId) });
    } else if (room.users.size === 0) {
      room.owner = null;
    }

    sock.leave(roomId);
    sock.currentRoom = undefined;

    if (room.users.size > 0) {
      sock.to(roomId).emit("user-left", {
        socketId: sock.id,
        users: getRoomUsers(roomId),
        owner: room.owner,
      });
    }
    io.emit("room-list", getRoomList());
  }
});

// ── 获取本地IP地址 ──
function getLocalIPs(): string[] {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部地址和非IPv4地址
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  return ips;
}

// ── 启动服务器 ──
const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, "0.0.0.0", () => {
  const localIPs = getLocalIPs();
  console.log("\n🎙  Privalk 已启动\n");
  console.log(`  本地访问: http://localhost:${PORT}`);
  localIPs.forEach(ip => {
    console.log(`  网络访问: http://${ip}:${PORT}`);
  });
  console.log("");
});

export { app, server, io };
