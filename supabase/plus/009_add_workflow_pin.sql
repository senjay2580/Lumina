-- 添加工作流置顶字段
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 添加索引优化排序查询
CREATE INDEX IF NOT EXISTS idx_workflows_pinned ON workflows(user_id, is_pinned DESC, updated_at DESC);
