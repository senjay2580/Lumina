-- 005: 重新设计节点模板表
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. 删除旧数据，重建 node_templates 表
-- ============================================
DROP TABLE IF EXISTS node_templates CASCADE;

CREATE TABLE node_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基础信息
  type varchar(50) NOT NULL UNIQUE,      -- 节点类型标识，如 MANUAL_TRIGGER, INPUT, AI_MODEL（唯一，用于代码引用）
  name varchar(100) NOT NULL,            -- 显示名称，如 "手动触发"、"输入"、"AI 大模型"
  description text,                      -- 节点描述，显示在组件库中
  category varchar(50) NOT NULL,         -- 分类：trigger(触发器), input(输入), processor(处理器), output(输出)
  
  -- 外观配置
  icon varchar(50),                      -- 图标名称（备用）
  icon_svg text,                         -- SVG 图标内容，直接存储 SVG 代码
  color varchar(20) DEFAULT 'gray',      -- 主题色：orange, green, blue, purple, gray 等
  shape varchar(20) DEFAULT 'rectangle', -- 节点形状：diamond(菱形), rounded(圆角), hexagon(六边形), rectangle(矩形), circle(圆形)
  
  -- 连接配置
  input_handles jsonb DEFAULT '[]',      -- 输入连接点配置 [{"id": "input", "type": "any", "label": "输入"}]
  output_handles jsonb DEFAULT '[]',     -- 输出连接点配置 [{"id": "output", "type": "any", "label": "输出"}]
  
  -- 节点配置
  default_config jsonb DEFAULT '{}',     -- 节点的默认配置值
  config_schema jsonb DEFAULT '{}',      -- 配置表单的 JSON Schema，用于动态生成配置界面
  
  -- API 关联
  requires_provider boolean DEFAULT false, -- 是否需要 AI 提供商配置（用于显示绿色/灰色状态）
  
  -- 元数据
  sort_order int DEFAULT 0,              -- 在组件库中的排序
  is_system boolean DEFAULT false,       -- 是否为系统内置节点（不可删除）
  user_id uuid REFERENCES users(id) ON DELETE CASCADE, -- 用户自定义节点的所有者
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. 插入系统节点模板
-- ============================================
INSERT INTO node_templates (
  type, name, description, category,
  icon, icon_svg, color, shape,
  input_handles, output_handles,
  default_config, config_schema,
  requires_provider, sort_order, is_system
) VALUES

-- 【手动触发器】圆角正方形，橙色，无输入，一个输出，左上角有触发标记
(
  'MANUAL_TRIGGER',
  '手动触发',
  '点击按钮手动触发工作流执行',
  'trigger',
  'play',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  'green',
  'rounded',
  '[]'::jsonb,  -- 无输入
  '[{"id": "output", "type": "trigger", "label": "触发"}]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  false,
  1,
  true
),

-- 【输入节点】圆角正方形，绿色，无输入，一个输出
(
  'INPUT',
  '输入',
  '接收用户输入的文本或上传的文件',
  'input',
  'message',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  'blue',
  'rounded',
  '[]'::jsonb,  -- 无输入（起始节点）
  '[{"id": "output", "type": "text", "label": "输出"}]'::jsonb,
  '{
    "inputMode": "text",
    "placeholder": "请输入内容...",
    "acceptFileTypes": ".txt,.pdf,.doc,.docx,.md"
  }'::jsonb,
  '{
    "type": "object",
    "properties": {
      "inputMode": {
        "type": "string",
        "title": "输入模式",
        "enum": ["text", "file", "both"],
        "enumNames": ["仅文本", "仅文件", "文本和文件"],
        "default": "text"
      },
      "placeholder": {
        "type": "string",
        "title": "占位提示"
      },
      "acceptFileTypes": {
        "type": "string",
        "title": "允许的文件类型",
        "description": "用逗号分隔，如 .txt,.pdf"
      }
    }
  }'::jsonb,
  false,
  2,
  true
),

