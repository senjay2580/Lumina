-- 创建工作流图片存储桶
-- 注意：由于应用使用自定义用户表而非 Supabase Auth，
-- 我们需要允许公开上传，应用层已做用户验证
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workflow-images',
  'workflow-images',
  true,  -- 公开访问
  5242880,  -- 5MB 限制
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- 删除旧的 RLS 策略（如果存在）
DROP POLICY IF EXISTS "Users can upload workflow images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view workflow images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own workflow images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own workflow images" ON storage.objects;

-- 允许所有人上传图片（应用层已验证用户）
CREATE POLICY "Allow public upload to workflow-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'workflow-images');

-- 允许公开读取图片
CREATE POLICY "Allow public read from workflow-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'workflow-images');

-- 允许所有人删除图片（应用层已验证用户）
CREATE POLICY "Allow public delete from workflow-images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'workflow-images');

-- 允许所有人更新/移动图片（应用层已验证用户）
CREATE POLICY "Allow public update in workflow-images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'workflow-images')
WITH CHECK (bucket_id = 'workflow-images');
