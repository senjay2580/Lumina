-- 提示词置顶功能
-- 添加 is_pinned 和 pinned_at 字段

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- 创建索引加速置顶查询
CREATE INDEX IF NOT EXISTS idx_prompts_is_pinned ON prompts(user_id, is_pinned) WHERE is_pinned = TRUE;

COMMENT ON COLUMN prompts.is_pinned IS '是否置顶';
COMMENT ON COLUMN prompts.pinned_at IS '置顶时间';
