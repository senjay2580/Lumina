-- 004: Add AI Settings table for persisting AI provider configurations
-- Run this in Supabase SQL Editor

-- AI Settings table (AI 配置)
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  settings jsonb NOT NULL DEFAULT '{
    "qwen": {"apiKey": "", "baseUrl": "", "enabled": false},
    "glm": {"apiKey": "", "baseUrl": "", "enabled": false},
    "google": {"apiKey": "", "enabled": false},
    "deepseek": {"apiKey": "", "baseUrl": "", "enabled": false},
    "custom": {"apiKey": "", "baseUrl": "", "enabled": false}
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - 用户只能访问自己的 AI 设置
CREATE POLICY "ai_settings_select" ON ai_settings FOR SELECT USING (true);
CREATE POLICY "ai_settings_insert" ON ai_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "ai_settings_update" ON ai_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "ai_settings_delete" ON ai_settings FOR DELETE USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);
