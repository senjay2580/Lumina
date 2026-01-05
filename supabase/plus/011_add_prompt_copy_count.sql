-- 添加提示词复制次数统计功能
-- 用于追踪提示词的使用热度

-- 1. 添加 copy_count 字段到 prompts 表
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS copy_count INTEGER DEFAULT 0;

-- 2. 添加 last_copied_at 字段，记录最后复制时间
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS last_copied_at TIMESTAMPTZ;

-- 3. 创建索引，优化按复制次数排序的查询
CREATE INDEX IF NOT EXISTS idx_prompts_copy_count ON prompts(copy_count DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_user_copy_count ON prompts(user_id, copy_count DESC);

-- 4. 创建增加复制次数的函数
CREATE OR REPLACE FUNCTION increment_prompt_copy_count(prompt_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE prompts 
  SET 
    copy_count = copy_count + 1,
    last_copied_at = NOW()
  WHERE id = prompt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建获取热门提示词的视图
CREATE OR REPLACE VIEW popular_prompts AS
SELECT 
  p.*,
  pc.name as category_name,
  pc.color as category_color
FROM prompts p
LEFT JOIN prompt_categories pc ON p.category_id = pc.id
WHERE p.deleted_at IS NULL
ORDER BY p.copy_count DESC;

-- 6. 创建提示词统计视图
CREATE OR REPLACE VIEW prompt_statistics AS
SELECT 
  user_id,
  COUNT(*) as total_prompts,
  SUM(copy_count) as total_copies,
  AVG(copy_count)::INTEGER as avg_copies,
  MAX(copy_count) as max_copies,
  COUNT(CASE WHEN copy_count > 0 THEN 1 END) as used_prompts,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as prompts_this_week,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as prompts_this_month
FROM prompts
WHERE deleted_at IS NULL
GROUP BY user_id;

-- 7. 创建分类统计视图
CREATE OR REPLACE VIEW category_statistics AS
SELECT 
  pc.id as category_id,
  pc.name as category_name,
  pc.color as category_color,
  pc.user_id,
  COUNT(p.id) as prompt_count,
  COALESCE(SUM(p.copy_count), 0) as total_copies
FROM prompt_categories pc
LEFT JOIN prompts p ON pc.id = p.category_id AND p.deleted_at IS NULL
GROUP BY pc.id, pc.name, pc.color, pc.user_id;

-- 8. 创建每日复制统计表（用于图表）
CREATE TABLE IF NOT EXISTS prompt_copy_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  copied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_copy_logs_user_date ON prompt_copy_logs(user_id, copied_at);
CREATE INDEX IF NOT EXISTS idx_copy_logs_prompt ON prompt_copy_logs(prompt_id);

-- 9. 创建记录复制日志的函数
CREATE OR REPLACE FUNCTION log_prompt_copy(p_prompt_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- 增加计数
  UPDATE prompts 
  SET 
    copy_count = copy_count + 1,
    last_copied_at = NOW()
  WHERE id = p_prompt_id;
  
  -- 记录日志
  INSERT INTO prompt_copy_logs (prompt_id, user_id)
  VALUES (p_prompt_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 创建获取每日复制统计的函数
CREATE OR REPLACE FUNCTION get_daily_copy_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  copy_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(copied_at) as date,
    COUNT(*) as copy_count
  FROM prompt_copy_logs
  WHERE user_id = p_user_id
    AND copied_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(copied_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RLS 策略
ALTER TABLE prompt_copy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own copy logs"
  ON prompt_copy_logs FOR SELECT
  USING (auth.uid() = user_id OR user_id IN (SELECT id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own copy logs"
  ON prompt_copy_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IN (SELECT id FROM users WHERE id = auth.uid()));

-- 12. 授权
GRANT SELECT ON popular_prompts TO authenticated;
GRANT SELECT ON prompt_statistics TO authenticated;
GRANT SELECT ON category_statistics TO authenticated;
GRANT ALL ON prompt_copy_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_prompt_copy TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_copy_stats TO authenticated;
