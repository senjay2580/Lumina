-- 012: 改进 AI 设置 - 加密存储、默认提供商、默认模型、统一配置
-- 运行此脚本前请确保已运行 005_redesign_node_templates.sql

-- ============================================
-- 1. 添加默认提供商和默认模型字段到 ai_providers
-- ============================================
ALTER TABLE ai_providers 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 添加默认模型字段 - 用户选择该提供商时默认使用的模型
ALTER TABLE ai_providers 
ADD COLUMN IF NOT EXISTS default_model VARCHAR(100);

-- 确保每个用户只有一个默认提供商
CREATE OR REPLACE FUNCTION ensure_single_default_provider()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE ai_providers 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_provider_trigger ON ai_providers;
CREATE TRIGGER ensure_single_default_provider_trigger
  BEFORE INSERT OR UPDATE ON ai_providers
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_provider();

-- ============================================
-- 2. 添加加密相关字段（用于前端加密）
-- ============================================
ALTER TABLE ai_providers 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

ALTER TABLE ai_providers 
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- ============================================
-- 3. 添加更多 AI 提供商模板（包含图标）
-- ============================================
-- 确保 icon_svg 字段存在
ALTER TABLE ai_provider_templates ADD COLUMN IF NOT EXISTS icon_svg TEXT;

-- 删除可能存在的重复 zhipu 记录（统一使用 glm）
DELETE FROM ai_provider_templates WHERE provider_key = 'zhipu';

