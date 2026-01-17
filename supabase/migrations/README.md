# 数据库迁移说明

## 如何执行迁移

### 方法 1：通过 Supabase Dashboard（推荐）

1. 打开 Supabase Dashboard: https://supabase.com/dashboard
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"
4. 点击 "New query"
5. 复制 `20260117_add_creations.sql` 文件的全部内容
6. 粘贴到 SQL 编辑器中
7. 点击 "Run" 执行

### 方法 2：使用 Supabase CLI

```bash
# 如果已安装 Supabase CLI
supabase db push
```

## 迁移文件列表

### 20260117_add_creations.sql
创建"我的创作"模块的数据库表：
- `public.creations` - 创作项目表
- `public.creation_versions` - 创作版本表
- RLS 策略和索引

**重要说明：**
- 使用 `public.users(id)` 作为外键（不是 `auth.users`）
- RLS 策略通过 `auth.uid()` 映射到 `public.users.auth_id`
- 支持多版本管理和版本切换

## 验证迁移是否成功

执行以下 SQL 查询来验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('creations', 'creation_versions');

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('creations', 'creation_versions');

-- 检查策略是否创建
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('creations', 'creation_versions');
```

## 回滚迁移

如果需要回滚，执行以下 SQL：

```sql
-- 删除表（会级联删除所有数据）
DROP TABLE IF EXISTS public.creation_versions CASCADE;
DROP TABLE IF EXISTS public.creations CASCADE;
```

## 常见问题

### Q: 出现 "new row violates row-level security policy" 错误
A: 确保：
1. 迁移脚本已经执行
2. 用户已登录（`auth.uid()` 不为空）
3. `public.users` 表中存在对应的用户记录

### Q: 外键约束错误
A: 确保 `public.users` 表存在且包含 `id` 和 `auth_id` 字段

### Q: 如何查看当前用户的 user_id
```sql
SELECT id, auth_id, email 
FROM public.users 
WHERE auth_id = auth.uid();
```
