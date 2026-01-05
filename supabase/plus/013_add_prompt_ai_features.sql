-- 013: 提示词 AI 功能 - 翻译、优化、分析
-- 为提示词添加 AI 辅助功能支持

-- ============================================
-- 1. 扩展 prompts 表，添加翻译和分析字段
-- ============================================
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS content_en TEXT;                    -- 英文翻译版本
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS content_translated_at TIMESTAMPTZ;  -- 翻译时间
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS ai_analysis JSONB;                  -- AI 分析结果

-- ai_analysis 结构示例:
-- {
--   "quality_score": 8,
--   "issues": ["缺少具体示例", "角色定义不够清晰"],
--   "suggestions": ["添加输出格式说明", "增加约束条件"],
--   "analyzed_at": "2024-01-01T00:00:00Z"
-- }

-- ============================================
-- 2. 创建提示词版本历史表（用于 Diff 对比和回滚）
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,                          -- 版本内容
  version_type VARCHAR(20) NOT NULL,              -- 版本类型: original, optimized, translated
  change_summary TEXT,                            -- 变更摘要
  ai_model VARCHAR(100),                          -- 使用的 AI 模型
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created_at ON prompt_versions(created_at DESC);

-- ============================================
-- 3. RLS 策略
-- ============================================
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己提示词的版本历史
CREATE POLICY "Users can view own prompt versions" ON prompt_versions
  FOR SELECT USING (
    prompt_id IN (SELECT id FROM prompts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own prompt versions" ON prompt_versions
  FOR INSERT WITH CHECK (
    prompt_id IN (SELECT id FROM prompts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own prompt versions" ON prompt_versions
  FOR DELETE USING (
    prompt_id IN (SELECT id FROM prompts WHERE user_id = auth.uid())
  );

-- ============================================
-- 4. 保存提示词版本的函数
-- ============================================
CREATE OR REPLACE FUNCTION save_prompt_version(
  p_prompt_id UUID,
  p_content TEXT,
  p_version_type VARCHAR(20),
  p_change_summary TEXT DEFAULT NULL,
  p_ai_model VARCHAR(100) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_version_id UUID;
BEGIN
  INSERT INTO prompt_versions (prompt_id, content, version_type, change_summary, ai_model)
  VALUES (p_prompt_id, p_content, p_version_type, p_change_summary, p_ai_model)
  RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 更新提示词翻译的函数
-- ============================================
CREATE OR REPLACE FUNCTION update_prompt_translation(
  p_prompt_id UUID,
  p_content_en TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE prompts 
  SET content_en = p_content_en,
      content_translated_at = NOW()
  WHERE id = p_prompt_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 更新提示词 AI 分析的函数
-- ============================================
CREATE OR REPLACE FUNCTION update_prompt_analysis(
  p_prompt_id UUID,
  p_analysis JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE prompts 
  SET ai_analysis = p_analysis
  WHERE id = p_prompt_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 授权
-- ============================================
GRANT SELECT, INSERT, DELETE ON prompt_versions TO authenticated;
GRANT EXECUTE ON FUNCTION save_prompt_version TO authenticated;
GRANT EXECUTE ON FUNCTION update_prompt_translation TO authenticated;
GRANT EXECUTE ON FUNCTION update_prompt_analysis TO authenticated;
