# Privalk

**你的声音。你的服务器。你的规则。**

Privalk 是一个私密的、自托管的语音和文字聊天应用，专为厌倦了将对话交给大型平台的游戏群体而设计。无需账号。没有广告。数据不会离开你的机器。只有你和你想交谈的人之间的清晰语音聊天和消息传递。

基于 [shynsec/squawk](https://github.com/shynsec/squawk) 的项目进行二次开发。

---

## 为什么选择 Privalk？

大多数语音聊天应用是免费的，因为*你*就是产品。你的对话通过别人的服务器传递，你的数据被记录，你距离失去访问权限只有一个政策变化。

Privalk 反其道而行。你托管它。你控制它。数据不会离开你的服务器。

- **完全私密** — 只有你邀请的人才能访问
- **自托管** — 运行在你的机器、Proxmox 服务器或任何主机上
- **为游戏而生** — 低延迟 WebRTC 音频，永久在线频道
- **语音 + 文字** — 在语音频道旁边聊天，支持 Markdown 渲染
- **频道所有权** — 踢出用户、重命名和删除频道、管理你的空间
- **支持移动端** — 响应式布局，带语音/聊天标签切换
- **声音通知** — 加入、离开和消息的微妙音频提示
- **文件分享** — 支持发送图片、视频、文件（最大 50MB）
- **粘贴上传** — 在聊天输入框中粘贴图片自动上传
- **亮色/暗色主题** — 自动检测系统主题，支持手动切换
- **消息持久化** — 每个频道独立存储聊天记录，重启不丢失
- **私密会话** — 不存储消息，图片 Base64 传输，支持密码保护
- **完全本地化** — 所有字体、CSS、JS 文件本地化，无外部依赖

---

## 快速开始

### 使用管理脚本（推荐）

```bash
git clone https://github.com/olinll/privalk.git
cd privalk

# Linux / macOS
chmod +x privalk.sh
./privalk.sh install    # 安装依赖并构建
./privalk.sh start      # 启动服务

# Windows
privalk.cmd install     # 安装依赖并构建
privalk.cmd start       # 启动服务
```

**管理脚本命令：**

| 命令 | 说明 |
|------|------|
| `install` | 安装依赖并构建项目 |
| `start` | 启动服务（使用 PM2） |
| `stop` | 停止服务 |
| `status` | 查看服务状态和日志 |
| `pull` | 拉取更新并重新构建重启 |

### 手动安装

需要 [Node.js 18+](https://nodejs.org)。

```bash
git clone https://github.com/olinll/privalk.git
cd privalk
npm install
npm run build
npm start
```

要让 Privalk 在后台运行：
```bash
npm install -g pm2
pm2 start dist/index.js --name privalk
pm2 save && pm2 startup
```

---

## 通过 Cloudflare Tunnel 与朋友连接

如果你想让不在局域网内的朋友也能访问 Privalk，可以使用 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 将服务暴露到公网。

**快速设置：**

1. 安装 cloudflared：[developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/)
2. 登录并创建隧道：
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create privalk
   ```
3. 配置隧道指向本地服务：
   ```yaml
   # ~/.cloudflared/config.yml
   tunnel: <tunnel-id>
   credentials-file: ~/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: privalk.your-domain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
4. 启动隧道：
   ```bash
   cloudflared tunnel run privalk
   ```

你的朋友现在可以通过 `https://privalk.your-domain.com` 访问。

> **安全警告：** Cloudflare Tunnel 会将你的 Privalk 实例暴露在公网上。请务必注意：
> - 确保使用强密码保护 Cloudflare 账户并启用双因素认证
> - 考虑在 Cloudflare Access 后面添加身份验证层
> - 定期检查访问日志，监控异常活动
> - 如果不需要公网访问，建议使用局域网或 VPN 方案

---

## HTTPS 设置

麦克风访问需要 HTTPS 连接（浏览器强制要求）。

### 使用 mkcert

```bash
sudo apt install mkcert libnss3-tools
mkcert -install
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 YOUR_SERVER_IP
```

然后更新服务器使用 HTTPS：
```typescript
import https from "https";
import fs from "fs";

const server = https.createServer({
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
}, app);
```

---

## 功能特性

### Markdown 支持

聊天消息支持 Markdown 语法渲染：

| 语法 | 效果 |
|------|------|
| `**粗体**` | **粗体** |
| `*斜体*` | *斜体* |
| `` `代码` `` | `代码` |
| ` ```代码块``` ` | 代码块 |
| `[链接](url)` | 链接 |
| `![图片](url)` | 图片 |
| `> 引用` | 引用 |
| `- 列表` | 列表 |
| `~~删除线~~` | ~~删除线~~ |

### 频道权限

创建频道的人就是**频道主**，用 👑 皇冠标识。频道主信息持久化保存，重启后不会丢失。如果频道主离开，所有权会转移给下一个人。

| 操作 | 频道主 | 成员 |
|------|:------:|:----:|
| 加入和使用频道 | ✅ | ✅ |
| 发送消息 | ✅ | ✅ |
| 静音自己 | ✅ | ✅ |
| 踢出用户 | ✅ | ❌ |
| 重命名频道 | ✅ | ❌ |
| 删除频道 | ✅ | ❌ |

**如何使用频道主控制：**
- **桌面端** — 右键点击侧边栏中的频道进行重命名或删除。右键点击用户磁贴进行踢出。
- **移动端** — 长按频道或用户磁贴。

### 私密会话

创建频道时可勾选"私密会话"，开启后：
- 消息不会存储在服务器内存和磁盘
- 图片使用 Base64 编码传输，不上传到服务器
- 可设置密码保护，加入时需要输入密码

### 创建频道默认静音

创建频道时可勾选"加入时默认静音"，新成员加入时自动静音。

### 主题切换

- 首次访问自动检测系统主题（亮色/暗色）
- 右上角按钮手动切换，偏好自动保存

### 侧边栏折叠

- 频道列表和成员面板支持向左折叠
- 折叠后显示首字母头像
- 折叠状态自动保存

### 表情选择器

- 点击表情按钮弹出选择框
- 支持滚动浏览，点击外部自动关闭

---

## 配置

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | `3000` | 服务器监听端口 |
| `NODE_ENV` | `development` | 生产环境设置为 `production` |

你可以在 `src/services/room.service.ts` 和 `src/services/chat.service.ts` 中调整这些限制：

| 常量 | 默认值 | 描述 |
|------|--------|------|
| `MAX_ROOMS` | `50` | 最大频道数 |
| `MAX_USERS_ROOM` | `20` | 每个频道最大用户数 |
| `MAX_NAME_LEN` | `24` | 最大显示名称长度 |
| `MAX_MSG_LEN` | `500` | 最大聊天消息长度 |
| `RATE_MAX_EVENTS` | `30` | 每5秒每个客户端最大事件数 |

---

## 安全

Privalk 以隐私和安全为首要原则：

- **速率限制** — 每个客户端每5秒30个 socket 事件
- **输入清理** — 所有用户名、频道名称和消息在服务端验证
- **原型污染保护** — `rooms` 对象使用 `Object.create(null)` 并有保留键黑名单
- **房间范围 WebRTC 中继** — 信令仅在同一频道内的对等点之间转发
- **安全头** — CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy
- **私密会话密码** — 私密频道支持密码保护

---

## 技术栈

| | |
|--|--|
| 运行时 | Node.js 20 |
| 服务器 | Express 4 |
| 实时通信 | Socket.io 4 |
| 语音 | WebRTC（浏览器原生） |
| 前端 | Vanilla HTML / Tailwind CSS / JS |
| 类型系统 | TypeScript |
| 文件上传 | Multer（最大 50MB） |
| 持久化 | JSON 文件存储 |

无数据库。无外部服务。无遥测。完全本地化，无外部依赖。

---

## 项目结构

```
privalk/
├── src/
│   ├── index.ts              # 服务器入口
│   ├── routes/
│   │   └── upload.route.ts   # 文件上传路由
│   ├── services/
│   │   ├── room.service.ts   # 频道管理
│   │   ├── chat.service.ts   # 聊天功能
│   │   └── file.service.ts   # 文件服务
│   └── public/
│       ├── index.html        # 前端界面
│       ├── favicon.svg       # 网站图标
│       ├── js/
│       │   └── tailwind.js   # Tailwind CSS
│       └── fonts/
│           ├── fonts.css     # 字体样式
│           ├── noto-sans-sc-*.ttf  # Noto Sans SC 字体
│           └── plus-jakarta-sans-*.ttf  # Plus Jakarta Sans 字体
├── data/                     # 持久化数据
│   ├── channels.json         # 频道列表（含频道主信息）
│   └── chat/                 # 每个频道的聊天记录
├── dist/                     # 编译输出（自动生成）
├── uploads/                  # 上传文件存储
├── privalk.sh                # Linux/Mac 管理脚本
├── privalk.cmd               # Windows 管理脚本
├── package.json
├── tsconfig.json
└── README.md
```

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建项目
npm run build

# 运行生产版本
npm start
```

---

## 贡献

1. Fork 仓库
2. 创建你的分支：`git checkout -b feature/your-feature`
3. 提交你的更改：`git commit -m '添加你的功能'`
4. 推送：`git push origin feature/your-feature`
5. 开一个 Pull Request

---

## 许可证

[MIT](LICENSE) — 随意使用。
