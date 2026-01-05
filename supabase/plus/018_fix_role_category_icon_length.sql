-- 018: 修复角色分类图标字段长度
-- icon 字段需要存储 SVG 代码，varchar(50) 太短

-- 修改 ai_role_categories 表的 icon 字段为 TEXT 类型
ALTER TABLE ai_role_categories ALTER COLUMN icon TYPE TEXT;

-- 同样修改 ai_role_templates 表的 icon 字段
ALTER TABLE ai_role_templates ALTER COLUMN icon TYPE TEXT;
