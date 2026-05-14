<p align="center">
  <img src="public/favicon.svg" alt="Lumina Logo" width="80" height="80" />
</p>

<h1 align="center" style="color: #FF6B00;">LUMINA</h1>

<p align="center">
  <strong>AI Workflow Orchestrator — 可视化 AI 工作流编排平台</strong>
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript" alt="TypeScript" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite" alt="Vite" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase" alt="Supabase" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></a>
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#简体中文">简体中文</a>
</p>

---

## 简体中文

### 📖 简介

Lumina 是一个现代化的 AI 工作流编排平台，让你通过可视化拖拽的方式构建复杂的 AI 处理流程。无需编写代码，即可将多个 AI 模型、数据处理节点串联成强大的自动化工作流。

### ✨ 核心功能

- 🎨 **可视化工作流编辑器** — 基于 ReactFlow 的拖拽式节点编排
- 🤖 **多 AI 提供商支持** — OpenAI、Claude、Gemini、DeepSeek 等
- 📝 **提示词管理** — 分类管理、标签系统、快速复用
- 🔐 **用户认证** — 邮箱注册/登录、密码重置、邮箱验证
- 📊 **活动热力图** — GitHub 风格的工作活跃度展示
- 🗑️ **回收站** — 软删除机制，数据可恢复
- 📱 **响应式设计** — 适配各种屏幕尺寸

### 🔌 Skills API

新增面向技能调用的 Prompt / Resource 接口（含基础 CRUD）：

- `api/skills/prompts.ts`
- `api/skills/resources.ts`

接口说明与示例见：`docs/skills-api.md`

### 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 状态管理 | React Hooks |
| 工作流引擎 | ReactFlow |
| 动画 | Motion (Framer Motion) |
| 后端服务 | Supabase (PostgreSQL + Edge Functions) |
| 文件存储 | Supabase Storage |
| 样式 | Tailwind CSS |

### 📦 项目结构

```
lumina/
├── components/          # React 组件
│   ├── WorkflowEditor   # 工作流编辑器
│   ├── PromptManager    # 提示词管理
│   ├── CustomNodes      # 自定义节点
│   └── ...
├── lib/                 # 核心库
│   ├── supabase.ts      # Supabase 客户端
│   ├── auth.ts          # 认证逻辑
│   ├── workflows.ts     # 工作流 CRUD
│   ├── prompts.ts       # 提示词 CRUD
│   └── cache.ts         # 缓存层
├── shared/              # 共享组件
├── supabase/            # 数据库
│   ├── schema.sql       # 主 Schema
│   ├── plus/            # 增量迁移
│   └── functions/       # Edge Functions
└── types.ts             # 类型定义
```

### 🚀 快速开始

#### 环境要求

- Node.js 18+
- npm 或 pnpm
- Supabase 账号

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/lumina.git
cd lumina
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填写：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key  # 可选
```

#### 4. 初始化数据库

在 Supabase SQL Editor 中依次执行：

```bash
supabase/schema.sql           # 主 Schema
supabase/plus/001_*.sql       # 增量迁移（按顺序）
supabase/plus/002_*.sql
...
```

#### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:4000

### 📝 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名密钥 |
| `GEMINI_API_KEY` | ❌ | Google Gemini API 密钥 |
| `VITE_EMAIL_DEV_MODE` | ❌ | 设为 `true` 跳过邮件发送 |

### 🗄️ 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户账号 |
| `workflows` | 工作流定义 |
| `prompts` | 提示词库 |
| `prompt_categories` | 提示词分类 |
| `node_templates` | 节点模板 |
| `ai_providers` | 用户 AI 配置 |
| `ai_provider_templates` | AI 提供商模板 |
| `email_verifications` | 邮箱验证码 |
| `workflow_executions` | 执行记录 |

### 🔧 可用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

### 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

## English

### 📖 Introduction

Lumina is a modern AI workflow orchestration platform that allows you to build complex AI processing pipelines through visual drag-and-drop. No coding required — connect multiple AI models and data processing nodes into powerful automated workflows.

### ✨ Key Features

- 🎨 **Visual Workflow Editor** — Drag-and-drop node orchestration based on ReactFlow
- 🤖 **Multi AI Provider Support** — OpenAI, Claude, Gemini, DeepSeek, and more
- 📝 **Prompt Management** — Categories, tags, and quick reuse
- 🔐 **User Authentication** — Email registration/login, password reset, email verification
- 📊 **Activity Heatmap** — GitHub-style activity visualization
- 🗑️ **Trash Bin** — Soft delete with data recovery
- 📱 **Responsive Design** — Adapts to all screen sizes

### 🔌 Skills API

Prompt and Resource CRUD endpoints for skill integrations:

- `api/skills/prompts.ts`
- `api/skills/resources.ts`

See `docs/skills-api.md` for contract and examples.

### 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/lumina.git
cd lumina

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ by the Lumina Team**

</div>
