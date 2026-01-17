# 我的创作 - 架构设计文档

## 概述

"我的创作"是一个高度可扩展的多版本内容管理系统，支持多种创作类型（简历、文章、设计、代码等），提供版本管理和 GitHub 风格的对比功能。

## 核心特性

### 1. 插件化架构
- **创作类型注册表**：通过 `CREATION_TYPES` 配置新的创作类型
- **动态组件加载**：每种创作类型有独立的编辑器、预览和对比组件
- **零耦合设计**：添加新类型无需修改核心代码

### 2. 版本管理系统
- **多版本存储**：每个创作项目可以有无限个版本
- **版本切换**：随时切换到任意历史版本
- **版本标签**：支持 draft、published、archived 等标签
- **变更说明**：每个版本可以添加变更描述

### 3. 版本对比功能
- **GitHub 风格 Diff**：类似 GitHub 的对比视图
- **智能变更检测**：自动识别新增、删除、修改
- **可视化展示**：颜色区分不同类型的变更
- **路径映射**：将 JSON 路径转换为可读的中文描述

## 技术架构

### 数据库设计

```sql
-- 创作项目表
creations
  - id: UUID
  - user_id: UUID (外键)
  - type: TEXT (resume, article, design, code, document)
  - title: TEXT
  - description: TEXT
  - current_version_id: UUID (外键到 creation_versions)
  - metadata: JSONB
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

-- 创作版本表
creation_versions
  - id: UUID
  - creation_id: UUID (外键)
  - version_number: INTEGER
  - title: TEXT
  - content: JSONB (灵活的 JSON 结构)
  - change_description: TEXT
  - tags: TEXT[]
  - created_at: TIMESTAMPTZ
  - created_by: UUID (外键)
```

### 文件结构

```
lib/
  creations.ts                    # 核心库（类型定义、CRUD、版本管理）

components/
  CreationsPage.tsx               # 主页面（创作列表）
  creations/
    ResumeEditorModal.tsx         # 简历编辑器模态框（版本管理）
    ResumeEditor.tsx              # 简历编辑器（表单）
    ResumePreview.tsx             # 简历预览
    ResumeDiffView.tsx            # 简历对比视图
    
    # 未来扩展：
    ArticleEditor.tsx             # 文章编辑器
    DesignEditor.tsx              # 设计编辑器
    CodeEditor.tsx                # 代码编辑器
    ...

supabase/migrations/
  20260117_add_creations.sql      # 数据库迁移
```

## 如何添加新的创作类型

### 步骤 1：在 `lib/creations.ts` 中注册新类型

```typescript
export const CREATION_TYPES: Record<CreationType, CreationTypeConfig> = {
  // ... 现有类型
  
  // 新类型：博客文章
  blog: {
    id: 'blog',
    name: '博客',
    icon: 'BookOpen',
    color: '#10B981',
    description: '撰写博客文章',
    editorComponent: 'BlogEditor',
    previewComponent: 'BlogPreview',
    diffComponent: 'BlogDiff',
    defaultContent: {
      title: '',
      content: '',
      tags: [],
      coverImage: '',
      seo: {
        description: '',
        keywords: []
      }
    }
  }
};
```

### 步骤 2：创建编辑器组件

```typescript
// components/creations/BlogEditor.tsx
interface BlogContent {
  title: string;
  content: string;
  tags: string[];
  coverImage: string;
  seo: {
    description: string;
    keywords: string[];
  };
}

interface Props {
  content: BlogContent;
  onChange: (content: BlogContent) => void;
}

export function BlogEditor({ content, onChange }: Props) {
  // 实现编辑器 UI
}
```

### 步骤 3：创建预览组件

```typescript
// components/creations/BlogPreview.tsx
export function BlogPreview({ content }: { content: BlogContent }) {
  // 实现预览 UI
}
```

### 步骤 4：创建对比组件

