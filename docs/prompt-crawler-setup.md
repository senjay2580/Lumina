# 提示词自动采集系统部署指南

## 概述

该系统可以自动从 Reddit 和 GitHub 抓取 AI 提示词相关内容，使用 AI 分析提取高质量提示词，并提供审核和导入功能。

## 架构

```
┌─────────────────┐     ┌─────────────────┐
│  Reddit API     │     │  GitHub API     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Supabase Edge Fn   │
         │  (prompt-crawler)   │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   OpenAI GPT-4o     │
         │   (内容分析)         │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   Supabase DB       │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   前端管理界面       │
         └─────────────────────┘
```

## 部署步骤

### 1. 运行数据库迁移

在 Supabase SQL Editor 中执行：

```sql
-- 执行 supabase/plus/010_add_prompt_crawler.sql
```

### 2. 获取 API 密钥

#### Reddit API
1. 访问 https://www.reddit.com/prefs/apps
2. 点击 "create another app..."
3. 选择 "script" 类型
4. 填写名称和描述
5. redirect uri 填写 `http://localhost`
6. 记录 `client_id`（应用名称下方的字符串）和 `secret`

#### GitHub API
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `public_repo` 权限
4. 生成并记录 token

#### OpenAI API
1. 访问 https://platform.openai.com/api-keys
2. 创建新的 API Key

### 3. 配置 Edge Function 环境变量

在 Supabase Dashboard > Edge Functions > prompt-crawler > Settings 中添加：

```
REDDIT_CLIENT_ID=你的Reddit客户端ID
REDDIT_CLIENT_SECRET=你的Reddit客户端密钥
GITHUB_TOKEN=你的GitHub Token
OPENAI_API_KEY=你的OpenAI API Key
```

### 4. 部署 Edge Function

```bash
# 安装 Supabase CLI（如果尚未安装）
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref YOUR_PROJECT_REF

# 部署函数
supabase functions deploy prompt-crawler
```

### 5. 配置定时任务（可选）

如果需要自动定时爬取，在 Supabase SQL Editor 中：

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 创建每日定时任务
SELECT cron.schedule(
  'daily-prompt-crawl',
  '0 2 * * *',  -- 每天凌晨2点
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/prompt-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{"jobType": "all"}'::jsonb
  )
  $$
);
```

## 使用说明

### 手动触发爬取

1. 在应用中进入「采集」页面
2. 点击「立即爬取全部」或选择单独爬取 Reddit/GitHub
3. 等待爬取完成

### 审核提示词

1. 在「待审核」标签页查看 AI 提取的提示词
2. 查看质量评分和来源
3. 点击「通过」审核或「删除」拒绝
4. 支持批量操作

### 导入到提示词库

1. 选择要导入的提示词
2. 选择目标分类（可选）
3. 点击「导入」或「批量导入」

### 配置调整

在「配置」标签页可以调整：
- Reddit 子版块列表
- GitHub 搜索关键词
- 最低分数/Stars 阈值
- AI 质量评分阈值

## API 限制说明

| 平台 | 限制 | 建议 |
|------|------|------|
| Reddit | 60 请求/分钟 | 已内置延迟 |
| GitHub | 未认证 60/小时，认证后 5000/小时 | 建议配置 Token |
| OpenAI | 根据账户等级 | 使用 gpt-4o-mini 节省成本 |

## 成本估算

- Reddit API: 免费
- GitHub API: 免费
- OpenAI: 约 $0.001-0.005/条内容分析（使用 gpt-4o-mini）

每日爬取 100 条内容，月成本约 $3-15。

## 故障排查

### 爬取失败
1. 检查 Edge Function 日志
2. 确认 API 密钥配置正确
3. 检查网络连接

### AI 分析失败
1. 确认 OpenAI API Key 有效
2. 检查账户余额
3. 查看返回的错误信息

### 定时任务不执行
1. 确认 pg_cron 扩展已启用
2. 检查 cron.job 表中的任务状态
3. 确认 URL 和 Key 配置正确
