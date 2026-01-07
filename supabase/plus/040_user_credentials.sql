-- 用户凭证表 - 存储用户的各种服务 API Key 等敏感信息
-- 用于 Tavily、OpenAI 等第三方服务的凭证管理

CREATE TABLE IF NOT EXISTS public.user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_name VARCHAR(100) NOT NULL,  -- 服务名称: tavily, openai, github 等
  credential_type VARCHAR(100) NOT NULL,  -- 凭证类型: api_key, token, secret 等
  credential_value TEXT NOT NULL,  -- 加密存储的凭证值
  description TEXT,  -- 凭证描述
  is_active BOOLEAN DEFAULT true,  -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 每个用户每个服务每种类型只能有一个凭证
  UNIQUE(user_id, service_name, credential_type)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_service ON public.user_credentials(service_name);
CREATE INDEX IF NOT EXISTS idx_user_credentials_active ON public.user_credentials(user_id, is_active);

-- RLS 策略
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（因为使用自定义用户系统，不依赖 Supabase Auth）
CREATE POLICY "Allow all operations on user_credentials" ON public.user_credentials
  FOR ALL USING (true) WITH CHECK (true);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_user_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_credentials_updated_at ON public.user_credentials;
CREATE TRIGGER trigger_user_credentials_updated_at
  BEFORE UPDATE ON public.user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credentials_updated_at();

-- 注释
COMMENT ON TABLE public.user_credentials IS '用户凭证表 - 存储第三方服务的 API Key 等';
COMMENT ON COLUMN public.user_credentials.service_name IS '服务名称: tavily, openai, github 等';
COMMENT ON COLUMN public.user_credentials.credential_type IS '凭证类型: api_key, token, secret 等';
COMMENT ON COLUMN public.user_credentials.credential_value IS '凭证值（建议加密存储）';
