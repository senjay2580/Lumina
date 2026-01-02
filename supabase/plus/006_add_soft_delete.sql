-- 为工作流和提示词添加软删除字段
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_workflows_deleted_at ON workflows(deleted_at);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_at ON prompts(deleted_at);
