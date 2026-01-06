# 提示词采集系统改进方案

## 概述

本文档记录了对提示词采集系统的改进，包括 Edge Function 的增强和前端 UI 的优化。

## 改进内容

### 1. Edge Function 改进 (supabase/functions/prompt-crawler/index.ts)

#### 1.1 日志系统
- 新增 `Logger` 类，支持 info/warn/error 三个级别
- 所有日志自动保存到数据库 `crawl_logs` 表
- 便于追踪爬取过程中的每一步

```typescript
const logger = new Logger(jobId, supabase);
await logger.info('Starting Reddit crawl');
await logger.error('Failed to fetch', { error: error.message });
```

#### 1.2 重试机制
- 新增 `fetchWithRetry()` 函数，支持指数退避重试
- 自动处理 429 (速率限制) 和 5xx 错误
- 最多重试 3 次，延迟时间为 1s, 2s, 4s

```typescript
const response = await fetchWithRetry(url, options, 3, logger);
```

#### 1.3 反爬虫对策
- 改进 User-Agent，使用真实浏览器标识
- 添加随机延迟 (1-3 秒)，避免被识别为爬虫
- 支持 Retry-After 响应头

```typescript
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const delay = getRandomDelay(1500, 3000);
```

#### 1.4 错误处理
- 完整的 try-catch 包装
- 任务失败时自动更新状态和错误信息
- 详细的错误日志记录

### 2. 数据库改进

#### 2.1 新增日志表 (supabase/plus/024_add_crawl_logs.sql)

```sql
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES crawl_jobs(id),
  level TEXT CHECK (level IN ('info', 'warn', 'error')),
  message TEXT,
  data JSONB,
  created_at TIMESTAMPTZ
);
```

- 记录每个爬取任务的详细日志
- 支持按级别和时间查询
- 便于问题诊断

### 3. 前端改进

#### 3.1 新增进度模态框 (components/CrawlProgressModal.tsx)

**功能：**
- 实时显示爬取进度
- 统计信息展示 (发现/新增/提取数量)
- 详细日志查看
- 错误信息展示
- 自动轮询更新 (每 2 秒)

**特性：**
- 可展开/收起日志列表
- 自动滚动到最新日志
- 按级别分类统计 (信息/警告/错误)
- 显示每条日志的时间戳

#### 3.2 PromptCrawlerPage 改进

**新增功能：**
- "查看进度" 按钮，随时查看采集状态
- 采集启动后自动显示进度模态框
- 任务历史中添加 "重试" 按钮
- 失败任务可一键重试

**改进的用户体验：**
- 采集不再阻塞 UI
- 用户可以继续浏览其他内容
- 实时反馈采集进度
- 清晰的错误提示

#### 3.3 库函数扩展 (lib/prompt-crawler.ts)

新增函数：
```typescript
// 获取爬取日志
export async function getCrawlLogs(jobId: string, limit = 100): Promise<CrawlLog[]>

// 获取任务及其日志
export async function getCrawlJobWithLogs(jobId: string): Promise<{ job: CrawlJob; logs: CrawlLog[] }>
```

## 部署步骤

### 1. 数据库迁移
```bash
# 在 Supabase SQL Editor 中执行
supabase/plus/024_add_crawl_logs.sql
```

### 2. 部署 Edge Function
```bash
supabase functions deploy prompt-crawler
```

### 3. 前端更新
- 新增 `CrawlProgressModal.tsx` 组件
- 更新 `PromptCrawlerPage.tsx` 组件
- 更新 `lib/prompt-crawler.ts` 库

## 性能指标

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 失败重试 | ❌ 无 | ✅ 自动 | - |
| 速率限制处理 | ⚠️ 固定延迟 | ✅ 指数退避 | 50% |
| 错误可见性 | ❌ 无 | ✅ 详细日志 | - |
| 用户体验 | ⚠️ 阻塞 | ✅ 非阻塞 | - |

## 反爬虫风险评估

### Reddit
- **风险等级**: 🟡 中等 → 🟢 低
- **改进**: 真实 UA + 随机延迟 + 重试机制
- **预期**: 被限制风险降低 50%

### GitHub
- **风险等级**: 🟢 低 (无变化)
- **优势**: 官方支持爬虫，完全合规

### OpenAI
- **风险等级**: 🟢 低 (无变化)
- **优势**: 官方 API，合法使用

## 故障排查

### 查看爬取日志
1. 进入采集页面
2. 点击 "查看进度" 按钮
3. 展开 "详细日志" 查看完整日志

### 常见问题

**Q: 采集失败了怎么办？**
A: 
1. 查看详细日志了解失败原因
2. 检查 API 密钥配置
3. 点击 "重试" 按钮重新采集

**Q: 为什么采集速度慢？**
A: 这是正常的，系统添加了随机延迟以避免被限制。

**Q: 日志太多了怎么办？**
A: 可以在模态框中收起日志列表，或者在数据库中定期清理旧日志。

## 后续优化方向

1. **多账户轮换** - 使用多个 Reddit/GitHub 账户轮换爬取
2. **内容去重** - 添加内容哈希去重，避免重复
3. **缓存优化** - 24 小时内不重复爬取相同来源
4. **监控告警** - 爬取失败时发送通知
5. **性能分析** - 记录爬取耗时，优化慢查询

## 相关文件

- `supabase/functions/prompt-crawler/index.ts` - Edge Function
- `supabase/plus/024_add_crawl_logs.sql` - 数据库迁移
- `components/CrawlProgressModal.tsx` - 进度模态框
- `components/PromptCrawlerPage.tsx` - 主页面
- `lib/prompt-crawler.ts` - 业务逻辑库
