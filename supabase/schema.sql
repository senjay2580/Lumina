-- ============================================
-- Lumina Database Schema (完整版)
-- 基于 Supabase 导出的最新结构
-- 最后更新: 2026-01-06
-- ============================================

-- ============================================
-- 1. 核心用户表
-- ============================================

-- 用户账户表
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email character varying UNIQUE,
  email_verified boolean DEFAULT false,
  login_attempts integer DEFAULT 0,
  locked_until timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE users IS '用户账户表 - 存储用户基本信息和认证数据';
COMMENT ON COLUMN users.id IS '用户唯一标识';
COMMENT ON COLUMN users.username IS '用户名，用于登录';
COMMENT ON COLUMN users.password_hash IS '密码哈希值';
COMMENT ON COLUMN users.email IS '邮箱地址，用于登录和找回密码';
COMMENT ON COLUMN users.email_verified IS '邮箱是否已验证';
COMMENT ON COLUMN users.login_attempts IS '连续登录失败次数，用于账户锁定';
COMMENT ON COLUMN users.locked_until IS '账户锁定截止时间';

-- ============================================
-- 2. 工作流相关表
-- ============================================

-- 工作流表
CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL DEFAULT '未命名工作流',
  description text,
  user_id uuid,
  nodes jsonb DEFAULT '[]'::jsonb,
  edges jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  is_pinned boolean DEFAULT false,
  CONSTRAINT workflows_pkey PRIMARY KEY (id),
  CONSTRAINT workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE workflows IS '工作流表 - 存储用户创建的 AI 工作流';
COMMENT ON COLUMN workflows.id IS '工作流唯一标识';
COMMENT ON COLUMN workflows.name IS '工作流名称';
COMMENT ON COLUMN workflows.description IS '工作流描述';
COMMENT ON COLUMN workflows.user_id IS '所属用户 ID';
COMMENT ON COLUMN workflows.nodes IS '节点配置 JSON 数组';
COMMENT ON COLUMN workflows.edges IS '连接线配置 JSON 数组';
COMMENT ON COLUMN workflows.deleted_at IS '软删除时间';
COMMENT ON COLUMN workflows.is_pinned IS '是否置顶';

-- 工作流执行记录
CREATE TABLE public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  user_id uuid,
  status character varying DEFAULT 'pending',
  input_data jsonb,
  output_data jsonb,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT workflow_executions_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id)
);

COMMENT ON TABLE workflow_executions IS '工作流执行记录 - 追踪工作流运行历史';
COMMENT ON COLUMN workflow_executions.id IS '执行记录唯一标识';
COMMENT ON COLUMN workflow_executions.workflow_id IS '关联的工作流 ID';
COMMENT ON COLUMN workflow_executions.user_id IS '执行用户 ID';
COMMENT ON COLUMN workflow_executions.status IS '执行状态：pending/running/completed/failed';
COMMENT ON COLUMN workflow_executions.input_data IS '输入数据 JSON';
COMMENT ON COLUMN workflow_executions.output_data IS '输出结果 JSON';
COMMENT ON COLUMN workflow_executions.error_message IS '错误信息';
COMMENT ON COLUMN workflow_executions.started_at IS '开始时间';
COMMENT ON COLUMN workflow_executions.completed_at IS '完成时间';

-- 节点模板库
CREATE TABLE public.node_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  category character varying NOT NULL,
  icon character varying,
  icon_svg text,
  color character varying DEFAULT 'gray',
  shape character varying DEFAULT 'rectangle',
  input_handles jsonb DEFAULT '[]'::jsonb,
  output_handles jsonb DEFAULT '[]'::jsonb,
  default_config jsonb DEFAULT '{}'::jsonb,
  config_schema jsonb DEFAULT '{}'::jsonb,
  requires_provider boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT node_templates_pkey PRIMARY KEY (id),
  CONSTRAINT node_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE node_templates IS '节点模板库 - 预设和自定义的工作流节点组件';
