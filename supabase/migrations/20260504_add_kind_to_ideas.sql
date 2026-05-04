-- 拆分 ideas 表为想法 / 文章两类
-- kind: 'idea' 或 'article'，默认 'idea' 保持兼容
-- cover_url: 文章封面图 URL（仅 article 使用）
-- excerpt: 文章摘要（仅 article 使用，可选）

ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS excerpt text;

ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_kind_check;
ALTER TABLE ideas
  ADD CONSTRAINT ideas_kind_check CHECK (kind IN ('idea', 'article'));

CREATE INDEX IF NOT EXISTS idx_ideas_user_kind_created
  ON ideas (user_id, kind, created_at DESC);
