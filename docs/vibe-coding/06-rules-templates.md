# AI 规则文件模板

## CLAUDE.md 模板

```markdown
# CLAUDE.md - AI 开发助手规则

## 项目概述
[一句话描述项目]

## 技术栈
- 前端：[框架]
- 样式：[CSS方案]
- 后端：[如有]
- 数据库：[如有]

---

## 核心规则

### 必读文件（每次任务前）
- memory-bank/architecture.md - 了解项目结构
- memory-bank/prd.md - 了解产品需求
- memory-bank/progress.md - 了解当前进度

### 代码规范
1. 单文件不超过 300 行
2. 单函数不超过 50 行
3. 使用有意义的命名
4. 添加必要注释

### 模块化原则
1. 按职责拆分文件
2. 组件单一职责
3. 避免循环依赖
4. 公共逻辑提取到 lib/

### 开发流程
1. 开始前阅读 memory-bank
2. 完成后更新 progress.md
3. 架构变更时更新 architecture.md
4. 每个功能都要可测试

---

## 禁止事项
- ❌ 不要删除现有功能
- ❌ 不要修改未提及的文件
- ❌ 不要引入未讨论的依赖
- ❌ 不要写超长函数
- ❌ 不要硬编码配置值

---

## 文件结构
```
src/
├── components/     # UI 组件
├── hooks/          # 自定义 Hooks
├── lib/            # 工具函数
├── services/       # API 调用
├── types/          # 类型定义
└── styles/         # 样式文件
```

---

## 命名规范
- 组件：PascalCase (UserProfile.tsx)
- 函数：camelCase (getUserData)
- 常量：UPPER_SNAKE_CASE (API_BASE_URL)
- 文件：kebab-case (user-profile.tsx) 或 PascalCase
- CSS 类：kebab-case (user-profile-card)
```

---

## .cursorrules 模板

```markdown
# Cursor Rules

## 语言和框架
- 使用 TypeScript，严格模式
- 使用 React 函数式组件
- 使用 Tailwind CSS
- 避免使用 any 类型

## 代码风格
- 优先使用 const
- 使用箭头函数
- 使用解构赋值
- 使用可选链 (?.)

## 组件规范
- 每个组件一个文件
- Props 使用 interface 定义
- 使用 React.FC 类型
- 导出使用 named export

## 状态管理
- 简单状态用 useState
- 复杂状态用 useReducer
- 全局状态用 Context
- 避免 prop drilling

## 错误处理
- API 调用要 try-catch
- 显示用户友好的错误信息
- 记录错误日志

## 性能优化
- 大列表使用虚拟滚动
- 图片使用懒加载
- 合理使用 useMemo/useCallback
- 避免不必要的重渲染

## 测试
- 组件要可测试
- 关键逻辑要有单元测试
- 使用 data-testid 标记测试元素
```

---

## AGENTS.md 模板（多 Agent 协作）

```markdown
# AGENTS.md - 多 Agent 协作规则

## Agent 角色定义

### 架构师 Agent
- 职责：系统设计、技术选型、架构决策
- 输出：architecture.md、tech-stack.md
- 触发：项目初始化、重大重构

### 开发者 Agent
- 职责：功能实现、代码编写
- 输入：implementation-plan.md
- 输出：代码文件、progress.md 更新

### 审查者 Agent
- 职责：代码审查、质量把控
- 检查：规范遵守、潜在 bug、性能问题
- 输出：审查意见、改进建议

### 测试者 Agent
- 职责：测试用例设计、测试执行
- 输出：测试报告、bug 列表

---

## 协作流程

```
架构师 → 设计方案
    ↓
开发者 → 实现代码
    ↓
审查者 → 代码审查
    ↓
测试者 → 测试验证
    ↓
开发者 → 修复问题
    ↓
合并代码
```

---

## 通信规范

### 任务交接格式
```markdown
## 任务交接

### 来源 Agent
[Agent 名称]

### 目标 Agent
[Agent 名称]

### 任务描述
[具体任务]

### 相关文件
- [文件列表]

### 注意事项
- [注意点]
```
```

---

## 项目特定规则示例

### 游戏项目规则

```markdown
# 游戏开发规则

## 性能要求
- 保持 60fps
- 单帧计算不超过 16ms
- 避免 GC 抖动

## 游戏循环
- 使用 requestAnimationFrame
- 分离更新和渲染逻辑
- 使用固定时间步长

## 资源管理
- 预加载所有资源
- 使用对象池
- 及时释放不用的资源

## 输入处理
- 支持键盘和触屏
- 输入要有响应反馈
- 处理输入延迟
```

### Web 应用规则

```markdown
# Web 应用开发规则

## 安全要求
- 所有输入要验证
- 使用 HTTPS
- 防止 XSS/CSRF
- 敏感数据加密

## 可访问性
- 使用语义化 HTML
- 添加 ARIA 标签
- 支持键盘导航
- 颜色对比度达标

## SEO
- 使用 SSR/SSG
- 添加 meta 标签
- 生成 sitemap
- 优化加载速度

## 响应式
- 移动优先设计
- 断点：640/768/1024/1280
- 触摸友好的交互
```