COMMENT ON COLUMN node_templates.id IS '模板唯一标识';
COMMENT ON COLUMN node_templates.type IS '节点类型标识（唯一）';
COMMENT ON COLUMN node_templates.name IS '节点显示名称';
COMMENT ON COLUMN node_templates.description IS '节点描述';
COMMENT ON COLUMN node_templates.category IS '节点分类';
COMMENT ON COLUMN node_templates.icon IS '图标名称';
COMMENT ON COLUMN node_templates.icon_svg IS '自定义 SVG 图标';
COMMENT ON COLUMN node_templates.color IS '主题颜色';
COMMENT ON COLUMN node_templates.shape IS '节点形状';
COMMENT ON COLUMN node_templates.input_handles IS '输入连接点配置';
COMMENT ON COLUMN node_templates.output_handles IS '输出连接点配置';
COMMENT ON COLUMN node_templates.default_config IS '默认配置 JSON';
COMMENT ON COLUMN node_templates.config_schema IS '配置表单 Schema';
COMMENT ON COLUMN node_templates.requires_provider IS '是否需要 AI 提供商';
COMMENT ON COLUMN node_templates.sort_order IS '排序顺序';
COMMENT ON COLUMN node_templates.is_system IS '是否为系统预设模板';
COMMENT ON COLUMN node_templates.user_id IS '创建用户 ID（系统模板为空）';

-- ============================================
-- 3. 提示词相关表
-- ============================================

-- 提示词分类
CREATE TABLE public.prompt_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  color character varying NOT NULL DEFAULT 'gray',
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_categories_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE prompt_categories IS '提示词分类表 - 用户自定义的提示词分类';
COMMENT ON COLUMN prompt_categories.id IS '分类唯一标识';
COMMENT ON COLUMN prompt_categories.name IS '分类名称';
COMMENT ON COLUMN prompt_categories.color IS '分类颜色标识';
COMMENT ON COLUMN prompt_categories.user_id IS '所属用户 ID';

-- 提示词库
CREATE TABLE public.prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  deleted_at timestamp with time zone,
  copy_count integer DEFAULT 0,
  last_copied_at timestamp with time zone,
  content_en text,
  content_translated_at timestamp with time zone,
  CONSTRAINT prompts_pkey PRIMARY KEY (id),
  CONSTRAINT prompts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.prompt_categories(id),
  CONSTRAINT prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE prompts IS '提示词库 - 用户保存的 AI 提示词';
COMMENT ON COLUMN prompts.id IS '提示词唯一标识';
COMMENT ON COLUMN prompts.title IS '提示词标题';
COMMENT ON COLUMN prompts.content IS '提示词内容';
COMMENT ON COLUMN prompts.tags IS '标签数组';
COMMENT ON COLUMN prompts.user_id IS '所属用户 ID';
COMMENT ON COLUMN prompts.category_id IS '所属分类 ID';
COMMENT ON COLUMN prompts.deleted_at IS '软删除时间';
COMMENT ON COLUMN prompts.copy_count IS '复制使用次数';
COMMENT ON COLUMN prompts.last_copied_at IS '最后复制时间';
COMMENT ON COLUMN prompts.content_en IS '英文翻译内容';
COMMENT ON COLUMN prompts.content_translated_at IS '翻译时间';

-- 提示词复制日志
CREATE TABLE public.prompt_copy_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt_id uuid,
  user_id uuid,
  copied_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_copy_logs_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_copy_logs_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id),
  CONSTRAINT prompt_copy_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE prompt_copy_logs IS '提示词复制日志 - 记录提示词使用情况，用于统计分析';
COMMENT ON COLUMN prompt_copy_logs.id IS '日志唯一标识';
COMMENT ON COLUMN prompt_copy_logs.prompt_id IS '被复制的提示词 ID';
COMMENT ON COLUMN prompt_copy_logs.user_id IS '复制用户 ID';
COMMENT ON COLUMN prompt_copy_logs.copied_at IS '复制时间';

-- ============================================
-- 4. 提示词爬虫相关表
-- ============================================

-- 爬取的提示词
CREATE TABLE public.extracted_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  prompt_title text NOT NULL,
  prompt_content text NOT NULL,
  suggested_category text,
  quality_score double precision DEFAULT 0,
  ai_analysis jsonb,
  language text DEFAULT 'en',
  created_at timestamp with time zone DEFAULT now(),
  source_type text DEFAULT 'unknown',
  source_url text,
  source_author text,
  source_name text,
  source_stars integer,
  source_forks integer,
  content_hash text,
  CONSTRAINT extracted_prompts_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE extracted_prompts IS '爬取的提示词 - 从 Reddit/GitHub 自动采集并经 AI 分析的提示词';
