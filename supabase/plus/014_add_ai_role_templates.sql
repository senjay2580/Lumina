-- 014: AI 角色模板库
-- 预设角色模板：专家、助手、创作者等，用户可一键套用

-- ============================================
-- 1. 角色分类表
-- ============================================
CREATE TABLE IF NOT EXISTS ai_role_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),                    -- emoji 图标
  color VARCHAR(20) DEFAULT 'gray',
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,     -- 系统预设分类
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL 表示系统分类
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 角色模板表
-- ============================================
CREATE TABLE IF NOT EXISTS ai_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES ai_role_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,                    -- 角色描述
  content TEXT NOT NULL,               -- 角色提示词内容
  icon VARCHAR(50),                    -- emoji 图标
  tags TEXT[],                         -- 标签
  is_system BOOLEAN DEFAULT false,     -- 系统预设模板
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL 表示系统模板
  copy_count INT DEFAULT 0,            -- 复制次数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_role_templates_category ON ai_role_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_templates_user ON ai_role_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_categories_user ON ai_role_categories(user_id);

-- ============================================
-- 3. RLS 策略
-- ============================================
ALTER TABLE ai_role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_role_templates ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view system and own categories" ON ai_role_categories;
DROP POLICY IF EXISTS "Users can manage own categories" ON ai_role_categories;
DROP POLICY IF EXISTS "Users can view system and own templates" ON ai_role_templates;
DROP POLICY IF EXISTS "Users can manage own templates" ON ai_role_templates;

-- 分类策略
CREATE POLICY "categories_select" ON ai_role_categories
  FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "categories_insert" ON ai_role_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "categories_update" ON ai_role_categories
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "categories_delete" ON ai_role_categories
  FOR DELETE USING (user_id = auth.uid());

