# 资源采集工作流 V2.1 配置指南

## 📋 配置清单

### ✅ 必须配置（核心功能）

#### 1. DeepSeek AI API
- **用途**：AI 智能分析和评分
- **获取**：[https://platform.deepseek.com](https://platform.deepseek.com)
- **费用**：新用户送 ¥20，1M tokens ≈ ¥2
- **配置**：
  ```bash
  # 在 n8n 中创建 OpenAI API 凭证
  API Key: sk-xxxxx
  Base URL: https://api.deepseek.com
  ```

#### 2. 飞书 Webhook
- **用途**：接收采集结果通知
- **获取**：飞书群聊 → 设置 → 群机器人 → 添加自定义机器人
- **费用**：免费
- **配置**：
  ```bash
  FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx
  ```

#### 3. Tavily Search API（强烈推荐）
- **用途**：AI 验证工具真实性
- **获取**：[https://tavily.com](https://tavily.com)
- **费用**：免费 1000 次/月
- **配置**：
  ```bash
  TAVILY_API_KEY=tvly_xxxxx
  ```

---

### 🔧 可选配置（提升体验）

#### 4. GitHub Token
- **用途**：提升 API 限额（60 → 5000 次/小时）
- **获取**：[https://github.com/settings/tokens](https://github.com/settings/tokens)
- **权限**：只需 `public_repo`
- **配置**：
  ```bash
  GITHUB_TOKEN=ghp_xxxxxxxxxxxx
  ```

#### 5. Product Hunt API
- **用途**：采集 PH 热门产品
- **获取**：[https://www.producthunt.com/v2/oauth/applications](https://www.producthunt.com/v2/oauth/applications)
- **配置**：
  ```bash
  PRODUCTHUNT_TOKEN=your_token
  ```

#### 6. 邮件服务 SMTP
- **用途**：通过邮件接收 Markdown 报告
- **配置**：
  ```bash
  EMAIL_TO=your-email@example.com
  EMAIL_FROM=noreply@your-domain.com
  EMAIL_ENABLED=true
  SMTP_CREDENTIAL_ID=your_smtp_id
  ```

---

## 🚀 快速开始

### 最小配置（5分钟）

```bash
# 1. 注册 DeepSeek API
访问 https://platform.deepseek.com 获取 API Key

# 2. 配置飞书 Webhook
在飞书群里添加自定义机器人

# 3. 设置环境变量
FEISHU_WEBHOOK=你的飞书webhook

# 4. 在 n8n 中
- 导入 resource-crawler-v2-optimized.json
- 配置 "DeepSeek Chat" 节点凭证
- 点击"手动触发"测试
```

### 完整配置（推荐）

```bash
# n8n 环境变量设置
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
PRODUCTHUNT_TOKEN=your_ph_token
TAVILY_API_KEY=tvly_xxxxx
EMAIL_TO=your-email@example.com
EMAIL_ENABLED=true
EMAIL_FROM=noreply@your-domain.com
```

---

## 📊 节点配置详情

### 需要手动配置的节点

| 节点 ID | 节点名称 | 配置项 | 说明 |
|---------|----------|--------|------|
| 3 | 采集配置 | `feishu_webhook` | 飞书通知地址 |
| 3 | 采集配置 | `email_to` | 收件人邮箱 |
| 3 | 采集配置 | `email_enabled` | 是否启用邮件 |
| 8 | 搜索GitHub | `Authorization` header | GitHub Token（可选） |
| 14 | DeepSeek Chat | Credentials | DeepSeek API 凭证 |
| 15 | 网络搜索工具 | `api_key` | Tavily API Key |
| 25 | 发送邮件 | SMTP Credentials | SMTP 凭证（可选） |
| 29 | 获取Product Hunt | `Authorization` header | PH Token（可选） |

---

## 🔧 环境变量设置方法

### 方法1：n8n UI 设置（推荐）
1. 打开 n8n 界面
2. 进入 `Settings` → `Environments` → `Variables`
3. 点击 `Add Variable`
4. 输入变量名和值

### 方法2：Docker 环境变量
```bash
docker run -d \
  -e FEISHU_WEBHOOK="https://open.feishu.cn/..." \
  -e GITHUB_TOKEN="ghp_xxx" \
  -e TAVILY_API_KEY="tvly_xxx" \
  n8nio/n8n
```

### 方法3：.env 文件
```bash
# .env
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
TAVILY_API_KEY=tvly_xxxxx
```

---

## 🎯 配置优先级

| 配置 | 优先级 | 说明 |
|------|--------|------|
| DeepSeek API | 🔴 必须 | 不配置无法运行 |
| 飞书 Webhook | 🔴 必须 | 不配置无法接收结果 |
| Tavily API | 🟡 推荐 | 提升 AI 分析准确性 |
| GitHub Token | 🟡 推荐 | 避免触发速率限制 |
| Product Hunt | 🟢 可选 | 增加一个数据源 |
| SMTP 邮件 | 🟢 可选 | 已有飞书通知 |

---

## ⚙️ 调整采集参数

在 **采集配置** 节点中可调整：

```javascript
{
  "crawl_type": "tools",              // 采集类型标识
  "crawl_type_name": "🛠️ 工具软件",   // 显示名称
  "subreddits": "SideProject,webdev", // Reddit 板块
  "github_queries": "awesome-tools",  // GitHub 搜索词
  "min_quality_score": 7,             // 最低质量分（1-10）
  "min_popularity_score": 7,          // 最低热度分（1-10）
  "batch_size": 10                    // AI 批量处理大小
}
```

---

## 🆘 常见问题

### Q1：DeepSeek API 额度消耗多少？
- A：单次采集约 50-100 条数据，消耗 ~5k tokens（约 ¥0.01）

### Q2：没有 GitHub Token 可以运行吗？
- A：可以，但每小时只能请求 60 次，采集数据会较少

### Q3：Product Hunt API 不配置会报错吗？
- A：不会，工作流会自动跳过该数据源

### Q4：邮件发送失败怎么办？
- A：检查 SMTP 凭证配置，或设置 `EMAIL_ENABLED=false` 禁用邮件

### Q5：如何修改采集频率？
- A：在 **定时触发** 节点修改 `hoursInterval`（默认6小时）

---

## 📞 技术支持

如遇到配置问题：
1. 检查 n8n 执行日志
2. 确认所有环境变量正确设置
3. 测试单个节点是否正常工作
4. 查看 API 服务商的配额使用情况

---

*最后更新：2025-01-07*
