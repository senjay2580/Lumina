# Vibe Coding 完整教程

> 人人都能学会 AI 编程 —— 不写代码，也能做产品

---

## 📚 目录

### 基础篇

| 章节 | 内容 | 适合人群 |
|------|------|----------|
| [01-入门指南](./01-introduction.md) | 什么是 Vibe Coding、核心理念、工具推荐 | 所有人 |
| [02-方法论](./02-methodology.md) | 道法术、元方法论、与 AI 沟通技巧 | 所有人 |
| [03-项目启动](./03-project-setup.md) | PRD/GDD、技术栈、Memory Bank、规则文件 | 所有人 |

### 实战篇

| 章节 | 内容 | 适合人群 |
|------|------|----------|
| [04-开发工作流](./04-development-workflow.md) | 迭代流程、调试技巧、CLI 命令 | 有基础者 |
| [05-提示词库](./05-prompts-library.md) | 项目启动、开发执行、调试、重构提示词 | 所有人 |
| [06-规则模板](./06-rules-templates.md) | CLAUDE.md、.cursorrules、AGENTS.md 模板 | 有基础者 |

### 进阶篇

| 章节 | 内容 | 适合人群 |
|------|------|----------|
| [07-最佳实践](./07-best-practices.md) | MVP 思维、上下文管理、Git、安全 | 所有人 |
| [08-工具资源](./08-tools-resources.md) | 模型推荐、工具清单、学习资源 | 所有人 |

---

## 🚀 快速开始

### 5 分钟上手

1. **安装工具**
   - 下载 [Cursor](https://cursor.sh) 或 [VS Code](https://code.visualstudio.com)
   - 注册 [Claude](https://claude.ai) 或 [ChatGPT](https://chat.openai.com)

2. **创建项目**
   ```
   我想做一个 [你的想法]，帮我创建 PRD 文档
   ```

3. **生成实施计划**
   ```
   基于这个 PRD，创建分步实施计划，每步要有测试验证
   ```

4. **开始开发**
   ```
   执行 Step 1，完成后更新进度文档
   ```

5. **迭代完善**
   - 每完成一步提交 Git
   - 开新会话继续下一步

---

## 🎯 核心原则

```
┌─────────────────────────────────────────────┐
│                                             │
│   规划就是一切                               │
│   Planning is Everything                    │
│                                             │
│   不要让 AI 自主规划                         │
│   否则代码库会变成一团乱麻                    │
│                                             │
└─────────────────────────────────────────────┘
```

### 道

- 凡是 AI 能做的，就不要人工做
- 上下文是第一性要素
- 先结构，后代码
- 一次只做一件事

### 法

- 一句话目标 + 非目标
- 能抄不写，不重复造轮子
- 接口先行，实现后补
- 文档即上下文

### 术

- 明确写清能改什么、不能改什么
- Debug 只给预期 vs 实际 + 最小复现
- 代码一多就切会话

---

## 📁 项目结构模板

```
my-project/
├── memory-bank/              # AI 上下文（必须）
│   ├── prd.md                # 产品需求文档
│   ├── tech-stack.md         # 技术栈说明
│   ├── implementation-plan.md # 实施计划
│   ├── progress.md           # 进度记录
│   └── architecture.md       # 架构文档
├── src/                      # 源代码
│   ├── components/
│   ├── lib/
│   └── ...
├── CLAUDE.md                 # AI 规则文件
└── README.md
```

---

## 🔗 参考资源

- [vibe-coding-cn](https://github.com/2025Emma/vibe-coding-cn) - 中文社区
- [vibe-coding](https://github.com/EnzeD/vibe-coding) - 英文原版
- [vibevibe.cn](https://www.vibevibe.cn) - 中文教程网站

---

## 📝 更新日志

- 2025-01-05：初始版本，整合三大资源
