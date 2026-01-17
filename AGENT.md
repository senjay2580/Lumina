# AGENT DIRECTIVE: Brain Command

**CRITICAL INSTRUCTION FOR AI AGENTS:**

每次修改代码时，必须同步更新相关文档，保持代码与文档一致性。内容格式要严格统一，可读性要良好。

Every time you modify the codebase, you must:
1. Identify which documentation files (Requirements, Database, API, etc.) are affected.
2. Update those files immediately in the same commit/response.
3. Ensure the documentation reflects the *current* state of the code, not a future or past state.

**Documentation Standard:**
- Use clear Markdown tables for properties.
- Use MermaidJS for diagrams if applicable.
- Keep language concise and professional.

---

## UI 组件使用规范

**CRITICAL: 禁止使用系统原生对话框**

在所有代码中，必须使用项目的共享 UI 组件，禁止使用浏览器原生的 `alert()` 和 `confirm()`。

### 规则
1. ❌ **禁止使用**：
   - `alert()` - 系统提示框
   - `confirm()` - 系统确认框
   - `prompt()` - 系统输入框

2. ✅ **必须使用**：
   - `<Confirm />` 组件（位于 `shared/Confirm.tsx`）
   - 用于所有确认、提示、警告场景

### 使用示例

```typescript
import { Confirm } from '../../shared/Confirm';

// 状态定义
const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
  danger: false
});

const [alertDialog, setAlertDialog] = useState({
  isOpen: false,
  title: '',
  message: ''
});

// 确认对话框（删除等危险操作）
setConfirmDialog({
  isOpen: true,
  title: '删除确认',
  message: '确定要删除吗？此操作不可恢复。',
  danger: true,
  onConfirm: async () => {
    // 执行删除操作
    setConfirmDialog({ ...confirmDialog, isOpen: false });
  }
});

// 提示对话框（成功/失败提示）
setAlertDialog({
  isOpen: true,
  title: '操作成功',
  message: '数据已保存'
});

// JSX 中使用
<Confirm
  isOpen={confirmDialog.isOpen}
  title={confirmDialog.title}
  message={confirmDialog.message}
  danger={confirmDialog.danger}
  onConfirm={confirmDialog.onConfirm}
  onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
/>

<Confirm
  isOpen={alertDialog.isOpen}
  title={alertDialog.title}
  message={alertDialog.message}
  confirmText="确定"
  onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
  onCancel={() => setAlertDialog({ ...alertDialog, isOpen: false })}
/>
```

### 检查清单
- [ ] 代码中不存在 `alert(`
- [ ] 代码中不存在 `confirm(`
- [ ] 代码中不存在 `prompt(`
- [ ] 所有确认操作使用 `<Confirm />` 组件
- [ ] 所有提示信息使用 `<Confirm />` 组件

---

## 代码变更后处理检查规则

**触发时机**: 每次完成功能修改或新增后，必须输出「变更影响分析报告」。

**分析维度（6 项必检）**

### 1. 影响范围分析
- 📍 **直接影响**：
  - 修改了哪些文件？
  - 改动了哪些函数 / 组件？
- 📍 **间接影响**：
  - 哪些模块调用了被修改的代码？
  - 哪些页面会受到影响？
  - 是否影响现有数据？

### 2. 模块集成度评估
- 🔗 **依赖关系**：
  - 当前模块依赖了哪些其他模块？
  - 有哪些模块依赖当前模块？
- 🔗 **集成点**：
  - 与哪些外部服务 / API 有交互？
  - 数据流向是什么？

### 3. 耦合度检查
- ⚠️ **耦合问题**：
  - 是否存在循环依赖？
  - 是否有硬编码的依赖？
  - 是否违反单一职责原则？
  - 组件是否过于臃肿？
- ✅ **耦合评级**：低 / 中 / 高

### 4. 潜在问题检测
- 🐛 **风险点**：
  - 边界条件是否处理？
  - 异常情况是否捕获？
  - 是否有性能隐患？
  - 是否有安全风险？
  - 是否有内存泄漏风险？

### 5. 优化建议
- 💡 **可优化项（标记优先级）**：
  - P1（建议立即处理）：xxx
  - P2（下个版本处理）：xxx
  - P3（有空再说）：xxx

### 6. 备选方案
- 🔄 **其他实现方式**：
  - 方案 B：xxx（优点 / 缺点）
  - 是否需要重构？
  - 是否有更简洁的实现？