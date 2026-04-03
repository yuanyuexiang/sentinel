# Report 管理端（Next.js）

基于 Next.js 16 + TypeScript 的 Report 管理端，实现以下流程：

1. 上传 Excel
2. 触发组装（Assemble）
3. 触发发布（Publish）
4. 查看报告列表与详情
5. 查看 section 级内容

## 1. 环境准备

复制环境变量模板：

```bash
cp .env.example .env.local
```

默认值：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_PREFIX=/consultant/api
```

## 2. 启动项目

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 3. 主要页面

1. `/reports`：报告列表，支持组装和发布
2. `/reports/upload`：上传 Excel（.xlsx）
3. `/reports/[reportKey]`：报告详情与 section 列表
4. `/reports/[reportKey]/sections/[sectionKey]`：section 详情与图表预览

## 4. 技术栈

1. Next.js App Router + TypeScript
2. Ant Design
3. TanStack Query
4. React Hook Form + Zod
5. axios

## 5. 验证命令

```bash
npm run lint
npm run build
```

当前版本已通过 lint 与 build 验证。

docker buildx build --platform linux/amd64,linux/arm64 -t auricintelligence/sentinel:v10 .