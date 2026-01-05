-- 提示词爬取系统数据库设计
-- 用于自动从 Reddit 和 GitHub 抓取 AI 提示词相关内容

-- 1. 来源记录表 - 存储原始抓取数据
CREATE TABLE IF NOT EXISTS prompt_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('reddit', 'github', 'manual')),
  source_id TEXT NOT NULL,                    -- Reddit post ID 或 GitHub repo full_name
  source_url TEXT NOT NULL,
  title TEXT,
  content TEXT,                               -- 原始内容
  author TEXT,                                -- 作者
  score INTEGER DEFAULT 0,                    -- Reddit upvotes 或 GitHub stars
  raw_data JSONB,                             -- 完整原始数据
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

-- 2. 提取的提示词表 - AI 分析后提取的高质量提示词
CREATE TABLE IF NOT EXISTS extracted_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES prompt_sources(id) ON DELETE CASCADE,
  prompt_title TEXT NOT NULL,
  prompt_content TEXT NOT NULL,
  suggested_category TEXT,                    -- AI 建议的分类
  quality_score FLOAT DEFAULT 0,              -- AI 评分 0-10
  ai_analysis JSONB,                          -- AI 分析详情
  language TEXT DEFAULT 'en',                 -- 语言
  is_approved BOOLEAN DEFAULT FALSE,          -- 是否已审核通过
  approved_by UUID REFERENCES users(id),
  imported_to_prompt_id UUID REFERENCES prompts(id), -- 导入后的提示词 ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 爬取任务记录表 - 追踪爬取历史
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('reddit', 'github', 'all')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  prompts_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 爬取配置表 - 存储 API 密钥和配置
CREATE TABLE IF NOT EXISTS crawl_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_prompt_sources_type ON prompt_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_prompt_sources_crawled_at ON prompt_sources(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_approved ON extracted_prompts(is_approved);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_quality ON extracted_prompts(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_source ON extracted_prompts(source_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);

-- RLS 策略
ALTER TABLE prompt_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_config ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（后续可以根据需要限制）
CREATE POLICY "prompt_sources_all" ON prompt_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "extracted_prompts_all" ON extracted_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crawl_jobs_all" ON crawl_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crawl_config_all" ON crawl_config FOR ALL USING (true) WITH CHECK (true);

-- 插入默认配置
INSERT INTO crawl_config (config_key, config_value) VALUES
  ('reddit_subreddits', '["ChatGPT","ChatGPTPro","PromptEngineering","LocalLLaMA","ClaudeAI","OpenAI","Anthropic"]'),
  ('github_search_queries', '["prompt engineering","chatgpt prompts","llm prompts","awesome prompts","ai prompts"]'),
  ('min_reddit_score', '10'),
  ('min_github_stars', '50'),
  ('crawl_interval_hours', '24'),
  ('ai_quality_threshold', '6.0')
ON CONFLICT (config_key) DO NOTHING;
