-- 修复外键约束问题
-- 问题：外键指向了 auth.users 而不是 public.users

-- 删除错误的外键约束并重新创建
ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_user_id_fkey;
ALTER TABLE workflows 
  ADD CONSTRAINT workflows_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_user_id_fkey;
ALTER TABLE prompts 
  ADD CONSTRAINT prompts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE prompt_categories DROP CONSTRAINT IF EXISTS prompt_categories_user_id_fkey;
ALTER TABLE prompt_categories 
  ADD CONSTRAINT prompt_categories_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_user_id_fkey;
ALTER TABLE workflow_executions 
  ADD CONSTRAINT workflow_executions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE node_templates DROP CONSTRAINT IF EXISTS node_templates_user_id_fkey;
ALTER TABLE node_templates 
  ADD CONSTRAINT node_templates_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 确保 anon 角色有正确的权限
GRANT SELECT, INSERT, UPDATE ON users TO anon;
GRANT ALL ON workflows TO anon;
GRANT ALL ON prompts TO anon;
GRANT ALL ON prompt_categories TO anon;
GRANT ALL ON node_templates TO anon;
GRANT ALL ON workflow_executions TO anon;