COMMENT ON COLUMN extracted_prompts.id IS '提示词唯一标识';
COMMENT ON COLUMN extracted_prompts.user_id IS '所属用户 ID，用于数据隔离';
COMMENT ON COLUMN extracted_prompts.prompt_title IS '提示词标题';
COMMENT ON COLUMN extracted_prompts.prompt_content IS '提示词内容';
COMMENT ON COLUMN extracted_prompts.suggested_category IS 'AI 建议的分类';
COMMENT ON COLUMN extracted_prompts.quality_score IS 'AI 质量评分 (0-10)';
COMMENT ON COLUMN extracted_prompts.ai_analysis IS 'AI 分析详情 JSON';
COMMENT ON COLUMN extracted_prompts.language IS '语言标识';
COMMENT ON COLUMN extracted_prompts.source_type IS '来源类型：reddit/github/unknown';
COMMENT ON COLUMN extracted_prompts.source_url IS '原始来源 URL';
COMMENT ON COLUMN extracted_prompts.source_author IS '原作者';
COMMENT ON COLUMN extracted_prompts.source_name IS '来源名称（子版块名/仓库名）';
COMMENT ON COLUMN extracted_prompts.source_stars IS 'GitHub 仓库 Star 数';
COMMENT ON COLUMN extracted_prompts.source_forks IS 'GitHub 仓库 Fork 数';
COMMENT ON COLUMN extracted_prompts.content_hash IS '内容哈希值，用于用户内去重';

-- 爬取任务记录
CREATE TABLE public.crawl_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type = ANY (ARRAY['reddit', 'github', 'all'])),
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'running', 'completed', 'failed'])),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  items_found integer DEFAULT 0,
  items_new integer DEFAULT 0,
  prompts_extracted integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crawl_jobs_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE crawl_jobs IS '爬取任务记录 - 追踪提示词采集任务的执行历史';
COMMENT ON COLUMN crawl_jobs.id IS '任务唯一标识';
COMMENT ON COLUMN crawl_jobs.user_id IS '所属用户 ID，用于数据隔离';
COMMENT ON COLUMN crawl_jobs.job_type IS '任务类型：reddit/github/all';
COMMENT ON COLUMN crawl_jobs.status IS '任务状态：pending/running/completed/failed';
COMMENT ON COLUMN crawl_jobs.started_at IS '开始时间';
COMMENT ON COLUMN crawl_jobs.completed_at IS '完成时间';
COMMENT ON COLUMN crawl_jobs.items_found IS '发现的内容数量';
COMMENT ON COLUMN crawl_jobs.items_new IS '新增内容数量';
COMMENT ON COLUMN crawl_jobs.prompts_extracted IS '提取的提示词数量';
COMMENT ON COLUMN crawl_jobs.error_message IS '错误信息';

