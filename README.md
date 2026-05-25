# Privalk

**你的声音。你的服务器。你的规则。**

Privalk 是一个私密的、自托管的语音和文字聊天应用，专为厌倦了将对话交给大型平台的游戏群体而设计。无需账号。没有广告。数据不会离开你的机器。只有你和你想交谈的人之间的清晰语音聊天和消息传递。

基于 [shynsec/squawk](https://github.com/shynsec/squawk) 的项目进行二次开发。

---

## 为什么选择 Privalk？

大多数语音聊天应用是免费的，因为*你*就是产品。你的对话通过别人的服务器传递，你的数据被记录，你距离失去访问权限只有一个政策变化。

Privalk 反其道而行。你托管它。你控制它。你的朋友通过你的私人 Tailscale 网络连接——其他人甚至看不到服务器的存在。

- **完全私密** — 只有你邀请的人才能通过 Tailscale VPN 访问
- **自托管** — 运行在你的机器、Proxmox 服务器或任何 Linux 主机上
- **为游戏而生** — 低延迟 WebRTC 音频，永久在线频道
- **语音 + 文字** — 在语音频道旁边聊天，带有输入指示器
- **频道所有权** — 踢出用户、重命名和删除频道、管理你的空间
- **支持移动端** — 响应式布局，带语音/聊天标签切换
- **声音通知** — 加入、离开和消息的微妙音频提示
- **文件分享** — 支持发送图片、视频、文件

---

## 快速开始

### 手动安装

需要 [Node.js 18+](https://nodejs.org)。

```bash
git clone https://github.com/your-username/squawk.git
cd squawk
npm install
npm run build
npm start
```

要让 Privalk 在后台运行：
```bash
npm install -g pm2
pm2 start dist/server.js --name squawk
pm2 save && pm2 startup
```

---

## 通过 Tailscale 与朋友连接

Privalk 设计为通过 [Tailscale](https://tailscale.com) 工作——一个在你的设备之间创建私人网络的零配置 VPN。你的 tailnet 之外的任何人都无法访问你的服务器。

**设置步骤：**
1. 在服务器上安装 Tailscale：`curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
2. 在每个朋友的设备上安装 Tailscale — [tailscale.com/download](https://tailscale.com/download)
3. 邀请朋友：[login.tailscale.com/admin/invite](https://login.tailscale.com/admin/invite)
4. 发送你的 Tailscale IP 给他们，告诉他们在 Firefox 中访问 `https://100.x.x.x`

---

## HTTPS 设置

麦克风访问需要 HTTPS 连接（浏览器强制要求）。

### 使用 mkcert

```bash
sudo apt install mkcert libnss3-tools
mkcert -install
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 YOUR_TAILSCALE_IP
```

然后更新 `server.js` 使用 HTTPS：
```js
const https = require("https");
const fs = require("fs");

const server = https.createServer({
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
}, app);
```

---

## 频道权限

创建频道的人就是**频道主**，用 👑 皇冠标识。如果频道主离开，所有权会转移给下一个人。

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

---

## 配置

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | `3000` | 服务器监听端口 |
| `NODE_ENV` | `development` | 生产环境设置为 `production` |

你可以在 `src/server.ts` 顶部调整这些限制：

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
- **严格 CORS** — 仅接受来自 localhost 和 Tailscale IP 范围的连接
- **安全头** — CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy

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

无数据库。无外部服务。无遥测。

---

## 项目结构

```
squawk/
├── src/
│   ├── server.ts          # 服务器端代码
│   └── public/
│       ├── index.html     # 前端界面
│       └── favicon.svg    # 网站图标
├── dist/                  # 编译输出（自动生成）
├── uploads/               # 上传文件存储
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
