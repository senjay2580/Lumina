-- 文章笔记 / 备注表（评论区式）
CREATE TABLE IF NOT EXISTS article_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_notes_article_created
  ON article_notes(article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_article_notes_user
  ON article_notes(user_id);
