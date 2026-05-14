# Lumina Skills API（Prompt + Resource）

## Overview

为技能调用开放两组 HTTP 接口（Vercel Serverless）：

- `GET|POST|PATCH|DELETE /api/skills/prompts`
- `GET|POST|PATCH|DELETE /api/skills/resources`

统一参数：

| 字段 | 位置 | 必填 | 说明 |
|---|---|---|---|
| `action` | query/body | 是 | 动作名 |
| `user_id` | query/body | 是（`ping` 例外） | 用户隔离 ID |

统一返回：

```json
{
  "ok": true,
  "action": "list-prompts",
  "data": {}
}
```

失败时：

```json
{
  "ok": false,
  "error": "..."
}
```

---

## Prompt Module

Endpoint: `/api/skills/prompts`

| action | 说明 | 关键参数 |
|---|---|---|
| `ping` | 健康检查 | - |
| `list-categories` | 获取分类列表 | `user_id` |
| `create-category` | 新建分类 | `user_id`, `name`, `color?` |
| `update-category` | 更新分类 | `user_id`, `id`, `name?`, `color?` |
| `delete-category` | 删除分类 | `user_id`, `id` |
| `list-prompts` | 获取提示词列表 | `user_id`, `include_deleted?`, `limit?`, `offset?` |
| `create-prompt` | 新建提示词 | `user_id`, `title`, `content`, `category_id?`, `tags?` |
| `update-prompt` | 更新提示词 | `user_id`, `id`, `title?`, `content?`, `category_id?`, `tags?` |
| `delete-prompt` | 删除提示词（软删/硬删） | `user_id`, `id`, `hard_delete?` |
| `restore-prompt` | 恢复软删提示词 | `user_id`, `id` |

### Example

```bash
curl -X POST "https://lumina-three-green.vercel.app/api/skills/prompts" \
  -H "Content-Type: application/json" \
  -d '{"action":"list-prompts","user_id":"48914ef8-dcef-4faa-ab53-57167548bcd3","limit":10,"offset":0}'
```

---

## Resource Module

Endpoint: `/api/skills/resources`

| action | 说明 | 关键参数 |
|---|---|---|
| `ping` | 健康检查 | - |
| `list-resources` | 获取资源列表 | `user_id`, `type?`, `archived?`, `include_deleted?`, `limit?`, `offset?` |
| `create-link-resource` | 新建链接资源（自动识别 `github/link`） | `user_id`, `url`, `title?`, `description?`, `metadata?` |
| `create-resource` | 新建通用资源 | `user_id`, `type`, `title`, `description?`, `url?`, `storage_path?`, `file_name?`, `metadata?` |
| `update-resource` | 更新资源 | `user_id`, `id`, `title?`, `description?`, `url?`, `metadata?` |
| `delete-resource` | 删除资源（软删/硬删） | `user_id`, `id`, `hard_delete?` |
| `restore-resource` | 恢复软删资源 | `user_id`, `id` |
| `archive-resource` | 归档资源 | `user_id`, `id` |
| `unarchive-resource` | 取消归档 | `user_id`, `id` |

### Example

```bash
curl -X POST "https://lumina-three-green.vercel.app/api/skills/resources" \
  -H "Content-Type: application/json" \
  -d '{"action":"create-link-resource","user_id":"48914ef8-dcef-4faa-ab53-57167548bcd3","url":"https://github.com/vercel/next.js"}'
```

---

## Env Requirements

接口依赖以下环境变量：

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` 或 `VITE_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` 或 `SUPABASE_ANON_KEY` 或 `VITE_SUPABASE_ANON_KEY` | Supabase Key |

推荐在生产环境优先使用 `SUPABASE_SERVICE_ROLE_KEY`。
