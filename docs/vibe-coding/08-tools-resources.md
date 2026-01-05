# 工具与资源

## AI 模型推荐

### 编码模型性能分级

| 梯队 | 模型 | 适用场景 |
|------|------|----------|
| 第一梯队 | Claude Opus 4.5, GPT-5 Codex (xhigh) | 复杂任务、架构设计 |
| 第二梯队 | Claude Sonnet 4.5, Gemini 3.0 Pro, Kimi K2 | 日常开发 |
| 第三梯队 | Qwen3, GLM, Grok | 简单任务、快速迭代 |

### 模型选择建议

- **复杂架构设计**：Claude Opus 4.5
- **日常编码**：Claude Sonnet 4.5 / GPT-5 Codex
- **快速原型**：Gemini 3.0 Pro
- **小修改**：GPT-5 (medium)
- **文案写作**：Claude Opus

---

## 开发环境

### IDE 推荐

| 工具 | 特点 | 适合场景 |
|------|------|----------|
| **Cursor** | AI 原生 IDE | 主力开发工具 |
| **VS Code** | 插件丰富 | 代码阅读、手动修改 |
| **Kiro** | 免费 Claude Opus | 预算有限时 |

### CLI 工具

| 工具 | 说明 |
|------|------|
| **Claude Code** | Claude 官方 CLI |
| **Codex CLI** | OpenAI 官方 CLI |
| **Gemini CLI** | Google 免费 CLI |
| **Warp** | AI 增强终端 |

### VS Code 必装插件

- **Local History**：本地版本历史
- **GitLens**：Git 增强
- **Prettier**：代码格式化
- **ESLint**：代码检查
- **Tailwind CSS IntelliSense**：Tailwind 提示

---

## 辅助工具

### 文档与可视化

| 工具 | 用途 |
|------|------|
| **Mermaid Chart** | 文本转架构图 |
| **NotebookLM** | AI 解读资料 |
| **Zread** | GitHub 仓库阅读 |
| **Excalidraw** | 手绘风格图表 |

### 代码管理

| 工具 | 用途 |
|------|------|
| **RepoPrompt** | 代码库导出为单文件 |
| **uithub** | 代码库可视化 |
| **DBeaver** | 数据库管理 |

### 创意资源

| 类型 | 推荐工具 |
|------|----------|
| 2D 图片 | ChatGPT + DALL-E, Midjourney |
| 音乐 | Suno |
| 音效 | ElevenLabs |
| 视频 | Sora 2 |
| 图标 | Lucide, Heroicons |

---

## 技术栈推荐

### Web 应用（推荐）

```
前端：Next.js + TypeScript + Tailwind CSS
UI库：shadcn/ui
后端：Next.js API Routes
数据库：PostgreSQL + Prisma
部署：Vercel
```

### 静态网站

```
框架：Astro 或纯 HTML/CSS/JS
样式：Tailwind CSS
部署：Vercel / Netlify / GitHub Pages
```

### 2D 游戏

```
引擎：Phaser.js 或 PixiJS
语言：TypeScript
打包：Vite
部署：itch.io / Vercel
```

### 3D 游戏

```
引擎：Three.js
网络：WebSocket
语言：TypeScript
部署：自建服务器
```

---

## 学习资源

### 官方文档（必读）

- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev)
- [TypeScript 文档](https://www.typescriptlang.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

### Vibe Coding 社区

- [vibe-coding-cn](https://github.com/2025Emma/vibe-coding-cn) - 中文指南
- [vibe-coding](https://github.com/EnzeD/vibe-coding) - 英文原版
- [vibevibe.cn](https://www.vibevibe.cn) - 中文教程网站

### 提示词资源

- 元提示词库
- 第三方系统提示词仓库
- Skills 制作器

---

## 快捷键速查

### Claude Code

| 快捷键 | 功能 |
|--------|------|
| `/init` | 初始化项目 |
| `/new` | 新会话 |
| `/clear` | 清除上下文 |
| `/compact` | 压缩上下文 |
| `/rewind` | 回滚 |
| `Shift+Tab` | 切换 Plan 模式 |

### VS Code

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+\`` | 打开终端 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+/` | 注释代码 |

### Git

| 命令 | 功能 |
|------|------|
| `git status` | 查看状态 |
| `git add .` | 暂存所有 |
| `git commit -m "msg"` | 提交 |
| `git log --oneline` | 查看历史 |
| `git reset --hard HEAD~1` | 回滚 |

---

## 常见问题

### Q: 用 Cursor 还是 Claude Code？

A: 看个人喜好。Cursor 界面友好，Claude Code 更灵活。建议都试试。

### Q: 免费额度用完了怎么办？

A: 
- Kiro 提供免费 Claude Opus
- Gemini CLI 免费
- 本地部署开源模型（Ollama）

### Q: 代码越来越乱怎么办？

A: 
1. 及时重构
2. 保持模块化
3. 定期清理无用代码
4. 遵守规则文件

### Q: AI 生成的代码有 bug 怎么办？

A:
1. 提供详细错误信息
2. 缩小问题范围
3. 回滚到上一个正常版本
4. 换个思路重新描述需求
