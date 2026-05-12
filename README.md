# 即时通信系统 - 项目前端

本项目是基于React实现的即时通信系统前端

## 项目结构
```
.
├── Dockerfile
├── .dockerignore
├── .gitlab-ci.yml
├── secoder-deploy.yaml
├── eslint.config.js
├── index.html                    # 项目入口 HTML
├── package.json
├── package-lock.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   └── icons.svg
├── src/                          # 源代码目录
│   ├── main.tsx                  # 应用渲染入口（挂载根节点）
│   ├── App.tsx                   # 根组件（路由等）
│   ├── assets/                   # 静态资源（侧栏图标等）
│   │   ├── chat-icon.jpg
│   │   ├── config-icon.webp
│   │   └── contact-icon.jpg
│   ├── components/               # UI 组件
│   │   ├── chatList.tsx          # 会话列表
│   │   ├── chatWindow.tsx        # 单会话聊天窗口
│   │   ├── chatSessionDetail.tsx # 会话详情（群资料 / 好友资料、免打扰等）
│   │   ├── contactList.tsx       # 联系人列表（好友、群、请求等）
│   │   ├── contactSessionDetail.tsx # 从联系人进入的资料 / 发起聊天
│   │   ├── config.tsx            # 设置页内容片段
│   │   └── configNav.tsx         # 设置侧栏与主导航
│   ├── constants/
│   │   └── string.ts             # 常量（后端地址、默认头像路径等）
│   ├── pages/
│   │   ├── index.tsx             # 主界面（会话 + 联系人 + WebSocket）
│   │   └── login.tsx             # 登录 / 注册
│   ├── services/                 # HTTP 与 WebSocket 封装
│   │   ├── auth.ts               # 登录、注册
│   │   ├── chat.ts               # 会话列表、历史消息、免打扰设置
│   │   ├── friend.ts             # 好友、好友请求
│   │   ├── group.ts              # 群聊创建与管理、成员禁言等
│   │   ├── user.ts               # 当前用户资料
│   │   └── websocket.ts          # 即时消息 WebSocket 客户端
│   ├── styles/
│   │   ├── index.css             # 主布局与全局样式入口
│   │   ├── global.css
│   │   ├── login.css
│   │   ├── chatList.css
│   │   ├── chatWindow.css
│   │   ├── chatSessionDetail.css
│   │   ├── contactList.css
│   │   ├── config.css
│   │   └── configNav.css
│   ├── types/
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   ├── entity.ts             # 用户、消息、WS 载荷等实体类型
│   │   └── ui.ts                 # 界面状态枚举等
│   └── utils/
│       ├── auth.ts               # Token 存取、登录态
│       ├── request.ts            # Axios 封装与拦截器
│       └── avatar.ts             # 头像 URL 解析、本地选图读入 data URL
```
