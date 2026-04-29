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
# ============ 运行阶段 ============
FROM docker.1ms.run/library/node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]