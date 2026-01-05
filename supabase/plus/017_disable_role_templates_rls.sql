-- 017: 禁用角色模板表的 RLS
-- 由于应用使用自定义认证（users 表）而非 Supabase Auth
-- auth.uid() 始终返回 null，导致 RLS 策略无法正常工作
-- 解决方案：禁用 RLS，由应用层控制权限

-- 禁用 ai_role_categories 表的 RLS
ALTER TABLE ai_role_categories DISABLE ROW LEVEL SECURITY;

-- 禁用 ai_role_templates 表的 RLS
ALTER TABLE ai_role_templates DISABLE ROW LEVEL SECURITY;

-- 删除所有旧策略（清理）
DROP POLICY IF EXISTS "Users can view system and own categories" ON ai_role_categories;
DROP POLICY IF EXISTS "Users can manage own categories" ON ai_role_categories;
DROP POLICY IF EXISTS "Users can view system and own templates" ON ai_role_templates;
DROP POLICY IF EXISTS "Users can manage own templates" ON ai_role_templates;
DROP POLICY IF EXISTS "categories_select" ON ai_role_categories;
DROP POLICY IF EXISTS "categories_insert" ON ai_role_categories;
DROP POLICY IF EXISTS "categories_update" ON ai_role_categories;
DROP POLICY IF EXISTS "categories_delete" ON ai_role_categories;
DROP POLICY IF EXISTS "templates_select" ON ai_role_templates;
DROP POLICY IF EXISTS "templates_insert" ON ai_role_templates;
DROP POLICY IF EXISTS "templates_update" ON ai_role_templates;
DROP POLICY IF EXISTS "templates_delete" ON ai_role_templates;
DROP POLICY IF EXISTS "allow_all_categories" ON ai_role_categories;
DROP POLICY IF EXISTS "allow_all_templates" ON ai_role_templates;
