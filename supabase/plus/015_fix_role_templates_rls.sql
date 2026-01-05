-- 015: 修复角色模板 RLS 策略
-- 解决 401 错误 - INSERT 权限问题

-- 删除旧策略
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

-- 新策略 - 分类
CREATE POLICY "categories_select" ON ai_role_categories
  FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "categories_insert" ON ai_role_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "categories_update" ON ai_role_categories
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "categories_delete" ON ai_role_categories
  FOR DELETE USING (user_id = auth.uid());

-- 新策略 - 模板
CREATE POLICY "templates_select" ON ai_role_templates
  FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "templates_insert" ON ai_role_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "templates_update" ON ai_role_templates
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "templates_delete" ON ai_role_templates
  FOR DELETE USING (user_id = auth.uid());
