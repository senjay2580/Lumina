# 习惯纠正站 - 飞书提醒配置指南

## 前置条件

1. 已有飞书企业自建应用
2. Supabase 已配置环境变量：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_VERIFICATION_TOKEN`
3. 用户已绑定飞书账号（`feishu_user_bindings` 表）

## 部署步骤

### 1. 部署边缘函数

```bash
# 在项目根目录执行
supabase functions deploy habit-reminder-cron
```

### 2. 配置定时任务

#### 方式一：使用 pg_cron（推荐）

在 Supabase Dashboard → SQL Editor 中执行：

```sql
-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每分钟检查一次
SELECT cron.schedule(
  'habit-reminder-check',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://你的项目ID.supabase.co/functions/v1/habit-reminder-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) AS request_id;
  $$
);
```

**查看定时任务：**
```sql
SELECT * FROM cron.job;
```

**删除定时任务：**
```sql
SELECT cron.unschedule('habit-reminder-check');
```

#### 方式二：使用外部 Cron 服务

使用 cron-job.org 或 GitHub Actions 每分钟调用：

```bash
curl -X POST \
  https://你的项目ID.supabase.co/functions/v1/habit-reminder-cron \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### 3. 测试配置

#### 测试 1：手动调用边缘函数

```bash
curl -X POST \
  https://你的项目ID.supabase.co/functions/v1/habit-reminder-cron \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

预期返回：
```json
{
  "message": "Habit reminders processed",
  "processed": 0,
  "results": []
}
```

#### 测试 2：创建测试计划

1. 在习惯纠正站创建一个计划
2. 设置开始时间为当前时间 + 6 分钟
3. 提前提醒设置为 5 分钟
4. 等待 1 分钟后应该收到飞书提醒

#### 测试 3：查看日志

在 Supabase Dashboard → Edge Functions → habit-reminder-cron → Logs 查看执行日志。

## 工作原理

### 执行流程

```
每分钟触发
  ↓
检查当前时间 (HH:MM)
  ↓
查询所有活跃计划
  ↓
筛选今天要执行的计划（days_of_week）
  ↓
计算提醒时间 = 开始时间 - 提前分钟数
  ↓
匹配当前时间 = 提醒时间？
  ↓
检查内存缓存（今天是否已发送）
  ↓
查询用户飞书绑定
  ↓
发送飞书卡片消息
  ↓
记录到内存缓存
```

### 防重复机制

使用内存缓存 `Set<string>`，格式：`schedule_id:YYYY-MM-DD`

- 每天凌晨自动清空缓存
- 同一个计划同一天只发送一次
- 不依赖数据库，性能更好

### 消息格式

发送的飞书卡片包含：
- 标题：⏰ 习惯提醒
- 计划名称（加粗）
- 提醒文本：即将在 X 分钟后开始（HH:MM）
- 计划描述（如果有）
- 来源标识：来自 Lumina 习惯纠正站

## 数据隔离说明

### 与资源中心的关系

| 功能 | 数据表 | 飞书配置 | 用户绑定 |
|------|--------|----------|----------|
| 资源中心 | `resources` | 共享 | 共享 |
| 习惯纠正站 | `habit_schedules` | 共享 | 共享 |

- **数据表独立**：不同功能使用不同的表，不会混淆
- **飞书配置共享**：使用同一个飞书应用的 APP_ID 和 SECRET
- **用户绑定共享**：一次绑定，所有功能都能用

### 消息区分

通过卡片内容区分：
- 资源中心：标题包含 "资源"、"Lumina 资源助手"
- 习惯纠正站：标题包含 "习惯提醒"、"Lumina 习惯纠正站"

用户可以清楚地知道消息来自哪个功能。

## 常见问题

### Q: 为什么没有收到提醒？

检查清单：
1. 计划是否启用（`is_active = true`）
2. 今天是否在 `days_of_week` 中
3. 当前时间是否匹配提醒时间
4. 用户是否绑定了飞书账号
5. 边缘函数是否正常运行（查看日志）

### Q: 会不会重复发送？

不会。使用内存缓存防止重复：
- 同一个计划同一天只发送一次
- 即使边缘函数被多次触发也不会重复

### Q: 如何修改提醒频率？

修改 Cron 表达式：
- 每分钟：`* * * * *`
- 每 5 分钟：`*/5 * * * *`
- 每小时：`0 * * * *`

建议保持每分钟，确保提醒准时。

### Q: 如何停止提醒？

方式一：在界面中停用计划（`is_active = false`）
方式二：删除 Cron Job：
```sql
SELECT cron.unschedule('habit-reminder-check');
```

## 监控建议

1. **定期查看日志**：确保边缘函数正常运行
2. **设置告警**：如果边缘函数失败率过高，发送通知
3. **用户反馈**：收集用户是否收到提醒的反馈

## 成本估算

- 边缘函数调用：每天 1440 次（每分钟一次）
- Supabase 免费额度：每月 500,000 次
- 预计使用：每月 ~43,200 次（远低于免费额度）

完全在免费额度内，无需担心成本。
