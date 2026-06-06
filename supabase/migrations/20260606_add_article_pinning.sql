-- 文章置顶：复用 ideas 表，article/idea 均可安全带字段
-- 文章回收站：deleted_at 软删除字段，删除后可在回收站恢复或永久删除

ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ideas_user_kind_pinned_created
  ON ideas (user_id, kind, is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ideas_user_kind_deleted
  ON ideas (user_id, kind, deleted_at DESC);
