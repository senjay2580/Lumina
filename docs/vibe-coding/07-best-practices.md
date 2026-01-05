# Vibe Coding 最佳实践

## MVP 思维

### 什么是 MVP？

**Minimum Viable Product（最小可行产品）**

用最少的时间和资源，做出能验证想法的产品。

### MVP 原则

1. **先能用，再好用**
   - 功能能跑通比界面漂亮重要
   - 先验证核心价值

2. **不加功能的艺术**
   - 每个功能都问：没有它能不能用？
   - 能不加就不加

3. **快速迭代**
   - 小步快跑
   - 及时获取反馈
   - 根据反馈调整

### MVP 检查清单

```markdown
□ 核心功能是否完整？
□ 用户能否完成主要任务？
□ 是否有明显 bug？
□ 是否可以部署？
□ 是否可以收集反馈？
```

---

## 上下文管理

### 为什么上下文重要？

> 垃圾进，垃圾出。

AI 的输出质量取决于输入的上下文质量。

### 上下文最佳实践

#### 1. 结构化的 Memory Bank

```
memory-bank/
├── prd.md              # 产品需求
├── tech-stack.md       # 技术栈
├── architecture.md     # 架构文档
├── progress.md         # 进度记录
└── decisions.md        # 决策记录
```

#### 2. 及时更新文档

每完成一个步骤：
- 更新 progress.md
- 更新 architecture.md（如有变化）
- 记录重要决策

#### 3. 定期清理上下文

- 会话太长时开新会话
- 使用 `/compact` 压缩上下文
- 只保留相关信息

#### 4. 提供精准上下文

❌ 错误：把整个代码库丢给 AI

✅ 正确：只提供相关的文件和信息

---

## Git 工作流

### 提交频率

**每完成一个 Step 就提交**

```bash
git add .
git commit -m "Step 3: 实现用户登录功能"
```

### 提交信息规范

```
<类型>: <简短描述>

类型：
- feat: 新功能
- fix: 修复 bug
- refactor: 重构
- docs: 文档
- style: 样式调整
- test: 测试
```

### 分支策略（简化版）

```
main        ← 稳定版本
  └── dev   ← 开发中
```

### 回滚技巧

```bash
# 查看历史
git log --oneline

# 回滚到指定提交
git reset --hard <commit-hash>

# 回滚上一个提交
git reset --hard HEAD~1
```

---

## 代码组织

### 目录结构模板

```
project/
├── memory-bank/          # AI 上下文
│   ├── prd.md
│   ├── architecture.md
│   └── progress.md
├── src/
│   ├── components/       # UI 组件
│   │   ├── common/       # 通用组件
│   │   └── features/     # 功能组件
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 工具函数
│   ├── services/         # API 服务
│   ├── types/            # 类型定义
│   └── styles/           # 样式文件
├── public/               # 静态资源
├── tests/                # 测试文件
├── CLAUDE.md             # AI 规则
└── README.md
```

### 文件命名

| 类型 | 命名方式 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `UserProfile.tsx` |
| Hook | camelCase + use 前缀 | `useAuth.ts` |
| 工具函数 | camelCase | `formatDate.ts` |
| 类型 | PascalCase | `User.ts` |
| 样式 | kebab-case | `user-profile.css` |

### 模块化原则

1. **单一职责**：每个文件只做一件事
2. **高内聚**：相关代码放在一起
3. **低耦合**：模块间依赖最小化
4. **可测试**：每个模块可独立测试

---

## 调试心法

### 调试流程

```
1. 复现问题
   ↓
2. 定位范围
   ↓
3. 分析原因
   ↓
4. 验证假设
   ↓
5. 修复问题
   ↓
6. 回归测试
```

### 常见问题排查

#### 页面空白
1. 检查控制台错误
2. 检查网络请求
3. 检查组件渲染

#### 数据不显示
1. 检查 API 返回
2. 检查状态更新
3. 检查条件渲染

#### 样式错乱
1. 检查 CSS 优先级
2. 检查类名拼写
3. 检查响应式断点

### 调试工具

- **浏览器 DevTools**：F12
- **React DevTools**：组件状态检查
- **Network 面板**：API 请求检查
- **Console**：日志输出

---

## 安全意识

### 基本安全原则

1. **永远不要信任用户输入**
2. **敏感信息不要硬编码**
3. **使用 HTTPS**
4. **定期更新依赖**

### 常见安全问题

| 问题 | 防护措施 |
|------|----------|
| XSS | 转义用户输入 |
| CSRF | 使用 CSRF Token |
| SQL 注入 | 使用参数化查询 |
| 敏感信息泄露 | 使用环境变量 |

### 环境变量

```bash
# .env.local（不要提交到 Git）
API_KEY=your-secret-key
DATABASE_URL=your-database-url
```

```javascript
// 使用环境变量
const apiKey = process.env.API_KEY;
```

---

## 部署检查清单

### 部署前

```markdown
□ 所有功能测试通过
□ 没有控制台错误
□ 环境变量配置正确
□ 敏感信息已移除
□ 构建成功无警告
□ README 已更新
```

### 部署后

```markdown
□ 页面可正常访问
□ 核心功能正常
□ API 请求正常
□ 错误监控已配置
□ 性能指标正常
```
