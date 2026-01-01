-- 修复 RLS 策略
-- 删除所有旧策略并重新创建

-- 删除所有可能存在的策略
DROP POLICY IF EXISTS "Allow all for users table" ON users;
DROP POLICY IF EXISTS "Allow all for workflows" ON workflows;
DROP POLICY IF EXISTS "Allow all for node_templates" ON node_templates;
DROP POLICY IF EXISTS "Allow all for prompt_categories" ON prompt_categories;
DROP POLICY IF EXISTS "Allow all for prompts" ON prompts;
DROP POLICY IF EXISTS "Allow all for workflow_executions" ON workflow_executions;

DROP POLICY IF EXISTS "users_all" ON users;
DROP POLICY IF EXISTS "workflows_all" ON workflows;
DROP POLICY IF EXISTS "workflows_select" ON workflows;
DROP POLICY IF EXISTS "workflows_insert" ON workflows;
DROP POLICY IF EXISTS "workflows_update" ON workflows;
DROP POLICY IF EXISTS "workflows_delete" ON workflows;
DROP POLICY IF EXISTS "node_templates_all" ON node_templates;
DROP POLICY IF EXISTS "prompt_categories_all" ON prompt_categories;
DROP POLICY IF EXISTS "prompt_categories_select" ON prompt_categories;
DROP POLICY IF EXISTS "prompt_categories_insert" ON prompt_categories;
DROP POLICY IF EXISTS "prompt_categories_update" ON prompt_categories;
DROP POLICY IF EXISTS "prompt_categories_delete" ON prompt_categories;
DROP POLICY IF EXISTS "prompts_all" ON prompts;
DROP POLICY IF EXISTS "prompts_select" ON prompts;
DROP POLICY IF EXISTS "prompts_insert" ON prompts;
DROP POLICY IF EXISTS "prompts_update" ON prompts;
DROP POLICY IF EXISTS "prompts_delete" ON prompts;
DROP POLICY IF EXISTS "workflow_executions_all" ON workflow_executions;

-- 重新创建策略
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "workflows_select" ON workflows FOR SELECT USING (true);
CREATE POLICY "workflows_insert" ON workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "workflows_update" ON workflows FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "workflows_delete" ON workflows FOR DELETE USING (true);

CREATE POLICY "node_templates_all" ON node_templates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "prompt_categories_select" ON prompt_categories FOR SELECT USING (true);
CREATE POLICY "prompt_categories_insert" ON prompt_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "prompt_categories_update" ON prompt_categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prompt_categories_delete" ON prompt_categories FOR DELETE USING (true);

CREATE POLICY "prompts_select" ON prompts FOR SELECT USING (true);
CREATE POLICY "prompts_insert" ON prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "prompts_update" ON prompts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prompts_delete" ON prompts FOR DELETE USING (true);

CREATE POLICY "workflow_executions_all" ON workflow_executions FOR ALL USING (true) WITH CHECK (true);
