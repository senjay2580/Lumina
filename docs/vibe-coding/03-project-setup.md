# 项目启动流程

## 第一步：创建设计文档

### 游戏项目：Game Design Document (GDD)

```markdown
# 游戏设计文档

## 游戏概述
- 游戏名称：太空射击
- 类型：2D 射击游戏
- 平台：Web 浏览器

## 核心玩法
- 玩家控制飞船躲避障碍物
- 射击敌人获得分数
- 三条命，死亡后游戏结束

## 技术需求
- 60fps 流畅运行
- 支持键盘和触屏操作
```

### 应用项目：Product Requirements Document (PRD)

```markdown
# 产品需求文档

## 产品概述
- 产品名称：待办清单
- 目标用户：个人用户
- 核心价值：简单高效的任务管理

## 功能需求
### P0（必须有）
- 添加任务
- 删除任务
- 标记完成

### P1（应该有）
- 任务分类
- 截止日期

### P2（可以有）
- 数据导出
- 主题切换
```

---

## 第二步：确定技术栈

让 AI 推荐最适合的技术栈：

```
我要做一个 [项目描述]，请推荐最简单但足够强大的技术栈。

要求：
1. 尽可能简单，减少学习成本
2. 社区活跃，文档完善
3. 适合快速迭代
```

### 常见技术栈推荐

| 项目类型 | 推荐技术栈 |
|----------|------------|
| 静态网站 | HTML + CSS + JS |
| Web 应用 | Next.js + TypeScript + Tailwind |
| 2D 游戏 | Phaser.js 或 PixiJS |
| 3D 游戏 | Three.js + WebSocket |
| 移动应用 | React Native 或 Flutter |
| 后端 API | Node.js + Express 或 Python + FastAPI |

---

## 第三步：创建 Memory Bank

在项目根目录创建 `memory-bank` 文件夹：

```
memory-bank/
├── game-design-document.md    # 或 prd.md
├── tech-stack.md              # 技术栈说明
├── implementation-plan.md     # 实施计划
├── progress.md                # 进度记录（初始为空）
└── architecture.md            # 架构文档（初始为空）
```

### progress.md 模板

```markdown
# 开发进度

## 已完成
- [ ] Step 1: 项目初始化

## 进行中
- 无

## 待开始
- [ ] Step 2: 基础 UI
- [ ] Step 3: 核心功能
```

### architecture.md 模板

```markdown
# 项目架构

## 目录结构
（AI 会在开发过程中自动更新）

## 核心模块
（AI 会在开发过程中自动更新）

## 数据流
（AI 会在开发过程中自动更新）
```

---

## 第四步：创建 AI 规则文件

### CLAUDE.md / AGENTS.md

```markdown
# AI 开发规则

## 核心原则
1. 始终保持代码模块化，避免单文件超过 300 行
2. 每个函数只做一件事
3. 使用有意义的变量名和函数名
4. 添加必要的注释

## 必读文件（Always）
- memory-bank/architecture.md
- memory-bank/game-design-document.md

## 开发流程
1. 开始任何任务前，先阅读 memory-bank 中的所有文档
2. 完成任务后，更新 progress.md
3. 添加新模块后，更新 architecture.md

## 禁止事项
- 不要删除现有功能
- 不要修改未提及的文件
- 不要引入未经讨论的新依赖
```

### .cursorrules（Cursor 专用）

```markdown
# Cursor Rules

## 代码风格
- 使用 TypeScript
- 使用函数式组件
- 使用 Tailwind CSS

## 文件组织
- 组件放在 src/components
- 工具函数放在 src/lib
- 类型定义放在 src/types

## 命名规范
- 组件：PascalCase
- 函数：camelCase
- 常量：UPPER_SNAKE_CASE
```

---

## 第五步：生成实施计划

提示词模板：

```
基于以下文档，创建一个详细的实施计划：

1. [粘贴 GDD/PRD]
2. [粘贴技术栈]

要求：
- 每个步骤要小而具体
- 每个步骤必须包含验证测试
- 只写指令，不写代码
- 专注于基础功能，细节后面再加
```

### 实施计划示例

```markdown
# 实施计划

## Step 1: 项目初始化
- 创建项目目录
- 初始化 package.json
- 安装基础依赖
- **测试**：运行 npm run dev，确认页面显示 "Hello World"

## Step 2: 基础 UI 框架
- 创建主布局组件
- 添加导航栏
- 添加内容区域
- **测试**：页面显示导航栏和空白内容区

## Step 3: 核心功能 - 添加任务
- 创建输入框组件
- 实现添加逻辑
- 显示任务列表
- **测试**：输入文字，点击添加，列表显示新任务
```