-- 【AI 大模型】圆形，蓝色，一个输入，一个输出
(
  'AI_MODEL',
  'AI 大模型',
  '调用 AI 大模型处理输入，支持配置提示词和模型参数',
  'processor',
  'sparkles',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  'purple',
  'circle',
  '[{"id": "input", "type": "text", "label": "输入"}]'::jsonb,
  '[{"id": "output", "type": "text", "label": "输出"}]'::jsonb,
  '{
    "providerId": null,
    "model": "",
    "systemPrompt": "",
    "promptId": null,
    "temperature": 0.7,
    "maxTokens": 2048
  }'::jsonb,
  '{
    "type": "object",
    "properties": {
      "providerId": {
        "type": "string",
        "title": "AI 提供商",
        "format": "provider-selector"
      },
      "model": {
        "type": "string",
        "title": "模型"
      },
      "promptId": {
        "type": "string",
        "title": "提示词模板",
        "format": "prompt-selector"
      },
      "systemPrompt": {
        "type": "string",
        "title": "系统提示词",
        "format": "textarea"
      },
      "temperature": {
        "type": "number",
        "title": "温度",
        "minimum": 0,
        "maximum": 2,
        "default": 0.7
      },
      "maxTokens": {
        "type": "integer",
        "title": "最大 Token 数",
        "default": 2048
      }
    }
  }'::jsonb,
  true,  -- 需要配置 AI 提供商
  3,
  true
);

-- ============================================
-- 3. AI 提供商模板表（系统预设）
-- ============================================
DROP TABLE IF EXISTS ai_provider_templates CASCADE;

CREATE TABLE ai_provider_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key varchar(50) NOT NULL UNIQUE,  -- 提供商标识：qwen, deepseek, glm, openai, custom
  name varchar(100) NOT NULL,                -- 显示名称
  base_url varchar(500),                     -- 默认 API 地址
  models jsonb DEFAULT '[]',                 -- 支持的模型列表
  icon_svg text,                             -- 图标
  color varchar(20) DEFAULT 'gray',          -- 主题色
  sort_order int DEFAULT 0
);

INSERT INTO ai_provider_templates (provider_key, name, base_url, models, color, sort_order) VALUES
('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 
 '[{"id": "qwen-turbo", "name": "Qwen Turbo"}, {"id": "qwen-plus", "name": "Qwen Plus"}, {"id": "qwen-max", "name": "Qwen Max"}]', 'purple', 1),
('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1',
 '[{"id": "deepseek-chat", "name": "DeepSeek Chat"}, {"id": "deepseek-coder", "name": "DeepSeek Coder"}]', 'blue', 2),
('glm', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4',
 '[{"id": "glm-4", "name": "GLM-4"}, {"id": "glm-4-flash", "name": "GLM-4 Flash"}]', 'green', 3),
('openai', 'OpenAI', 'https://api.openai.com/v1',
 '[{"id": "gpt-4o", "name": "GPT-4o"}, {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"}, {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"}]', 'emerald', 4),
('custom', '自定义', '', '[]', 'gray', 99);

-- ============================================
-- 4. 用户 AI 提供商配置表
-- ============================================
DROP TABLE IF EXISTS ai_providers CASCADE;

CREATE TABLE ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider_key varchar(50) NOT NULL,         -- 关联 ai_provider_templates.provider_key
  name varchar(100) NOT NULL,                -- 显示名称（可自定义）
  api_key varchar(500),                      -- API Key
  base_url varchar(500),                     -- API 地址（可覆盖默认）
  models jsonb DEFAULT '[]',                 -- 模型列表（可自定义）
  is_enabled boolean DEFAULT false,          -- 是否已启用（配置了 API Key）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_key)
);

-- ============================================
-- 5. RLS 策略
-- ============================================
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

-- node_templates: 系统节点所有人可见，用户节点只有自己可见
CREATE POLICY "node_templates_select" ON node_templates FOR SELECT USING (is_system = true OR user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "node_templates_all" ON node_templates FOR ALL USING (true) WITH CHECK (true);

-- ai_provider_templates: 所有人可读
CREATE POLICY "ai_provider_templates_read" ON ai_provider_templates FOR SELECT USING (true);

-- ai_providers: 用户只能操作自己的配置
CREATE POLICY "ai_providers_all" ON ai_providers FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. 触发器和索引
-- ============================================
DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON ai_providers;
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_node_templates_category ON node_templates(category);
CREATE INDEX IF NOT EXISTS idx_node_templates_sort ON node_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id);
