-- 016: 修复角色模板 RLS 策略 v2
-- 由于应用使用自定义认证而非 Supabase Auth，auth.uid() 返回 null
-- 改为使用更宽松的策略，允许所有已认证的请求

-- 删除所有旧策略
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

-- 新策略 - 分类（允许所有操作，由应用层控制权限）
CREATE POLICY "allow_all_categories" ON ai_role_categories
  FOR ALL USING (true) WITH CHECK (true);

-- 新策略 - 模板（允许所有操作，由应用层控制权限）
CREATE POLICY "allow_all_templates" ON ai_role_templates
  FOR ALL USING (true) WITH CHECK (true);
