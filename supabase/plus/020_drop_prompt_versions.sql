-- 删除 prompt_versions 表和相关函数
-- 版本历史功能已移除

-- 删除保存版本的函数
DROP FUNCTION IF EXISTS save_prompt_version(uuid, text, text, text, text);

-- 删除 prompt_versions 表
DROP TABLE IF EXISTS prompt_versions;

-- 删除分析相关字段和函数
DROP FUNCTION IF EXISTS update_prompt_analysis(uuid, jsonb);

-- 删除 prompts 表中的 ai_analysis 字段
ALTER TABLE prompts DROP COLUMN IF EXISTS ai_analysis;

-- 确认删除成功
DO $$
BEGIN
  RAISE NOTICE '已删除 prompt_versions 表、save_prompt_version 函数、update_prompt_analysis 函数和 ai_analysis 字段';
END $$;
