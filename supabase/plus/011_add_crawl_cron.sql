-- 定时爬取任务配置
-- 需要先启用 pg_cron 和 pg_net 扩展

-- 启用扩展（如果尚未启用）
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- 创建定时任务：每天凌晨 2 点执行爬取
-- 注意：需要替换 YOUR_SUPABASE_URL 和 YOUR_ANON_KEY
/*
SELECT cron.schedule(
  'daily-prompt-crawl',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_SUPABASE_URL/functions/v1/prompt-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{"jobType": "all"}'::jsonb
  )
  $$
);
*/

-- 查看已创建的定时任务
-- SELECT * FROM cron.job;

-- 删除定时任务
-- SELECT cron.unschedule('daily-prompt-crawl');
