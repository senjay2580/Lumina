-- ============================================
-- 030: 提示词爬虫用户隔离
-- 为 extracted_prompts 和 crawl_jobs 添加 user_id
-- ============================================

-- 1. 为 extracted_prompts 添加 user_id 字段
ALTER TABLE public.extracted_prompts 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. 为 crawl_jobs 添加 user_id 字段
ALTER TABLE public.crawl_jobs 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. 将现有数据关联到 senjay 用户
UPDATE public.extracted_prompts 
SET user_id = (SELECT id FROM public.users WHERE username = 'senjay' LIMIT 1)
WHERE user_id IS NULL;

UPDATE public.crawl_jobs 
SET user_id = (SELECT id FROM public.users WHERE username = 'senjay' LIMIT 1)
WHERE user_id IS NULL;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_user_id ON extracted_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_user_id ON crawl_jobs(user_id);

-- 5. 添加注释
COMMENT ON COLUMN extracted_prompts.user_id IS '所属用户 ID，用于数据隔离';
COMMENT ON COLUMN crawl_jobs.user_id IS '所属用户 ID，用于数据隔离';

-- 5. 为增强功能预留字段
-- 内容哈希用于去重
ALTER TABLE public.extracted_prompts 
  ADD COLUMN IF NOT EXISTS content_hash text;

-- 创建唯一索引（每个用户内去重）
CREATE UNIQUE INDEX IF NOT EXISTS idx_extracted_prompts_user_hash 
  ON extracted_prompts(user_id, content_hash) 
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN extracted_prompts.content_hash IS '内容哈希值，用于用户内去重';

-- 6. 创建已爬取源记录表（用户隔离）
CREATE TABLE IF NOT EXISTS public.crawled_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('reddit', 'github')),
  source_id text NOT NULL,
  source_url text,
  crawled_at timestamp with time zone DEFAULT now(),
  prompts_extracted integer DEFAULT 0,
  CONSTRAINT crawled_sources_pkey PRIMARY KEY (id),
  CONSTRAINT crawled_sources_user_source_unique UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_crawled_sources_user_lookup 
  ON crawled_sources(user_id, source_type);

ALTER TABLE crawled_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON crawled_sources FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE crawled_sources IS '已爬取源记录 - 每个用户独立记录已处理的 Reddit post 或 GitHub repo';
COMMENT ON COLUMN crawled_sources.user_id IS '所属用户 ID';
COMMENT ON COLUMN crawled_sources.source_type IS '来源类型：reddit/github';
COMMENT ON COLUMN crawled_sources.source_id IS 'Reddit post ID 或 GitHub repo full_name';
COMMENT ON COLUMN crawled_sources.source_url IS '来源 URL';
COMMENT ON COLUMN crawled_sources.crawled_at IS '爬取时间';
COMMENT ON COLUMN crawled_sources.prompts_extracted IS '提取的提示词数量';