```typescript
// components/creations/BlogDiffView.tsx
export function BlogDiffView({ diff, onBack }: Props) {
  // 实现对比 UI（可以复用 ResumeDiffView 的逻辑）
}
```

### 步骤 5：在主模态框中添加路由

```typescript
// components/creations/BlogEditorModal.tsx
// 类似 ResumeEditorModal，处理版本管理逻辑
```

### 步骤 6：在 CreationsPage 中添加条件渲染

```typescript
{editingCreation && editingCreation.type === 'blog' && (
  <BlogEditorModal
    isOpen={!!editingCreation}
    onClose={() => {
      setEditingCreation(null);
      loadData();
    }}
    creation={editingCreation}
    userId={userId}
  />
)}
```

## 核心 API

### 创作项目管理

```typescript
// 获取所有创作
getCreations(userId: string, type?: CreationType): Promise<Creation[]>

// 创建新创作
createCreation(userId: string, type: CreationType, title: string, description?: string): Promise<Creation>

// 更新创作
updateCreation(creationId: string, updates: Partial<Creation>): Promise<void>

// 删除创作
deleteCreation(creationId: string): Promise<void>
```

### 版本管理

```typescript
// 获取所有版本
getVersions(creationId: string): Promise<CreationVersion[]>

// 创建新版本
createVersion(
  creationId: string,
  userId: string,
  content: any,
  title?: string,
  changeDescription?: string,
  tags?: string[]
): Promise<CreationVersion>

// 设置当前版本
setCurrentVersion(creationId: string, versionId: string): Promise<void>

// 对比两个版本
compareVersions(versionA: CreationVersion, versionB: CreationVersion): VersionDiff
```

## 设计原则

### 1. 内容结构灵活性
- 使用 JSONB 存储内容，支持任意结构
- 每种创作类型定义自己的 `defaultContent`
- 不强制统一的内容格式

### 2. 组件独立性
- 每种创作类型的组件完全独立
- 编辑器、预览、对比组件可以独立开发和测试
- 组件之间通过标准接口通信

### 3. 版本管理通用性
- 版本管理逻辑与创作类型无关
- 所有创作类型共享相同的版本系统
- 版本对比算法通用（基于 JSON diff）

### 4. 扩展性优先
- 添加新类型只需要配置和组件
- 核心代码无需修改
- 支持未来的高级功能（如协作、评论等）

## 未来扩展方向

### 1. 协作功能
- 多人同时编辑
- 实时同步
- 冲突解决

### 2. 导出功能
- PDF 导出（简历）
- Markdown 导出（文章）
- 图片导出（设计）

### 3. 模板系统
- 预设模板
- 用户自定义模板
- 模板市场

### 4. AI 辅助
- 内容优化建议
- 自动排版
- 智能补全

### 5. 版本分支
- 类似 Git 的分支功能
- 合并版本
- 版本树可视化

## 性能优化

### 1. 懒加载
- 编辑器组件按需加载
- 版本列表分页加载
- 大文件内容流式加载

### 2. 缓存策略
- 当前版本内容缓存
- 版本列表缓存
- 对比结果缓存

### 3. 乐观更新
- 保存时立即更新 UI
- 后台同步到服务器
- 失败时回滚

## 安全考虑

### 1. 权限控制
- RLS 策略确保用户只能访问自己的创作
- 版本访问权限继承自创作项目
- 敏感内容加密存储

### 2. 数据验证
- 内容大小限制
- 版本数量限制
- 输入内容验证

### 3. 审计日志
- 记录所有版本创建
- 记录版本切换操作
- 记录删除操作

## 总结

"我的创作"模块采用插件化架构，通过配置驱动的方式支持多种创作类型。核心的版本管理系统提供了强大的版本控制和对比功能，类似于 Git 但更适合内容创作场景。

这个设计确保了：
- ✅ 高度可扩展：添加新类型只需配置和组件
- ✅ 低耦合：各创作类型完全独立
- ✅ 易维护：清晰的代码结构和职责分离
- ✅ 用户友好：直观的版本管理和对比界面
