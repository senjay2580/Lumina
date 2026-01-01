-- Migration: 添加提示词分类表
-- Date: 2026-01-01
-- Description: 新增 prompt_categories 表，修改 prompts 表结构

-- 1. 创建提示词分类表
CREATE TABLE IF NOT EXISTS prompt_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  color varchar(20) NOT NULL DEFAULT 'gray',
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. 修改 prompts 表，添加 category_id 外键
ALTER TABLE prompts 
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES prompt_categories(id) ON DELETE SET NULL;

-- 3. 如果存在旧的 category 字段，迁移数据后删除
-- (如果 category 列存在，先跳过，手动处理迁移)
-- ALTER TABLE prompts DROP COLUMN IF EXISTS category;

-- 4. 确保 tags 字段有默认值
ALTER TABLE prompts 
  ALTER COLUMN tags SET DEFAULT '{}';

-- 5. 启用 RLS
ALTER TABLE prompt_categories ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略
DROP POLICY IF EXISTS "Allow all for prompt_categories" ON prompt_categories;
CREATE POLICY "Allow all for prompt_categories" ON prompt_categories FOR ALL USING (true);

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS idx_prompt_categories_user_id ON prompt_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category_id ON prompts(category_id);