INSERT INTO ai_provider_templates (provider_key, name, base_url, models, color, sort_order, icon_svg) 
VALUES 
  ('openai', 'OpenAI', 'https://api.openai.com/v1', 
   '[{"id": "gpt-4o", "name": "GPT-4o"}, {"id": "gpt-4o-mini", "name": "GPT-4o Mini"}, {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"}, {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"}]', 
   'emerald', 0,
   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M22.418 9.822a5.903 5.903 0 0 0-.52-4.91 6.1 6.1 0 0 0-2.822-2.513 6.204 6.204 0 0 0-3.78-.389A6.06 6.06 0 0 0 13.232.501 6.2 6.2 0 0 0 10.726 0a6.16 6.16 0 0 0-3.939 1.267 6.01 6.01 0 0 0-2.17 3.503 6.1 6.1 0 0 0-2.345 1.02 5.96 5.96 0 0 0-1.71 1.879 5.93 5.93 0 0 0 .753 7.092 5.9 5.9 0 0 0 .52 4.911 6.1 6.1 0 0 0 2.821 2.513 6.2 6.2 0 0 0 3.78.389 6.06 6.06 0 0 0 2.065 1.508 6.2 6.2 0 0 0 2.505.501 6.16 6.16 0 0 0 3.94-1.267 6.01 6.01 0 0 0 2.17-3.503 6.1 6.1 0 0 0 2.344-1.02 5.96 5.96 0 0 0 1.71-1.879 5.93 5.93 0 0 0-.752-7.092m-9.218 13.14a4.6 4.6 0 0 1-2.918-1.04l.145-.081 4.846-2.757a.77.77 0 0 0 .397-.682v-6.737l2.05 1.168q.03.017.038.052v5.583c-.003 2.479-2.041 4.49-4.558 4.494m-9.795-4.125a4.42 4.42 0 0 1-.54-3.015l.144.086 4.847 2.757a.8.8 0 0 0 .79 0l5.922-3.37v2.333a.07.07 0 0 1-.03.062l-4.903 2.79c-2.18 1.24-4.967.502-6.23-1.643m-1.275-10.41A4.5 4.5 0 0 1 4.604 6.37v5.673a.76.76 0 0 0 .392.676l5.895 3.35-2.048 1.168a.07.07 0 0 1-.072 0l-4.899-2.787a4.42 4.42 0 0 1-1.668-6.14zm16.824 3.858-5.923-3.398 2.044-1.164a.07.07 0 0 1 .072 0l4.899 2.787a4.47 4.47 0 0 1 1.757 1.812 4.44 4.44 0 0 1-.405 4.796 4.58 4.58 0 0 1-2.04 1.494v-5.645a.76.76 0 0 0-.404-.682m2.04-3.022-.144-.086-4.847-2.757a.8.8 0 0 0-.79 0l-5.922 3.37V8.257a.06.06 0 0 1 .03-.061l4.9-2.782a4.61 4.61 0 0 1 4.885.208c.712.487 1.267 1.16 1.604 1.944.336.784.44 1.647.293 2.487zM8.254 12.862l-2.05-1.168a.06.06 0 0 1-.038-.056V6.072c0-.86.254-1.7.73-2.411a4.56 4.56 0 0 1 1.912-1.658 4.62 4.62 0 0 1 4.85.616l-.145.082-4.846 2.756a.77.77 0 0 0-.397.682zm1.113-2.364 2.637-1.5 2.644 1.5v3l-2.635 1.5-2.644-1.5z"/></svg>'),
  ('claude', 'Anthropic Claude', 'https://api.anthropic.com/v1', 
   '[{"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"}, {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"}, {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku"}]', 
   'orange', 2,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/claude-color.png'),
  ('moonshot', '月之暗面 Kimi', 'https://api.moonshot.cn/v1', 
   '[{"id": "moonshot-v1-8k", "name": "Moonshot 8K"}, {"id": "moonshot-v1-32k", "name": "Moonshot 32K"}, {"id": "moonshot-v1-128k", "name": "Moonshot 128K"}]', 
   'indigo', 6,
   'https://www.kimi.com/favicon.ico'),
  ('glm', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', 
   '[{"id": "glm-4-plus", "name": "GLM-4 Plus"}, {"id": "glm-4", "name": "GLM-4"}, {"id": "glm-4-flash", "name": "GLM-4 Flash"}]', 
   'green', 4,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/zhipu-color.png'),
  ('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', 
   '[{"id": "deepseek-chat", "name": "DeepSeek Chat"}, {"id": "deepseek-coder", "name": "DeepSeek Coder"}]', 
   'blue', 3,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/deepseek-color.png'),
  ('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 
   '[{"id": "qwen-turbo", "name": "Qwen Turbo"}, {"id": "qwen-plus", "name": "Qwen Plus"}, {"id": "qwen-max", "name": "Qwen Max"}]', 
   'purple', 5,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/qwen-color.png'),
  ('baichuan', '百川智能', 'https://api.baichuan-ai.com/v1', 
   '[{"id": "Baichuan4", "name": "Baichuan 4"}, {"id": "Baichuan3-Turbo", "name": "Baichuan 3 Turbo"}]', 
   'cyan', 7,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/baichuan-color.png'),
  ('minimax', 'MiniMax', 'https://api.minimax.chat/v1', 
   '[{"id": "abab6.5s-chat", "name": "abab6.5s"}, {"id": "abab6.5g-chat", "name": "abab6.5g"}, {"id": "abab5.5s-chat", "name": "abab5.5s"}]', 
   'purple', 8,
   'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/minimax-color.png'),
  ('custom', '自定义', '', 
   '[]', 
   'gray', 99,
   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#6366F1"/><path d="M12 6c-1.1 0-2 .9-2 2v1c0 .55.45 1 1 1h2c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2z" fill="#fff"/><circle cx="12" cy="14" r="1.5" fill="#fff"/><path d="M8 17h8v1H8z" fill="#fff"/><path d="M7 12h2v3H7zM15 12h2v3h-2z" fill="#fff" opacity="0.7"/></svg>')
ON CONFLICT (provider_key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  models = EXCLUDED.models,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  icon_svg = EXCLUDED.icon_svg;

-- ============================================
-- 4. 创建获取用户默认提供商的函数（包含默认模型）
-- ============================================
CREATE OR REPLACE FUNCTION get_default_provider(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  provider_key VARCHAR,
  name VARCHAR,
  api_key VARCHAR,
  base_url VARCHAR,
  models JSONB,
  is_enabled BOOLEAN,
  default_model VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.provider_key,
    ap.name,
    ap.api_key,
    ap.base_url,
    ap.models,
    ap.is_enabled,
    ap.default_model
  FROM ai_providers ap
  WHERE ap.user_id = p_user_id 
    AND ap.is_default = true 
    AND ap.is_enabled = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ap.id,
      ap.provider_key,
      ap.name,
      ap.api_key,
      ap.base_url,
      ap.models,
      ap.is_enabled,
      ap.default_model
    FROM ai_providers ap
    WHERE ap.user_id = p_user_id AND ap.is_enabled = true
    ORDER BY ap.created_at
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 创建设置默认提供商的函数
-- ============================================
CREATE OR REPLACE FUNCTION set_default_provider(p_user_id UUID, p_provider_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ai_providers SET is_default = false WHERE user_id = p_user_id;
  UPDATE ai_providers SET is_default = true 
  WHERE id = p_provider_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 创建设置默认模型的函数
-- ============================================
CREATE OR REPLACE FUNCTION set_default_model(p_user_id UUID, p_provider_id UUID, p_model_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ai_providers 
  SET default_model = p_model_id 
  WHERE id = p_provider_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 创建获取所有启用的提供商的视图（包含默认模型）
-- ============================================
CREATE OR REPLACE VIEW enabled_ai_providers AS
SELECT 
  ap.id,
  ap.user_id,
  ap.provider_key,
  ap.name,
  ap.base_url,
  ap.models,
  ap.is_enabled,
  ap.is_default,
  ap.default_model,
  apt.color
FROM ai_providers ap
JOIN ai_provider_templates apt ON ap.provider_key = apt.provider_key
WHERE ap.is_enabled = true;

-- ============================================
-- 8. 授权
-- ============================================
GRANT SELECT ON enabled_ai_providers TO authenticated;
GRANT EXECUTE ON FUNCTION get_default_provider TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_provider TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_model TO authenticated;

-- ============================================
-- 9. 索引优化
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_providers_default ON ai_providers(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled ON ai_providers(user_id, is_enabled) WHERE is_enabled = true;