-- 已爬取源记录
CREATE TABLE public.crawled_sources (
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

COMMENT ON TABLE crawled_sources IS '已爬取源记录 - 每个用户独立记录已处理的 Reddit post 或 GitHub repo';
COMMENT ON COLUMN crawled_sources.user_id IS '所属用户 ID';
COMMENT ON COLUMN crawled_sources.source_type IS '来源类型：reddit/github';
COMMENT ON COLUMN crawled_sources.source_id IS 'Reddit post ID 或 GitHub repo full_name';
COMMENT ON COLUMN crawled_sources.source_url IS '来源 URL';
COMMENT ON COLUMN crawled_sources.crawled_at IS '爬取时间';
COMMENT ON COLUMN crawled_sources.prompts_extracted IS '提取的提示词数量';

-- 爬取配置表（用户自定义关键词）
CREATE TABLE public.crawl_configs (
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
COMMENT ON COLUMN crawl_configs.id IS '配置唯一标识';
COMMENT ON COLUMN crawl_configs.user_id IS '所属用户 ID（唯一）';
COMMENT ON COLUMN crawl_configs.reddit_subreddits IS 'Reddit 子版块列表 JSON 数组';
COMMENT ON COLUMN crawl_configs.github_search_queries IS 'GitHub 搜索关键词列表 JSON 数组';
COMMENT ON COLUMN crawl_configs.min_reddit_score IS 'Reddit 最低分数阈值';
COMMENT ON COLUMN crawl_configs.min_github_stars IS 'GitHub 最低 Star 数阈值';
COMMENT ON COLUMN crawl_configs.ai_quality_threshold IS 'AI 质量评分阈值';
COMMENT ON COLUMN crawl_configs.ai_analysis_prompt IS 'AI 分析提示词（用户自定义）';

-- 用户自定义采集模板表
CREATE TABLE public.crawl_templates (
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

-- ============================================
-- 5. AI 设置相关表
-- ============================================

-- AI 提供商模板
CREATE TABLE public.ai_provider_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_key character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  base_url character varying,
  models jsonb DEFAULT '[]'::jsonb,
  icon_svg text,
  color character varying DEFAULT 'gray',
  sort_order integer DEFAULT 0,
  CONSTRAINT ai_provider_templates_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE ai_provider_templates IS 'AI 提供商模板 - 预设的 AI 服务商配置模板';
COMMENT ON COLUMN ai_provider_templates.id IS '模板唯一标识';
COMMENT ON COLUMN ai_provider_templates.provider_key IS '提供商标识键（唯一）';
COMMENT ON COLUMN ai_provider_templates.name IS '提供商显示名称';
COMMENT ON COLUMN ai_provider_templates.base_url IS '默认 API 地址';
COMMENT ON COLUMN ai_provider_templates.models IS '支持的模型列表 JSON';
COMMENT ON COLUMN ai_provider_templates.icon_svg IS '图标 SVG 或 URL';
COMMENT ON COLUMN ai_provider_templates.color IS '主题颜色';
COMMENT ON COLUMN ai_provider_templates.sort_order IS '排序顺序';

-- 用户 AI 提供商配置
CREATE TABLE public.ai_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  provider_key character varying NOT NULL,
  name character varying NOT NULL,
  api_key character varying,
  base_url character varying,
  models jsonb DEFAULT '[]'::jsonb,
  is_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_default boolean DEFAULT false,
  default_model character varying,
  is_encrypted boolean DEFAULT false,
  encryption_version integer DEFAULT 1,
  CONSTRAINT ai_providers_pkey PRIMARY KEY (id),
  CONSTRAINT ai_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE ai_providers IS '用户 AI 提供商配置 - 用户配置的 AI 服务商 API 密钥';
COMMENT ON COLUMN ai_providers.id IS '配置唯一标识';
COMMENT ON COLUMN ai_providers.user_id IS '所属用户 ID';
COMMENT ON COLUMN ai_providers.provider_key IS '提供商标识键';
COMMENT ON COLUMN ai_providers.name IS '自定义名称';
COMMENT ON COLUMN ai_providers.api_key IS 'API 密钥（加密存储）';
COMMENT ON COLUMN ai_providers.base_url IS '自定义 API 地址';
COMMENT ON COLUMN ai_providers.models IS '可用模型列表 JSON';
COMMENT ON COLUMN ai_providers.is_enabled IS '是否启用';
COMMENT ON COLUMN ai_providers.is_default IS '是否为默认提供商';
COMMENT ON COLUMN ai_providers.default_model IS '默认使用的模型 ID';
COMMENT ON COLUMN ai_providers.is_encrypted IS 'API 密钥是否已加密';
COMMENT ON COLUMN ai_providers.encryption_version IS '加密版本号';

-- ============================================
-- 6. AI 角色模板相关表
-- ============================================

-- 角色分类
CREATE TABLE public.ai_role_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  icon text,
  color character varying DEFAULT 'gray',
  sort_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_role_categories_pkey PRIMARY KEY (id),
  CONSTRAINT ai_role_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE ai_role_categories IS 'AI 角色分类 - 角色模板的分类管理';
COMMENT ON COLUMN ai_role_categories.id IS '分类唯一标识';
COMMENT ON COLUMN ai_role_categories.name IS '分类名称';
COMMENT ON COLUMN ai_role_categories.icon IS 'Emoji 图标';
COMMENT ON COLUMN ai_role_categories.color IS '主题颜色';
COMMENT ON COLUMN ai_role_categories.sort_order IS '排序顺序';
COMMENT ON COLUMN ai_role_categories.is_system IS '是否为系统预设分类';
COMMENT ON COLUMN ai_role_categories.user_id IS '创建用户 ID（系统分类为空）';

-- 角色模板
CREATE TABLE public.ai_role_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid,
  name character varying NOT NULL,
  description text,
  content text NOT NULL,
  icon text,
  tags text[],
  is_system boolean DEFAULT false,
  user_id uuid,
  copy_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_role_templates_pkey PRIMARY KEY (id),
  CONSTRAINT ai_role_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ai_role_categories(id),
  CONSTRAINT ai_role_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE ai_role_templates IS 'AI 角色模板库 - 预设和自定义的 AI 角色提示词';
COMMENT ON COLUMN ai_role_templates.id IS '模板唯一标识';
COMMENT ON COLUMN ai_role_templates.category_id IS '所属分类 ID';
COMMENT ON COLUMN ai_role_templates.name IS '角色名称';
COMMENT ON COLUMN ai_role_templates.description IS '角色描述';
COMMENT ON COLUMN ai_role_templates.content IS '角色提示词内容';
COMMENT ON COLUMN ai_role_templates.icon IS 'Emoji 图标';
COMMENT ON COLUMN ai_role_templates.tags IS '标签数组';
COMMENT ON COLUMN ai_role_templates.is_system IS '是否为系统预设模板';
COMMENT ON COLUMN ai_role_templates.user_id IS '创建用户 ID（系统模板为空）';
COMMENT ON COLUMN ai_role_templates.copy_count IS '复制使用次数';

-- ============================================
-- 7. 资源中心相关表
-- ============================================

CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type = ANY (ARRAY['link', 'github', 'document', 'image'])),
  title character varying NOT NULL,
  description text,
  url text,
  storage_path text,
  file_name character varying,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archived_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT resources_pkey PRIMARY KEY (id),
  CONSTRAINT resources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE resources IS '资源中心 - 用户收藏的链接、GitHub 项目、文档和图片';
COMMENT ON COLUMN resources.id IS '资源唯一标识';
COMMENT ON COLUMN resources.user_id IS '所属用户 ID';
COMMENT ON COLUMN resources.type IS '资源类型：link/github/document/image';
COMMENT ON COLUMN resources.title IS '资源标题';
COMMENT ON COLUMN resources.description IS '资源描述';
COMMENT ON COLUMN resources.url IS '原始 URL（link/github 类型）';
COMMENT ON COLUMN resources.storage_path IS '文件存储路径（document/image 类型）';
COMMENT ON COLUMN resources.file_name IS '原始文件名';
COMMENT ON COLUMN resources.metadata IS '扩展元数据 JSON（如 GitHub 的 stars/forks）';
COMMENT ON COLUMN resources.archived_at IS '归档时间';
COMMENT ON COLUMN resources.deleted_at IS '软删除时间';

-- ============================================
-- 8. 飞书集成相关表
-- ============================================

CREATE TABLE public.feishu_user_bindings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  feishu_open_id text NOT NULL UNIQUE,
  feishu_user_id text,
  feishu_union_id text,
  feishu_name text,
  feishu_avatar text,
  bound_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feishu_user_bindings_pkey PRIMARY KEY (id),
  CONSTRAINT feishu_user_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE feishu_user_bindings IS '飞书用户绑定 - 系统用户与飞书账号的关联关系';
COMMENT ON COLUMN feishu_user_bindings.id IS '绑定记录唯一标识';
COMMENT ON COLUMN feishu_user_bindings.user_id IS '系统用户 ID（唯一）';
COMMENT ON COLUMN feishu_user_bindings.feishu_open_id IS '飞书 Open ID（应用内唯一）';
COMMENT ON COLUMN feishu_user_bindings.feishu_user_id IS '飞书 User ID（企业内唯一）';
COMMENT ON COLUMN feishu_user_bindings.feishu_union_id IS '飞书 Union ID（跨应用唯一）';
COMMENT ON COLUMN feishu_user_bindings.feishu_name IS '飞书用户名';
COMMENT ON COLUMN feishu_user_bindings.feishu_avatar IS '飞书头像 URL';
COMMENT ON COLUMN feishu_user_bindings.bound_at IS '绑定时间';

CREATE TABLE public.feishu_bind_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feishu_bind_codes_pkey PRIMARY KEY (id),
  CONSTRAINT feishu_bind_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE feishu_bind_codes IS '飞书绑定验证码 - 一次性绑定码';
COMMENT ON COLUMN feishu_bind_codes.id IS '记录唯一标识';
COMMENT ON COLUMN feishu_bind_codes.user_id IS '申请绑定的用户 ID';
COMMENT ON COLUMN feishu_bind_codes.code IS '6位绑定码（唯一）';
COMMENT ON COLUMN feishu_bind_codes.expires_at IS '过期时间（默认5分钟）';
COMMENT ON COLUMN feishu_bind_codes.used_at IS '使用时间';

CREATE TABLE public.feishu_processed_messages (
  message_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feishu_processed_messages_pkey PRIMARY KEY (message_id)
);

COMMENT ON TABLE feishu_processed_messages IS '飞书消息去重 - 防止重复处理飞书 Webhook 事件';
COMMENT ON COLUMN feishu_processed_messages.message_id IS '飞书消息 ID（主键）';
COMMENT ON COLUMN feishu_processed_messages.created_at IS '处理时间';

-- ============================================
-- 9. 邮箱认证相关表
-- ============================================

CREATE TABLE public.email_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  code character varying NOT NULL,
  type character varying NOT NULL CHECK (type = ANY (ARRAY['registration', 'password_reset', 'email_change'])),
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_verifications_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE email_verifications IS '邮箱验证码 - 注册、找回密码等场景的验证码记录';
COMMENT ON COLUMN email_verifications.id IS '记录唯一标识';
COMMENT ON COLUMN email_verifications.email IS '目标邮箱地址';
COMMENT ON COLUMN email_verifications.code IS '6位数字验证码';
COMMENT ON COLUMN email_verifications.type IS '验证类型：registration/password_reset/email_change';
COMMENT ON COLUMN email_verifications.expires_at IS '过期时间（10分钟）';
COMMENT ON COLUMN email_verifications.used IS '是否已使用';

-- ============================================
-- 10. RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_copy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE feishu_user_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feishu_bind_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feishu_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- 所有表开放访问（因为使用自定义认证，不依赖 Supabase Auth）
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON workflows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON workflow_executions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON node_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON prompt_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON prompt_copy_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON extracted_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crawl_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crawled_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crawl_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crawl_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_provider_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_role_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_role_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON feishu_user_bindings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON feishu_bind_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON feishu_processed_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON email_verifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 11. 触发器和函数
-- ============================================

-- 自动更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 触发器
DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON ai_providers;
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_role_templates_updated_at ON ai_role_templates;
CREATE TRIGGER update_ai_role_templates_updated_at
  BEFORE UPDATE ON ai_role_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. 索引
-- ============================================

-- 用户相关
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 工作流相关
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_deleted_at ON workflows(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);

-- 提示词相关
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category_id ON prompts(category_id);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_at ON prompts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_prompt_categories_user_id ON prompt_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_copy_logs_prompt_id ON prompt_copy_logs(prompt_id);

-- 爬虫相关
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_user_id ON extracted_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_source_type ON extracted_prompts(source_type);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_suggested_category ON extracted_prompts(suggested_category);
CREATE INDEX IF NOT EXISTS idx_extracted_prompts_created_at ON extracted_prompts(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extracted_prompts_user_hash ON extracted_prompts(user_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_user_id ON crawl_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawled_sources_user_lookup ON crawled_sources(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_crawl_configs_user_id ON crawl_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_templates_user_id ON crawl_templates(user_id);

-- AI 设置相关
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_categories_user_id ON ai_role_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_templates_category_id ON ai_role_templates(category_id);

-- 资源相关
CREATE INDEX IF NOT EXISTS idx_resources_user_id ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON resources(deleted_at);

-- 飞书相关
CREATE INDEX IF NOT EXISTS idx_feishu_user_bindings_feishu_open_id ON feishu_user_bindings(feishu_open_id);
CREATE INDEX IF NOT EXISTS idx_feishu_bind_codes_code ON feishu_bind_codes(code);

-- 邮箱验证相关
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);
