-- 019: 删除 prompts 表中的 category 字段
-- 该字段已被 category_id 外键替代，不再需要

-- 先删除依赖的视图
DROP VIEW IF EXISTS popular_prompts;

-- 删除 category 字段
ALTER TABLE prompts DROP COLUMN IF EXISTS category;

-- 重新创建 popular_prompts 视图（不包含 category 字段）
CREATE OR REPLACE VIEW popular_prompts AS
SELECT 
  p.id,
  p.title,
  p.content,
  p.category_id,
  p.tags,
  p.user_id,
  p.copy_count,
  p.created_at,
  p.updated_at,
  pc.name as category_name,
  pc.color as category_color
FROM prompts p
LEFT JOIN prompt_categories pc ON p.category_id = pc.id
WHERE p.deleted_at IS NULL
ORDER BY p.copy_count DESC NULLS LAST, p.created_at DESC
LIMIT 50;
