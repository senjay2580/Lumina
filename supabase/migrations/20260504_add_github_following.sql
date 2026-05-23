-- GitHub 用户关注表
-- 用户关注的 GitHub 开发者列表（持久化到数据库，不再是 localStorage）

CREATE TABLE IF NOT EXISTS public.github_following (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT github_following_pkey PRIMARY KEY (id),
  CONSTRAINT github_following_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT github_following_unique UNIQUE (user_id, username)
);

CREATE INDEX IF NOT EXISTS idx_github_following_user_created
  ON public.github_following (user_id, created_at DESC);

COMMENT ON TABLE public.github_following IS 'GitHub 用户关注列表 - 用户关注的开发者账号';
COMMENT ON COLUMN public.github_following.username IS 'GitHub 用户名（login，区分大小写）';
COMMENT ON COLUMN public.github_following.display_name IS '展示名（GitHub 个人资料中的 name）';
COMMENT ON COLUMN public.github_following.note IS '用户自定义备注';

-- RLS：与项目其他表保持一致（应用层做权限隔离，DB 层 allow_all）
ALTER TABLE public.github_following ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.github_following;
CREATE POLICY "allow_all" ON public.github_following FOR ALL USING (true) WITH CHECK (true);
