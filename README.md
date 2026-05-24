# 即时通信系统 · 前端

基于 **React 19**、**TypeScript** 与 **Vite** 的即时通信 Web 客户端：会话列表、单聊/群聊、联系人、好友请求、设置，以及通过 **WebSocket** 接收实时消息与群同步事件。

## 技术栈

| 类别 | 说明 |
|------|------|
| 框架 | React 19、react-dom |
| 构建 | Vite 8、`tsc -b` 做类型检查 |
| HTTP | Axios（`src/utils/request.ts` 统一实例与拦截器） |
| 实时 | `reconnecting-websocket` 封装于 `src/services/websocket.ts` |
| 列表虚拟化 | `@tanstack/react-virtual`（消息区长列表） |
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

生产构建由部署环境注入上述变量即可（见 `Dockerfile`、`.env.production`）。

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
├── contexts/
│   └── MessageStoreContext.tsx   # 按会话订阅消息，避免整页随每条消息重渲染
├── components/
│   ├── chatList.tsx         # 会话列表（类型与 ChatListItem 对齐）
│   ├── chatWindow.tsx       # 当前会话消息区（虚拟滚动）与输入框
│   ├── chatWindow/          # MessageRow、行内工具函数
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
│   └── string.ts            # 资源 URL、BACKENDURL、分页大小、超时等常量
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
│   └── chatRoomList.ts      # 会话列表角标/预览更新（增量 reposition）
└── styles/                  # 按页面或模块拆分的 CSS
```

## 架构说明

### 页面与状态

- **`pages/index.tsx`**：路由级编排；首屏拉取、WebSocket、乐观发送委托给 `hooks/`，UI 委托给 `components/main/` 等。
- **`MessageStoreProvider`**：消息按 `conversation_id` 存储；`useConversationMessages(id)` 基于 `useSyncExternalStore`，仅订阅当前会话的组件在对应会话变更时更新。
- **`ChatWindow`** 内部自行读取消息 store，不再由 Index 传入整表 `messages`，降低父组件渲染压力。

### 服务层

- **`services/`**：HTTP 路径与类型；`apiResponse.ts` 统一 `code === 0` 解包。
- **`getChatMessages`**：支持 `beforeMessageId` 游标参数，返回 `hasMore`、`oldestMessageId`（与后端游标分页对齐；UI「上滑加载更多」可按需接入）。
- **`services/group.ts`**：`getGroupDetail` 带 30s 内存缓存与 inflight 去重。

### WebSocket 流程

1. 登录后建立 `ws/chat/` 连接（JWT 鉴权）。
2. 后端连接时仅加入用户组；客户端在 `chatRooms` 就绪后，对**全部会话**发送 `subscribe_room`，确保非当前会话也能收到 `new_message`。
3. 新建群/私聊成功后立即补发 `subscribe_room`。
4. 群变更事件经 WS 推送，Index 侧 debounce（约 400ms）后调用 `syncChatRoomsAndGroups`。

### 性能相关

- 消息列表 **虚拟滚动**（`@tanstack/react-virtual`）。
- 会话列表更新使用 **`repositionUpdatedRoom`**，避免每条消息全量排序。
- 首屏 **`getChatRooms` 单次拉取** 合并群与会话，减少重复请求。
- 联系人/可见性刷新、WS 重连后的好友列表等做了节流，避免频繁 refetch。
- 主要列表组件（`ChatList`、`MainSidebar`、`ContactList` 等）使用 `React.memo`。

## 与后端联调

1. 启动 Django（见 `django/project/README.md`），默认 `http://127.0.0.1:80`。
2. 前端 `.env.local` 设置 `VITE_API_BASE_URL` 指向同一地址。
3. WebSocket 地址由 `BACKENDURL` 推导（`http` → `ws`，路径 `ws/chat/`）。

## 部署相关

除 `src/` 外，本目录常见文件：

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建：`pnpm build` + `serve` 静态托管 |
| `.gitlab-ci.yml` / `secoder-deploy.yaml` | CI/CD 与集群部署清单 |
| `.env.production` | 生产环境变量（勿提交敏感信息） |

执行 `pnpm run build` 后生成 **`dist/`**，由静态服务器或容器托管；运行时仍请求配置好的 `VITE_API_BASE_URL` 对应后端。
