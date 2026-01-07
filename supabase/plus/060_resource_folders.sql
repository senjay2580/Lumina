-- ============================================
-- 060: 资源文件夹功能
-- 支持多级目录的文件夹系统
-- ============================================

-- 1. 创建文件夹表
CREATE TABLE IF NOT EXISTS public.resource_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '新建文件夹',
  parent_id uuid REFERENCES public.resource_folders(id) ON DELETE CASCADE,
  resource_type text NOT NULL, -- 文件夹只能包含此类型的资源 (link, github, document, image, article)
  color text DEFAULT '#6366f1', -- 文件夹颜色
  icon text DEFAULT 'folder', -- 图标名称
  position integer DEFAULT 0, -- 排序位置
  archived_at timestamp with time zone DEFAULT NULL, -- 归档时间
  deleted_at timestamp with time zone DEFAULT NULL, -- 软删除时间
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT resource_folders_pkey PRIMARY KEY (id),
  CONSTRAINT resource_folders_type_check CHECK (resource_type IN ('link', 'github', 'document', 'image', 'article'))
);

-- 2. 为 resources 表添加 folder_id 字段
ALTER TABLE public.resources 
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.resource_folders(id) ON DELETE SET NULL;

-- 3. 添加 position 字段用于排序
ALTER TABLE public.resources 
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- 4. 为已存在的表添加新字段（如果不存在）
ALTER TABLE public.resource_folders 
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.resource_folders 
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_resource_folders_user_id ON resource_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_folders_parent_id ON resource_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_resources_folder_id ON resources(folder_id);

-- 5. RLS 策略
ALTER TABLE resource_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own folders" ON resource_folders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 允许匿名访问（开发环境）
CREATE POLICY "allow_all_folders" ON resource_folders FOR ALL USING (true) WITH CHECK (true);

-- 6. 添加注释
COMMENT ON TABLE resource_folders IS '资源文件夹 - 支持多级目录，同类型资源';
COMMENT ON COLUMN resource_folders.parent_id IS '父文件夹 ID，NULL 表示根目录';
COMMENT ON COLUMN resource_folders.resource_type IS '文件夹资源类型，只能包含此类型的资源';
COMMENT ON COLUMN resource_folders.color IS '文件夹颜色';
COMMENT ON COLUMN resource_folders.position IS '排序位置';
COMMENT ON COLUMN resources.folder_id IS '所属文件夹 ID，NULL 表示在根目录';
COMMENT ON COLUMN resources.position IS '在文件夹内的排序位置';

-- 7. 更新时间触发器
CREATE OR REPLACE FUNCTION update_resource_folder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS resource_folders_updated_at ON resource_folders;
CREATE TRIGGER resource_folders_updated_at
  BEFORE UPDATE ON resource_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_folder_timestamp();
