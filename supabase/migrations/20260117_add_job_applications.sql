-- 投递记录表
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.creation_versions(id) ON DELETE CASCADE,
  
  -- 投递信息
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  application_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 状态：pending(待回复)、interview(面试中)、offer(已offer)、rejected(已拒绝)、accepted(已接受)
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- 当前阶段描述（如：一面、二面、HR面等）
  current_stage TEXT,
  
  -- 备注
  notes TEXT,
  
  -- 联系人信息
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- 薪资信息
  salary_range TEXT,
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_creation_id ON public.job_applications(creation_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_application_date ON public.job_applications(application_date DESC);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_job_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_job_applications_updated_at();

-- RLS 策略（允许所有操作，因为使用自定义认证）
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_job_applications" ON public.job_applications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 添加注释
COMMENT ON TABLE public.job_applications IS '求职投递记录表';
COMMENT ON COLUMN public.job_applications.status IS '投递状态：pending(待回复)、interview(面试中)、offer(已offer)、rejected(已拒绝)、accepted(已接受)';
