-- Lumina Database Schema
-- Run this in Supabase SQL Editor

-- 0. Users table (自定义用户表，不使用 Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1. Workflows table (工作流)
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL DEFAULT '未命名工作流',
  description text,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  nodes jsonb DEFAULT '[]'::jsonb,
  edges jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Node Templates table (节点模板/组件库)
CREATE TABLE IF NOT EXISTS node_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  icon varchar(50),
  color varchar(20),
  category varchar(50) NOT NULL,
  default_config jsonb DEFAULT '{}'::jsonb,
  is_system boolean DEFAULT false,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. Prompt Categories table (提示词分类)
CREATE TABLE IF NOT EXISTS prompt_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  color varchar(20) NOT NULL DEFAULT 'gray',
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 4. Prompts table (提示词库)
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(100) NOT NULL,
  content text NOT NULL,
  category_id uuid REFERENCES prompt_categories(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Workflow Executions table (执行记录)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  status varchar(20) DEFAULT 'pending',
  input_data jsonb,
  output_data jsonb,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- users 表 - 允许所有操作（注册登录需要）
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

-- workflows 表 - 用户只能访问自己的工作流
CREATE POLICY "workflows_select" ON workflows FOR SELECT USING (true);
CREATE POLICY "workflows_insert" ON workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "workflows_update" ON workflows FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "workflows_delete" ON workflows FOR DELETE USING (true);

-- node_templates 表 - 系统模板所有人可见
CREATE POLICY "node_templates_all" ON node_templates FOR ALL USING (true) WITH CHECK (true);

-- prompt_categories 表 - 用户只能访问自己的分类
CREATE POLICY "prompt_categories_select" ON prompt_categories FOR SELECT USING (true);
CREATE POLICY "prompt_categories_insert" ON prompt_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "prompt_categories_update" ON prompt_categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prompt_categories_delete" ON prompt_categories FOR DELETE USING (true);

-- prompts 表 - 用户只能访问自己的提示词
CREATE POLICY "prompts_select" ON prompts FOR SELECT USING (true);
CREATE POLICY "prompts_insert" ON prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "prompts_update" ON prompts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prompts_delete" ON prompts FOR DELETE USING (true);

-- workflow_executions 表
CREATE POLICY "workflow_executions_all" ON workflow_executions FOR ALL USING (true) WITH CHECK (true);

-- Insert default system node templates
INSERT INTO node_templates (type, name, description, icon, color, category, default_config, is_system) VALUES
  ('AI_INPUT', 'AI 输入', '接收用户输入或外部数据，作为工作流的起点', 'input', 'green', 'input', 
   '{"inputType": "text", "placeholder": "请输入内容..."}'::jsonb, true),
  ('AI_PROCESSOR', 'AI 处理器', '配置 AI 提示词，处理输入流并生成输出流', 'processor', 'blue', 'processor',
   '{"model": "gpt-4o", "systemPrompt": "You are a helpful assistant.", "temperature": 0.7, "maxTokens": 2048}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category_id ON prompts(category_id);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_user_id ON prompt_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
