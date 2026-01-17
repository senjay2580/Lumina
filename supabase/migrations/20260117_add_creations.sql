-- 我的创作 - 数据库表

-- 创作项目表
CREATE TABLE IF NOT EXISTS public.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('resume', 'article', 'design', 'code', 'document')),
  title TEXT NOT NULL,
  description TEXT,
  current_version_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.creations IS '创作项目表 - 用户的创作项目（简历、文章等）';
COMMENT ON COLUMN public.creations.id IS '项目唯一标识';
COMMENT ON COLUMN public.creations.user_id IS '所属用户 ID';
COMMENT ON COLUMN public.creations.type IS '创作类型：resume/article/design/code/document';
COMMENT ON COLUMN public.creations.title IS '项目标题';
COMMENT ON COLUMN public.creations.description IS '项目描述';
COMMENT ON COLUMN public.creations.current_version_id IS '当前版本 ID';
COMMENT ON COLUMN public.creations.metadata IS '扩展元数据 JSON';

-- 创作版本表
CREATE TABLE IF NOT EXISTS public.creation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  change_description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE(creation_id, version_number)
);

COMMENT ON TABLE public.creation_versions IS '创作版本表 - 每个创作项目的多个版本';
COMMENT ON COLUMN public.creation_versions.id IS '版本唯一标识';
COMMENT ON COLUMN public.creation_versions.creation_id IS '所属创作项目 ID';
COMMENT ON COLUMN public.creation_versions.version_number IS '版本号（递增）';
COMMENT ON COLUMN public.creation_versions.title IS '版本标题';
COMMENT ON COLUMN public.creation_versions.content IS '版本内容 JSON';
COMMENT ON COLUMN public.creation_versions.change_description IS '变更说明';
COMMENT ON COLUMN public.creation_versions.tags IS '标签数组（如：draft/published）';
COMMENT ON COLUMN public.creation_versions.created_by IS '创建者用户 ID';

-- 添加外键约束（创作项目的当前版本）
ALTER TABLE public.creations 
  ADD CONSTRAINT fk_current_version 
  FOREIGN KEY (current_version_id) 
  REFERENCES public.creation_versions(id) 
  ON DELETE SET NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_creations_user_id ON public.creations(user_id);
CREATE INDEX IF NOT EXISTS idx_creations_type ON public.creations(type);
CREATE INDEX IF NOT EXISTS idx_creations_updated_at ON public.creations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_creation_versions_creation_id ON public.creation_versions(creation_id);
CREATE INDEX IF NOT EXISTS idx_creation_versions_version_number ON public.creation_versions(creation_id, version_number DESC);

-- RLS 策略（与其他表保持一致，使用 allow_all）
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_versions ENABLE ROW LEVEL SECURITY;

-- 开放访问策略（因为使用自定义认证，不依赖 Supabase Auth）
CREATE POLICY "allow_all" ON public.creations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.creation_versions FOR ALL USING (true) WITH CHECK (true);

-- 自动更新 updated_at 触发器
DROP TRIGGER IF EXISTS update_creations_updated_at ON public.creations;
CREATE TRIGGER update_creations_updated_at
  BEFORE UPDATE ON public.creations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

