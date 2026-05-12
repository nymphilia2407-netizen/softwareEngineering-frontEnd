# 即时通信系统 · 前端

基于 **React 19**、**TypeScript** 与 **Vite** 的即时通信 Web 客户端：会话列表、单聊/群聊、联系人、好友请求、设置，以及通过 **WebSocket** 接收实时消息与群同步事件。

## 技术栈

| 类别 | 说明 |
|------|------|
| 框架 | React 19、react-dom |
| 构建 | Vite 8、`tsc -b` 做类型检查 |
| HTTP | Axios（`src/utils/request.ts` 统一实例与拦截器） |
| 实时 | `reconnecting-websocket` 封装于 `src/services/websocket.ts` |
| 表单 | 登录页使用 `react-hook-form` |

包管理推荐使用 **pnpm**（仓库内包含 `pnpm-lock.yaml`）。

## 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 后端 API 根地址（含协议与端口）。未设置时与 `src/constants/string.ts` 中 `BACKENDURL` 的本地兜底一致，并与 Axios `baseURL` 同源。 |

本地开发可在 `front-end` 目录新建 `.env` 或 `.env.local`：

```bash
VITE_API_BASE_URL=http://127.0.0.1:80
```

生产构建由部署环境注入上述变量即可。

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发服务器（Vite）
pnpm run build        # tsc -b && vite build，产出 dist/
pnpm run preview      # 预览生产构建（默认端口见 vite.config.ts，可用 PORT 覆盖）
pnpm run lint         # ESLint
```

## 源码结构（`src/`）

```
src/
├── main.tsx                 # 挂载 React 根节点，引入 global.css
├── App.tsx                  # 根布局：根据 token 切换登录页与主界面
├── assets/                  # 图片资源（默认头像、侧栏图标等）
├── pages/
│   ├── index.tsx            # 主界面：侧栏、会话/联系人/设置、WebSocket 与状态编排
│   └── login.tsx            # 登录 / 注册
├── components/
│   ├── chatList.tsx         # 会话列表（类型与 ChatListItem 对齐）
│   ├── chatWindow.tsx       # 当前会话消息区与输入框
│   ├── chatSessionDetail.tsx   # 会话资料（群成员、公告、禁言、免打扰等）
│   ├── contactList.tsx      # 联系人页容器：状态与若干子面板
│   ├── contactSessionDetail.tsx # 好友资料详情（从联系人进入）
│   ├── settingsPanel.tsx    # 设置：资料、邮箱/密码、注销等
│   ├── main/                # 主壳层小组件（侧栏、设置侧按钮、群同步 Toast）
│   └── contactList/         # 联系人子模块：头部、好友/群列表区、各弹层面板
├── hooks/                   # 主页面抽离的逻辑（首屏与 WS、历史消息、乐观发送）
├── services/                # API 与 WS 客户端（含 apiResponse 统一解包）
├── mappers/                 # 后端 DTO → 前端展示模型（如 chat.ts）
├── constants/
│   └── string.ts            # 资源 URL、BACKENDURL、发送 ACK 超时等常量
├── types/
│   ├── auth.ts              # 登录/注册请求与响应类型
│   ├── chat.ts              # ChatListItem、ActiveTabType 等
│   └── entity.ts            # User、Group、Message、WsAction 等
├── utils/
│   ├── request.ts           # Axios 实例（baseURL 来自 constants/string）
│   ├── auth.ts              # Token、用户资料缓存
│   ├── avatar.ts            # 头像 URL 与本地选图
│   ├── jwtProfile.ts        # JWT 解析与首屏资料缓存读取
│   ├── messageStore.ts      # 消息列表纯更新与 sameUserId
│   └── chatRoomList.ts      # 会话列表角标/预览更新
└── styles/                  # 按页面或模块拆分的 CSS（index、login、chat、contact、settings、global）
```

## 架构说明（简）

- **页面（`pages/`）**：负责路由级编排；`index.tsx` 将数据拉取、WebSocket、乐观发送等委托给 `hooks/`，UI 片段委托给 `components/main/`。
- **组件（`components/`）**：可复用 UI；联系人相关复杂 UI 拆在 `contactList/` 子目录，避免单文件过长。
- **服务（`services/`）**：仅关心 HTTP 路径与类型；列表类接口的 `code === 0` 判断集中在 `apiResponse.ts` 的 `unwrapApiData` / `assertApiSuccess`。
- **类型**：会话列表行统一为 `types/chat.ts` 中的 `ChatListItem`，与会话映射 `mappers/chat.ts` 及 `chatList.tsx` 一致。

## 仓库根目录其它文件

除 `src/` 外，本目录常见文件还包括：`Dockerfile`、`.dockerignore`、`.gitlab-ci.yml`、`secoder-deploy.yaml` 等，用于容器与流水线部署；具体以仓库为准。

## 构建产物

执行 `pnpm run build` 后生成 **`dist/`**，由任意静态文件服务器或容器内 Web 服务器托管；请求仍指向配置好的 `VITE_API_BASE_URL` 对应后端。
