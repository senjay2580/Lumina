-- 爬取配置表（用户自定义关键词）
-- 运行此迁移以添加 crawl_configs 表

CREATE TABLE IF NOT EXISTS public.crawl_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  reddit_subreddits jsonb DEFAULT '[]'::jsonb,
  github_search_queries jsonb DEFAULT '[]'::jsonb,
  min_reddit_score integer DEFAULT 10,
  min_github_stars integer DEFAULT 50,
  ai_quality_threshold double precision DEFAULT 6.0,
  ai_analysis_prompt text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crawl_configs_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE crawl_configs IS '爬取配置表 - 用户自定义的采集关键词和参数';
COMMENT ON COLUMN crawl_configs.user_id IS '所属用户 ID（唯一）';
COMMENT ON COLUMN crawl_configs.reddit_subreddits IS 'Reddit 子版块列表 JSON 数组';
COMMENT ON COLUMN crawl_configs.github_search_queries IS 'GitHub 搜索关键词列表 JSON 数组';
COMMENT ON COLUMN crawl_configs.min_reddit_score IS 'Reddit 最低分数阈值';
COMMENT ON COLUMN crawl_configs.min_github_stars IS 'GitHub 最低 Star 数阈值';
COMMENT ON COLUMN crawl_configs.ai_quality_threshold IS 'AI 质量评分阈值';
COMMENT ON COLUMN crawl_configs.ai_analysis_prompt IS 'AI 分析提示词（用户自定义）';

-- 用户自定义采集模板表
CREATE TABLE IF NOT EXISTS public.crawl_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name character varying NOT NULL,
  description text,
  reddit_subreddits jsonb DEFAULT '[]'::jsonb,
  github_search_queries jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crawl_templates_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE crawl_templates IS '用户自定义采集模板';
COMMENT ON COLUMN crawl_templates.user_id IS '所属用户 ID';
COMMENT ON COLUMN crawl_templates.name IS '模板名称';
COMMENT ON COLUMN crawl_templates.description IS '模板描述';
COMMENT ON COLUMN crawl_templates.reddit_subreddits IS 'Reddit 子版块列表';
COMMENT ON COLUMN crawl_templates.github_search_queries IS 'GitHub 搜索关键词列表';

-- 启用 RLS
ALTER TABLE crawl_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_templates ENABLE ROW LEVEL SECURITY;

-- 开放访问策略
CREATE POLICY "allow_all" ON crawl_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crawl_templates FOR ALL USING (true) WITH CHECK (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_crawl_configs_user_id ON crawl_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_templates_user_id ON crawl_templates(user_id);

-- 自动更新 updated_at 触发器
DROP TRIGGER IF EXISTS update_crawl_configs_updated_at ON crawl_configs;
CREATE TRIGGER update_crawl_configs_updated_at
  BEFORE UPDATE ON crawl_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
