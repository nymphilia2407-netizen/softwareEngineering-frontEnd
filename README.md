# 即时通信系统 - 项目前端

本项目是基于React实现的即时通信系统前端

## 项目结构
```
.  
├── eslint.config.js  
├── index.html                    # 项目入口HTML文件  
├── package-lock.json  
├── package.json  
├── pnpm-lock.yaml  
├── public  
│   ├── favicon.svg  
│   └── icons.svg  
├── README.md  
├── src                           # 源代码目录  
│   ├── App.tsx                   # 根组件  
│   ├── assets                    # 静态资源目录  
│   │   ├── chat-icon.jpg           # 聊天图标  
│   │   ├── config-icon.webp        # 设置图标  
│   │   ├── contact-icon.jpg        # 联系人图标  
│   │   ├── default.png             # 默认头像  
│   │   ├── hero.png  
│   │   ├── react.svg  
│   │   └── vite.svg  
│   ├── components                # 公共组件库  
│   │   ├── chatList.tsx            # 聊天列表  
│   │   └── contactList.tsx         # 联系人列表  
│   ├── constants                 # 常量库  
│   │   └── string.ts  
│   ├── main.tsx                  # 应用渲染入口  
│   ├── pages                     # 页面级组件  
│   │   ├── index.tsx               # 主页面  
│   │   └── login.tsx               # 登录/注册页面  
│   ├── services  
│   ├── store  
│   ├── styles                    # 样式目录  
│   │   ├── chatList.css  
│   │   ├── contactList.css  
│   │   ├── global.css  
│   │   ├── index.css  
│   │   └── login.css  
│   ├── types                     # 类型定义  
│   │   ├── chat.ts  
│   │   ├── entity.ts  
│   │   └── ui.ts  
│   ├── utils                     # 工具函数  
│   │    ├─── auth.ts                 # 处理权限验证，token存储等逻辑  
│   └── mockData                  # 模拟数据，测试使用
│        └── contactListMock.tsx     # 联系人列表模拟数据
│       └── request.ts               # HTTP 请求封装，拦截器等
├── tsconfig.app.json  
├── tsconfig.json  
├── tsconfig.node.json  
└── vite.config.ts  
```