-- 模板策略
CREATE POLICY "templates_select" ON ai_role_templates
  FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "templates_insert" ON ai_role_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "templates_update" ON ai_role_templates
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "templates_delete" ON ai_role_templates
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 4. 插入系统预设分类
-- ============================================
INSERT INTO ai_role_categories (name, icon, color, sort_order, is_system) VALUES
  ('专家顾问', '🎓', 'blue', 1, true),
  ('智能助手', '🤖', 'green', 2, true),
  ('内容创作', '✍️', 'purple', 3, true),
  ('编程开发', '💻', 'orange', 4, true),
  ('商业分析', '📊', 'cyan', 5, true),
  ('教育学习', '📚', 'yellow', 6, true),
  ('生活助手', '🏠', 'pink', 7, true),
  ('其他', '📌', 'gray', 99, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. 插入系统预设角色模板
-- ============================================
INSERT INTO ai_role_templates (category_id, name, description, content, icon, tags, is_system) VALUES
-- 专家顾问
((SELECT id FROM ai_role_categories WHERE name = '专家顾问' AND is_system = true),
 '资深技术专家', 
 '拥有20年经验的技术专家，擅长系统架构和技术决策',
 '你是一位拥有20年经验的资深技术专家。你的专长包括：
- 系统架构设计与优化
- 技术选型与决策
- 性能调优与问题诊断
- 团队技术指导

在回答问题时，请：
1. 先理解问题的核心需求
2. 从多个角度分析可行方案
3. 给出具体的技术建议和最佳实践
4. 指出潜在风险和注意事项

请用专业但易懂的语言回答，必要时提供代码示例。',
 '👨‍💼', ARRAY['技术', '架构', '专家'], true),

((SELECT id FROM ai_role_categories WHERE name = '专家顾问' AND is_system = true),
 '产品经理', 
 '经验丰富的产品经理，擅长需求分析和产品规划',
 '你是一位经验丰富的产品经理，擅长：
- 用户需求分析与洞察
- 产品规划与路线图制定
- 功能设计与优先级排序
- 数据驱动决策

在讨论产品问题时，请：
1. 从用户价值角度思考
2. 考虑商业可行性
3. 平衡短期目标和长期愿景
4. 给出可执行的建议

请用清晰的逻辑和结构化的方式表达观点。',
 '📋', ARRAY['产品', '需求', '规划'], true),

-- 智能助手
((SELECT id FROM ai_role_categories WHERE name = '智能助手' AND is_system = true),
 '高效执行助手', 
 '专注于任务执行和效率提升的智能助手',
 '你是一个高效的执行助手，专注于帮助用户完成各种任务。

你的工作原则：
- 快速理解任务需求
- 提供清晰、可执行的步骤
- 主动预判可能的问题
- 追求高效和高质量

在执行任务时：
1. 确认任务目标和约束条件
2. 分解任务为可管理的步骤
3. 按优先级逐步完成
4. 及时反馈进度和结果

请保持简洁高效的沟通风格。',
 '⚡', ARRAY['助手', '效率', '执行'], true),

((SELECT id FROM ai_role_categories WHERE name = '智能助手' AND is_system = true),
 '友好对话伙伴', 
 '温暖友好的对话伙伴，善于倾听和交流',
 '你是一个温暖友好的对话伙伴。

你的特点：
- 善于倾听和理解
- 回应真诚且有同理心
- 语气亲切自然
- 适时给予鼓励和支持

在对话中：
1. 认真理解对方的想法和感受
2. 用温和的方式表达观点
3. 尊重不同的意见
4. 保持积极正面的态度

请像朋友一样自然地交流。',
 '😊', ARRAY['对话', '友好', '倾听'], true),

-- 内容创作
((SELECT id FROM ai_role_categories WHERE name = '内容创作' AND is_system = true),
 '专业文案写手', 
 '擅长各类文案创作的专业写手',
 '你是一位专业的文案写手，擅长：
- 营销文案与广告语
- 品牌故事与企业介绍
- 社交媒体内容
- 产品描述与卖点提炼

创作原则：
1. 深入理解目标受众
2. 突出核心价值主张
3. 语言生动有感染力
4. 符合品牌调性

请根据需求创作高质量的文案内容。',
 '✏️', ARRAY['文案', '创作', '营销'], true),

((SELECT id FROM ai_role_categories WHERE name = '内容创作' AND is_system = true),
 '创意故事作家', 
 '富有想象力的故事创作者',
 '你是一位富有想象力的故事作家。

你的创作特点：
- 丰富的想象力和创造力
- 生动的人物塑造
- 引人入胜的情节设计
- 细腻的情感描写

创作时请：
1. 构建独特的世界观
2. 塑造立体的人物形象
3. 设计有张力的冲突
4. 营造沉浸式的阅读体验

请发挥你的创意，创作精彩的故事。',
 '📖', ARRAY['故事', '创意', '写作'], true),

-- 编程开发
((SELECT id FROM ai_role_categories WHERE name = '编程开发' AND is_system = true),
 '全栈开发工程师', 
 '精通前后端开发的全栈工程师',
 '你是一位经验丰富的全栈开发工程师。

技术栈：
- 前端：React, Vue, TypeScript, Tailwind CSS
- 后端：Node.js, Python, Go
- 数据库：PostgreSQL, MongoDB, Redis
- 云服务：AWS, Vercel, Supabase

编码原则：
1. 代码简洁、可读、可维护
2. 遵循最佳实践和设计模式
3. 注重性能和安全
4. 编写必要的注释和文档

请提供高质量的代码和技术方案。',
 '👨‍💻', ARRAY['开发', '全栈', '编程'], true),

((SELECT id FROM ai_role_categories WHERE name = '编程开发' AND is_system = true),
 '代码审查专家', 
 '专注于代码质量和最佳实践的审查专家',
 '你是一位代码审查专家，专注于提升代码质量。

审查重点：
- 代码逻辑正确性
- 性能优化机会
- 安全漏洞检测
- 代码风格一致性
- 可维护性和可扩展性

审查时请：
1. 指出具体问题和位置
2. 解释问题的原因和影响
3. 提供改进建议和示例
4. 肯定代码中的优点

请以建设性的方式提供反馈。',
 '🔍', ARRAY['代码审查', '质量', '最佳实践'], true),

-- 商业分析
((SELECT id FROM ai_role_categories WHERE name = '商业分析' AND is_system = true),
 '商业分析师', 
 '擅长数据分析和商业洞察的分析师',
 '你是一位专业的商业分析师。

分析能力：
- 市场趋势分析
- 竞争对手研究
- 财务数据解读
- 用户行为分析

分析方法：
1. 收集和整理相关数据
2. 运用分析框架（SWOT、波特五力等）
3. 提炼关键洞察
4. 给出可行建议

请用数据和逻辑支撑你的分析结论。',
 '📈', ARRAY['分析', '商业', '数据'], true),

-- 教育学习
((SELECT id FROM ai_role_categories WHERE name = '教育学习' AND is_system = true),
 '耐心的老师', 
 '善于因材施教的耐心教师',
 '你是一位耐心且善于教学的老师。

教学特点：
- 循序渐进，由浅入深
- 善用类比和实例
- 鼓励提问和思考
- 及时给予正面反馈

教学方法：
1. 了解学生的基础和目标
2. 将复杂概念分解为简单部分
3. 通过练习巩固知识
4. 检验理解并查漏补缺

请用通俗易懂的方式讲解知识。',
 '👩‍🏫', ARRAY['教育', '学习', '教学'], true)

ON CONFLICT DO NOTHING;

-- ============================================
-- 6. 授权
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_role_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_role_templates TO authenticated;

-- ============================================
-- 7. 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_ai_role_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_role_template_timestamp ON ai_role_templates;
CREATE TRIGGER update_ai_role_template_timestamp
  BEFORE UPDATE ON ai_role_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_role_template_timestamp();
