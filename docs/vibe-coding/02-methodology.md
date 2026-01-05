# Vibe Coding 方法论

## 法：核心方法

### 1. 一句话目标 + 非目标

在开始任何项目前，明确：
- **目标**：这个项目要实现什么？
- **非目标**：这个项目不做什么？

```markdown
## 目标
- 创建一个简单的待办事项应用
- 支持添加、删除、标记完成

## 非目标
- 不需要用户登录
- 不需要数据持久化（本地存储即可）
- 不需要多设备同步
```

### 2. 正交性

功能不要太重复，每个模块职责单一。

### 3. 能抄不写

- 不重复造轮子
- 先问 AI 有没有合适的仓库
- 下载下来改比从零开始快

### 4. 官方文档优先

一定要看官方文档，先把官方文档爬下来喂给 AI。

### 5. 按职责拆模块

```
src/
├── components/     # UI 组件
├── hooks/          # 自定义 Hooks
├── lib/            # 工具函数
├── services/       # API 调用
└── types/          # 类型定义
```

### 6. 接口先行，实现后补

先定义好数据结构和接口，再写具体实现。

### 7. 一次只改一个模块

避免同时修改多个文件导致混乱。

### 8. 文档即上下文

文档不是事后补的，而是开发过程中的核心上下文。

---

## 术：具体技巧

### 与 AI 沟通的技巧

#### 1. 明确边界

```markdown
## 你可以修改
- src/components/Button.tsx
- src/styles/button.css

## 你不能修改
- src/lib/api.ts
- package.json
```

#### 2. Debug 只给必要信息

```markdown
## 预期行为
点击按钮后，列表应该刷新

## 实际行为
点击按钮后，页面无响应

## 最小复现步骤
1. 打开页面
2. 点击"刷新"按钮
3. 观察控制台

## 错误信息
TypeError: Cannot read property 'map' of undefined
```

#### 3. 测试可交给 AI，断言人审

让 AI 写测试代码，但测试用例和断言条件要人工审核。

#### 4. 代码一多就切会话

上下文太长会导致 AI 迷失，及时开新会话。

### 提示词技巧

#### 触发深度思考

```
think < think hard < think harder < ultrathink
```

#### 要求精确执行

```
Think as long as needed to get this right, I am not in a hurry. 
What matters is that you follow precisely what I ask you and execute it perfectly. 
Ask me questions if I am not precise enough.
```

---

## 元方法论：递归自优化

### 核心概念

构建一个能够自我优化的 AI 系统：

#### 1. 定义核心角色

- **α-提示词（生成器）**：生成其他提示词或技能的"母体"提示词
- **Ω-提示词（优化器）**：优化其他提示词或技能的"母体"提示词

#### 2. 递归生命周期

```
1. 创生 (Bootstrap)
   └── 使用 AI 生成 α-提示词 和 Ω-提示词 的初始版本 (v1)

2. 自省与进化 (Self-Correction)
   └── 使用 Ω-提示词 (v1) 优化 α-提示词 (v1) → α-提示词 (v2)

3. 创造 (Generation)
   └── 使用 α-提示词 (v2) 生成所有目标提示词和技能

4. 循环与飞跃 (Recursive Loop)
   └── 将新产物反馈给系统，启动持续进化
```

#### 3. 终极目标

通过持续的递归优化循环，系统在每次迭代中实现自我超越。
