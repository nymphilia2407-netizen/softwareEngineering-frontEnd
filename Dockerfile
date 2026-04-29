# ============ 第一阶段：构建 ============
FROM docker.1ms.run/library/node:22-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层）
COPY package.json pnpm-lock.yaml ./

# 换源并安装依赖
RUN pnpm install --frozen-lockfile

# 复制全部源码和 .env.production
COPY . .

# 生产构建（跳过 tsc 类型检查，直接打包）
RUN npx vite build --emptyOutDir

# ============ 第二阶段：运行 ============
FROM docker.1ms.run/library/node:22-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# 只安装生产依赖（vite preview 需要）
RUN pnpm config set registry https://registry.npmmirror.com/ && \
    pnpm install --prod --frozen-lockfile

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist

# 暴露 80 端口
EXPOSE 80

# 用 vite preview 启动
CMD ["pnpm", "preview"]