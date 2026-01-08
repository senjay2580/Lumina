// 飞书 Webhook 处理函数 - 单文件版本（用于 Supabase Web UI 部署）
// 包含所有依赖，无需额外文件

// @ts-ignore - Deno types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============ 环境变量 ============
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') || '';
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') || '';
const FEISHU_VERIFICATION_TOKEN = Deno.env.get('FEISHU_VERIFICATION_TOKEN') || '';

// AI 配置 - 完全按用户配置，无默认值
const AI_API_KEY = Deno.env.get('AI_API_KEY') || '';
const AI_BASE_URL = Deno.env.get('AI_BASE_URL') || '';
const AI_MODEL = Deno.env.get('AI_MODEL') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 消息去重缓存（防止飞书重复发送事件）
const processedMessages = new Map<string, number>();
const MESSAGE_CACHE_TTL = 60000; // 60 秒内的重复消息会被忽略

// 消息去重 - 使用数据库存储已处理的消息ID
async function isMessageProcessed(messageId: string): Promise<boolean> {
  try {
    // 尝试插入消息ID，如果已存在会失败
    const { error } = await supabase
      .from('feishu_processed_messages')
      .insert({ message_id: messageId })
      .single();
    
    if (error) {
      // 如果是唯一约束冲突，说明消息已处理过
      if (error.code === '23505') {
        console.log('[MSG] Duplicate detected via DB:', messageId);
        return true;
      }
      // 如果表不存在，使用内存缓存作为后备
      console.log('[MSG] DB check failed, using memory cache:', error.message);
    } else {
      console.log('[MSG] New message recorded:', messageId);
      return false;
    }
  } catch (e) {
    console.log('[MSG] DB error, using memory cache');
  }
  
  // 后备：内存缓存
  const now = Date.now();
  
  // 清理过期的缓存
  for (const [id, timestamp] of processedMessages) {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(id);
    }
  }
  
  // 检查是否已处理
  if (processedMessages.has(messageId)) {
    return true;
  }
  
  // 标记为已处理
  processedMessages.set(messageId, now);
  return false;
}

// ============ 飞书 API 封装 ============
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }

  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000,
  };

  return data.tenant_access_token;
}

async function sendTextMessage(openId: string, text: string): Promise<void> {
  const token = await getTenantAccessToken();
  
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    console.error('发送消息失败:', data);
  }
}

async function sendCardMessage(openId: string, card: object): Promise<void> {
  const token = await getTenantAccessToken();
  
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }),
  });

  const data = await response.json();
  if (data.code !== 0) {
    console.error('发送卡片消息失败:', data);
  }
}

async function downloadFeishuFile(messageId: string, fileKey: string): Promise<Blob> {
  const token = await getTenantAccessToken();
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${fileKey}?type=file`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(`下载文件失败: ${response.status}`);
  return response.blob();
}

async function downloadFeishuImage(messageId: string, imageKey: string): Promise<Blob> {
  const token = await getTenantAccessToken();
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(`下载图片失败: ${response.status}`);
  return response.blob();
}

async function getFeishuUserInfo(openId: string) {
  const token = await getTenantAccessToken();
  const response = await fetch(
    `https://open.feishu.cn/open-apis/contact/v3/users/${openId}?user_id_type=open_id`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  if (data.code !== 0) {
    return { name: '飞书用户', avatar: '', userId: undefined, unionId: undefined };
  }
  return {
    name: data.data.user.name,
    avatar: data.data.user.avatar?.avatar_origin || '',
    userId: data.data.user.user_id,
    unionId: data.data.user.union_id,
  };
}

// ============ 消息解析工具 ============
interface ParsedMessage {
  type: 'text' | 'image' | 'file' | 'unknown';
  content?: string;
  fileKey?: string;
  fileName?: string;
}

function parseMessageContent(msgType: string, content: string): ParsedMessage {
  try {
    const parsed = JSON.parse(content);
    switch (msgType) {
      case 'text': return { type: 'text', content: parsed.text };
      case 'image': return { type: 'image', fileKey: parsed.image_key };
      case 'file': return { type: 'file', fileKey: parsed.file_key, fileName: parsed.file_name };
      default: return { type: 'unknown' };
    }
  } catch {
    return { type: 'unknown' };
  }
}

function extractUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+)/g);
  return match ? match[0] : null;
}

function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = text.trim();
  
  // 只支持 /command 格式的英文指令
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    // 只识别这些指令，其他的不算指令
    if (['help', 'list', 'search', 'stats', 'unbind', 'bind', 'debug', 'github', 'reddit', 'crawl'].includes(cmd)) {
      return { command: cmd, args: parts.slice(1).join(' ') };
    }
  }
  
  return null;
}

// ============ AI 智能搜索 ============

interface AISearchResult {
  intent: string;           // AI 理解的用户意图
  matchedIds: string[];     // AI 选择的资源 ID
  suggestion: string;       // AI 的建议/总结
}

// 获取用户资源（分页）
async function getResourcesPage(userId: string, offset: number, limit: number = 100): Promise<any[]> {
  const { data } = await supabase
    .from('resources')
    .select('id, title, type, url, description, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  return data || [];
}

// AI 分析查询并从资源中选择最相关的
async function aiSmartMatch(query: string, resources: any[]): Promise<AISearchResult> {
  if (!AI_API_KEY) {
    return {
      intent: query,
      matchedIds: [],
      suggestion: '未配置 AI 服务，请在 Supabase Secrets 中设置 AI_API_KEY',
    };
  }

  if (resources.length === 0) {
    return {
      intent: query,
      matchedIds: [],
      suggestion: '当前批次没有资源',
    };
  }

  // 统计各分类数量
  const typeStats = {
    link: resources.filter(r => r.type === 'link').length,
    github: resources.filter(r => r.type === 'github').length,
    document: resources.filter(r => r.type === 'document').length,
    image: resources.filter(r => r.type === 'image').length,
  };

  // 构建资源列表给 AI，突出显示分类
  const resourceList = resources.map((r, i) => {
    const typeLabel = { link: '链接', github: 'GitHub项目', document: '文档', image: '图片' }[r.type] || r.type;
    return `${i}: 【${typeLabel}】${r.title}${r.description ? ' - ' + r.description.slice(0, 80) : ''}${r.url ? ' | ' + r.url : ''}`;
  }).join('\n');

  const systemPrompt = `你是资源搜索助手。根据用户查询，从资源列表中选择相关资源。

资源统计：链接${typeStats.link}个，GitHub${typeStats.github}个，文档${typeStats.document}个，图片${typeStats.image}个

资源列表：
${resourceList}

匹配规则（按优先级）：
1. 分类匹配：查询"github"→返回所有【GitHub项目】；查询"链接"→返回所有【链接】；查询"文档"→返回所有【文档】；查询"图片"→返回所有【图片】
2. 关键词匹配：标题、描述、URL中包含查询关键词
3. 语义匹配：内容与查询意图相关

返回JSON（只返回JSON，无其他内容）：
{"intent":"理解的意图","matchedIndexes":[0,1,2],"suggestion":"中文推荐理由"}

注意：matchedIndexes是数字数组，对应资源序号。如果有匹配必须返回，宁可多返回也不要漏掉。`;

  try {
    console.log('[AI] Request - query:', query, 'resources:', resources.length, 'types:', JSON.stringify(typeStats));
    console.log('[AI] Resource list sample:', resourceList.slice(0, 500));
    
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `查询：${query}` },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] API error:', response.status, errText);
      return {
        intent: query,
        matchedIds: [],
        suggestion: `AI 服务调用失败: ${response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[AI] Raw response:', content);
    
    // 解析 JSON - 尝试多种方式
    let parsed: any = null;
    
    // 方式1: 直接解析
    try {
      parsed = JSON.parse(content.trim());
    } catch {
      // 方式2: 提取 JSON 块
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('[AI] JSON parse error:', e);
        }
      }
    }
    
    if (parsed && parsed.matchedIndexes) {
      console.log('[AI] Parsed result:', JSON.stringify(parsed));
      
      // 把序号转换成实际的资源 ID
      const indexes = Array.isArray(parsed.matchedIndexes) ? parsed.matchedIndexes : [];
      const matchedIds = indexes
        .filter((i: number) => typeof i === 'number' && i >= 0 && i < resources.length)
        .map((i: number) => resources[i].id);
      
      console.log('[AI] Matched indexes:', indexes, '-> IDs:', matchedIds);
      
      return {
        intent: parsed.intent || query,
        matchedIds,
        suggestion: parsed.suggestion || '以上是为你找到的相关资源',
      };
    }
    
    console.error('[AI] Response format error, content:', content);
    return {
      intent: query,
      matchedIds: [],
      suggestion: 'AI 返回格式错误，请重试',
    };
  } catch (err) {
    console.error('[AI] Analysis failed:', err);
    return {
      intent: query,
      matchedIds: [],
      suggestion: 'AI 分析失败，请检查配置',
    };
  }
}

// 分页搜索直到找到结果或遍历完所有资源
async function searchWithPagination(userId: string, query: string): Promise<{ aiResult: AISearchResult; matchedResources: any[] }> {
  const pageSize = 100;
  let offset = 0;
  let allMatchedResources: any[] = [];
  let finalAiResult: AISearchResult = {
    intent: query,
    matchedIds: [],
    suggestion: '没有找到匹配的资源',
  };
  
  const processedIds = new Set<string>(); // 防止重复
  
  console.log('[Search] Starting search for:', query, 'userId:', userId);
  
  while (true) {
    const resources = await getResourcesPage(userId, offset, pageSize);
    console.log('[Search] Page offset:', offset, 'fetched:', resources.length);
    
    // 没有更多资源了
    if (resources.length === 0) {
      console.log('[Search] No more resources');
      break;
    }
    
    // 过滤掉已处理过的资源
    const newResources = resources.filter(r => !processedIds.has(r.id));
    newResources.forEach(r => processedIds.add(r.id));
    
    console.log('[Search] New resources to process:', newResources.length);
    
    if (newResources.length === 0) {
      offset += pageSize;
      continue;
    }
    
    // AI 分析这批资源
    const aiResult = await aiSmartMatch(query, newResources);
    console.log('[Search] AI result - matched:', aiResult.matchedIds.length);
    
    // 如果找到了匹配的资源
    if (aiResult.matchedIds.length > 0) {
      const matchedResources = aiResult.matchedIds
        .map(id => newResources.find(r => r.id === id))
        .filter(Boolean);
      
      allMatchedResources.push(...matchedResources);
      finalAiResult = aiResult;
      
      console.log('[Search] Found matches:', matchedResources.length, 'total:', allMatchedResources.length);
      
      // 如果已经找到足够的结果（5个），就停止
      if (allMatchedResources.length >= 5) {
        break;
      }
    }
    
    // 如果这批资源不足 pageSize，说明已经是最后一批了
    if (resources.length < pageSize) {
      console.log('[Search] Last page reached');
      break;
    }
    
    offset += pageSize;
    
    // 安全限制：最多遍历 1000 条资源
    if (offset >= 1000) {
      console.log('[Search] Max offset reached');
      break;
    }
  }
  
  console.log('[Search] Final result - matched:', allMatchedResources.length);
  
  return {
    aiResult: finalAiResult,
    matchedResources: allMatchedResources.slice(0, 5), // 最多返回 5 个
  };
}

// 生成 AI 搜索结果卡片
function generateAISearchCard(
  query: string,
  aiResult: AISearchResult,
  matchedResources: any[]
): object {
  const typeEmoji: Record<string, string> = {
    link: '🔗', github: '📦', document: '📄', image: '🖼️',
  };

  const elements: any[] = [];

  // AI 理解的意图
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `🤖 **AI 理解**：${aiResult.intent}`,
    },
  });

  elements.push({ tag: 'hr' });

  // AI 推荐理由
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `💡 ${aiResult.suggestion}`,
    },
  });

  elements.push({ tag: 'hr' });

  // 搜索结果
  if (matchedResources.length === 0) {
    elements.push({
      tag: 'div',
      text: { tag: 'plain_text', content: '📭 没有找到匹配的资源' },
    });
    elements.push({
      tag: 'note',
      elements: [
        { tag: 'plain_text', content: '试试用其他方式描述你想找的内容' },
      ],
    });
  } else {
    matchedResources.forEach((r: any) => {
      const emoji = typeEmoji[r.type] || '📎';
      const date = new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      
      elements.push({
        tag: 'div',
        fields: [{
          is_short: false,
          text: {
            tag: 'lark_md',
            content: r.url 
              ? `${emoji} **[${r.title}](${r.url})**`
              : `${emoji} **${r.title}**`,
          },
        }],
      });
      
      if (r.description) {
        elements.push({
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: r.description.slice(0, 80) + (r.description.length > 80 ? '...' : '') },
          ],
        });
      }
      
      elements.push({
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `${r.type} · ${date}` },
        ],
      });
      
      elements.push({ tag: 'hr' });
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🔮 智能搜索：${query.slice(0, 20)}${query.length > 20 ? '...' : ''}` },
      template: 'violet',
    },
    elements,
  };
}

// 处理 AI 搜索
async function handleAISearch(userId: string, query: string): Promise<object | string> {
  if (!query.trim()) {
    return '❓ 请告诉我你想找什么\n\n直接输入即可，比如：\n• "AI 工具"\n• "React 文档"\n• "GitHub 项目"';
  }

  // 检查 AI 配置
  if (!AI_API_KEY) {
    console.log('[AI] API_KEY not configured');
    return '⚠️ AI 服务未配置\n\n请在 Supabase Edge Functions Secrets 中设置：\n• AI_API_KEY（必需）\n• AI_BASE_URL（必需）\n• AI_MODEL（必需）';
  }

  if (!AI_BASE_URL) {
    console.log('[AI] BASE_URL not configured');
    return '⚠️ AI_BASE_URL 未配置\n\n请在 Supabase Edge Functions Secrets 中设置 AI_BASE_URL';
  }

  if (!AI_MODEL) {
    console.log('[AI] MODEL not configured');
    return '⚠️ AI_MODEL 未配置\n\n请在 Supabase Edge Functions Secrets 中设置 AI_MODEL';
  }

  console.log('[AI] Starting search, API configured:', !!AI_API_KEY, 'Base URL:', AI_BASE_URL, 'Model:', AI_MODEL);

  // 分页搜索
  const { aiResult, matchedResources } = await searchWithPagination(userId, query);
  
  return generateAISearchCard(query, aiResult, matchedResources);
}

// ============ 卡片生成 ============
function generateHelpCard(): object {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '📚 Lumina 资源助手' }, template: 'orange' },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: '**添加资源：**\n• 发送链接 → 自动识别保存\n• 发送图片 → 自动上传\n• 发送文件 → 自动上传' } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**🔮 AI 智能搜索：**\n直接输入你想找的内容！\n• "AI 工具"\n• "React 文档"\n• "GitHub 项目"' } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**🕷️ 提示词采集：**\n• `/github 关键词` - 采集 GitHub 仓库\n• `/reddit 版块名` - 采集 Reddit 帖子\n\n示例：\n• `/github prompt-engineering cursor-rules`\n• `/reddit ChatGPT PromptEngineering`\n\n最多支持 3 个关键词/版块' } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**其他指令：**\n• `/help` - 显示帮助\n• `/list` - 查看最近7天资源\n• `/list 30` - 最近30天全部资源\n• `/search 关键词` - 搜索资源\n• `/stats` - 查看统计\n• `/unbind` - 解绑账号' } },
    ],
  };
}

function generateResourceAddedCard(title: string, type: string): object {
  const typeLabels: Record<string, string> = { link: '🔗 链接', github: '📦 GitHub', document: '📄 文档', image: '🖼️ 图片' };
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '✅ 资源已添加' }, template: 'green' },
    elements: [
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: `**类型**\n${typeLabels[type] || type}` } },
        { is_short: true, text: { tag: 'lark_md', content: `**标题**\n${title}` } },
      ] },
    ],
  };
}

// ============ 业务逻辑 ============
async function getBoundUserId(openId: string): Promise<string | null> {
  const { data } = await supabase
    .from('feishu_user_bindings')
    .select('user_id')
    .eq('feishu_open_id', openId)
    .single();
  return data?.user_id || null;
}

async function handleBindCommand(openId: string, code: string): Promise<string> {
  const { data: bindCode } = await supabase
    .from('feishu_bind_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!bindCode) return '❌ 绑定码无效或已过期，请重新获取';

  const { data: existingBinding } = await supabase
    .from('feishu_user_bindings')
    .select('id')
    .eq('feishu_open_id', openId)
    .single();

  if (existingBinding) return '❌ 此飞书账号已绑定，请先用 /unbind 解绑';

  const userInfo = await getFeishuUserInfo(openId);

  const { error: bindError } = await supabase
    .from('feishu_user_bindings')
    .insert({
      user_id: bindCode.user_id,
      feishu_open_id: openId,
      feishu_user_id: userInfo.userId,
      feishu_union_id: userInfo.unionId,
      feishu_name: userInfo.name,
      feishu_avatar: userInfo.avatar,
    });

  if (bindError) return '❌ 绑定失败，请稍后重试';

  await supabase.from('feishu_bind_codes').update({ used_at: new Date().toISOString() }).eq('id', bindCode.id);

  return `✅ 绑定成功！\n\n你好 ${userInfo.name}，现在可以直接发送链接、图片或文件来添加资源了。\n\n发送 /help 查看所有指令。`;
}

async function handleUnbindCommand(openId: string): Promise<string> {
  await supabase.from('feishu_user_bindings').delete().eq('feishu_open_id', openId);
  return '✅ 已解绑\n\n如需重新使用，请在 Lumina 设置页面获取新的绑定码。';
}

async function addLinkResource(userId: string, url: string): Promise<{ title: string; type: string }> {
  const isGitHub = url.includes('github.com');
  const type = isGitHub ? 'github' : 'link';
  let title: string;
  let metadata: Record<string, any> = {};
  let description: string | undefined;

  if (isGitHub) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      const [, owner, repo] = match;
      title = `${owner}/${repo}`;
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (response.ok) {
          const data = await response.json();
          metadata = { owner: data.owner.login, repo: data.name, stars: data.stargazers_count, forks: data.forks_count, language: data.language };
          description = data.description;
        }
      } catch {}
    } else {
      title = new URL(url).host + new URL(url).pathname;
    }
  } else {
    const parsed = new URL(url);
    title = parsed.host + parsed.pathname.replace(/\/$/, '');
  }

  await supabase.from('resources').insert({ user_id: userId, type, title, description, url, metadata });
  return { title, type };
}

async function uploadFileResource(userId: string, blob: Blob, fileName: string, isImage: boolean): Promise<{ title: string; type: string }> {
  const resourceId = crypto.randomUUID();
  const ext = fileName.split('.').pop() || (isImage ? 'png' : 'bin');
  const storagePath = `${userId}/${resourceId}.${ext}`;
  const type = isImage ? 'image' : 'document';

  await supabase.storage.from('resources').upload(storagePath, blob, {
    contentType: isImage ? `image/${ext}` : 'application/octet-stream',
  });

  await supabase.from('resources').insert({
    id: resourceId, user_id: userId, type, title: fileName, storage_path: storagePath, file_name: fileName, metadata: {},
  });

  return { title: fileName, type };
}

// 生成文件公开 URL
function getFilePublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/resources/${storagePath}`;
}

// 处理列表指令 - 返回多张卡片（每张最多 15 条），支持图片/文档预览
async function handleListCommand(userId: string, openId: string, typeFilter?: string, days?: number): Promise<void> {
  const actualDays = days || 7;
  const since = new Date(Date.now() - actualDays * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('resources')
    .select('title, type, url, storage_path, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('type', typeFilter);
  }

  const { data, error } = await query;

  const typeLabels: Record<string, string> = {
    all: '全部',
    link: '链接',
    github: 'GitHub',
    document: '文档',
    image: '图片',
  };

  const typeEmoji: Record<string, string> = {
    link: '🔗',
    github: '📦',
    document: '📄',
    image: '🖼️',
  };

  // 如果没有数据，发送空结果卡片
  if (error || !data || data.length === 0) {
    const emptyCard = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `📋 资源列表${typeFilter && typeFilter !== 'all' ? ` · ${typeLabels[typeFilter]}` : ''}` },
        template: 'orange',
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'plain_text', content: `📭 最近 ${actualDays} 天没有${typeFilter && typeFilter !== 'all' ? typeLabels[typeFilter] : ''}资源` },
        },
      ],
    };
    await sendCardMessage(openId, emptyCard);
    return;
  }

  // 分批发送，每批最多 15 条
  const BATCH_SIZE = 15;
  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / BATCH_SIZE);

  for (let page = 0; page < totalPages; page++) {
    const start = page * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalCount);
    const batch = data.slice(start, end);
    
    const elements: any[] = [];

    // 第一张卡片显示统计
    if (page === 0) {
      elements.push({
        tag: 'div',
        text: { tag: 'lark_md', content: `**共 ${totalCount} 条资源** · 最近 ${actualDays} 天` },
      });
      elements.push({ tag: 'hr' });
    }

    // 资源列表
    batch.forEach((r: any, i: number) => {
      const emoji = typeEmoji[r.type] || '📎';
      const date = new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      
      // 图片类型：显示可点击的预览链接
      if (r.type === 'image' && r.storage_path) {
        const imageUrl = getFilePublicUrl(r.storage_path);
        
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: false,
              text: {
                tag: 'lark_md',
                content: `${emoji} **[${r.title}](${imageUrl})**`,
              },
            },
          ],
        });
        elements.push({
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: `${typeLabels[r.type] || r.type} · ${date} · 点击查看大图` },
          ],
        });
      }
      // 文档类型：显示下载链接
      else if (r.type === 'document' && r.storage_path) {
        const fileUrl = getFilePublicUrl(r.storage_path);
        
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: false,
              text: {
                tag: 'lark_md',
                content: `${emoji} **[${r.title}](${fileUrl})**`,
              },
            },
          ],
        });
        elements.push({
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: `${typeLabels[r.type] || r.type} · ${date} · 点击下载/预览` },
          ],
        });
      }
      // 链接/GitHub 类型：显示可点击链接
      else {
        elements.push({
          tag: 'div',
          fields: [
            {
              is_short: false,
              text: {
                tag: 'lark_md',
                content: r.url 
                  ? `${emoji} **[${r.title}](${r.url})**`
                  : `${emoji} **${r.title}**`,
              },
            },
          ],
        });
        elements.push({
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: `${typeLabels[r.type] || r.type} · ${date}` },
          ],
        });
      }
      
      if (i < batch.length - 1) {
        elements.push({ tag: 'hr' });
      }
    });

    // 构建卡片
    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: { 
          tag: 'plain_text', 
          content: totalPages > 1 
            ? `📋 资源列表 (${page + 1}/${totalPages})${typeFilter && typeFilter !== 'all' ? ` · ${typeLabels[typeFilter]}` : ''}`
            : `📋 资源列表${typeFilter && typeFilter !== 'all' ? ` · ${typeLabels[typeFilter]}` : ''}`
        },
        template: 'orange',
      },
      elements,
    };

    await sendCardMessage(openId, card);
    
    // 避免发送过快被限流
    if (page < totalPages - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

async function handleSearchCommand(userId: string, keyword: string): Promise<object | string> {
  if (!keyword) return '❌ 请输入搜索关键词';

  const { data } = await supabase.from('resources').select('title, type, url, created_at')
    .eq('user_id', userId).is('deleted_at', null).ilike('title', `%${keyword}%`)
    .order('created_at', { ascending: false }).limit(50);

  const typeEmoji: Record<string, string> = { link: '🔗', github: '📦', document: '📄', image: '🖼️' };
  const elements: any[] = [];

  if (!data || data.length === 0) {
    elements.push({ tag: 'div', text: { tag: 'plain_text', content: `🔍 未找到包含「${keyword}」的资源` } });
  } else {
    data.forEach((r: any) => {
      const emoji = typeEmoji[r.type] || '📎';
      elements.push({
        tag: 'div', fields: [{ is_short: false, text: { tag: 'lark_md', content: r.url ? `${emoji} **[${r.title}](${r.url})**` : `${emoji} **${r.title}**` } }],
      });
      elements.push({ tag: 'hr' });
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: `🔍 搜索「${keyword}」` }, template: 'blue' },
    elements,
  };
}

async function handleStatsCommand(userId: string): Promise<object> {
  const { data } = await supabase.from('resources').select('type, created_at')
    .eq('user_id', userId).is('deleted_at', null).is('archived_at', null);

  const stats = {
    total: data?.length || 0,
    link: data?.filter((r: any) => r.type === 'link').length || 0,
    github: data?.filter((r: any) => r.type === 'github').length || 0,
    document: data?.filter((r: any) => r.type === 'document').length || 0,
    image: data?.filter((r: any) => r.type === 'image').length || 0,
  };

  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '📊 资源统计' }, template: 'purple' },
    elements: [
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: `**📚 总计**\n${stats.total} 条` } },
        { is_short: true, text: { tag: 'lark_md', content: `**🔗 链接**\n${stats.link} 条` } },
      ] },
      { tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: `**📦 GitHub**\n${stats.github} 条` } },
        { is_short: true, text: { tag: 'lark_md', content: `**📄 文档**\n${stats.document} 条` } },
      ] },
    ],
  };
}

// ============ 提示词爬虫（断点续采版）============

// 爬虫配置（只保留阈值，关键词由用户指定）
const CRAWL_CONFIG = {
  min_reddit_score: 10,
  min_github_stars: 50,
  max_execution_time: 45000
};

// 清理 HTML 标签和多余空白
function cleanContent(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')           // 移除 HTML 标签
    .replace(/!\[.*?\]\(.*?\)/g, '')   // 移除 Markdown 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 保留链接文字
    .replace(/```[\s\S]*?```/g, '')    // 移除代码块
    .replace(/`[^`]*`/g, '')           // 移除行内代码
    .replace(/#{1,6}\s*/g, '')         // 移除标题标记
    .replace(/\*\*|__/g, '')           // 移除加粗
    .replace(/\*|_/g, '')              // 移除斜体
    .replace(/\s+/g, ' ')              // 合并空白
    .trim();
}

// 爬虫进度类型
interface CrawlProgress {
  id?: string;
  user_id: string;
  job_type: 'reddit' | 'github' | 'all';
  reddit_index: number;
  github_index: number;
  reddit_found: number;
  reddit_extracted: number;
  github_found: number;
  github_extracted: number;
  started_at: string;
  updated_at: string;
  status: 'running' | 'completed';
}

// 获取或创建爬虫进度
async function getCrawlProgress(userId: string, jobType: 'reddit' | 'github' | 'all'): Promise<CrawlProgress | null> {
  const { data, error } = await supabase
    .from('crawl_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('job_type', jobType)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('[Crawl] getCrawlProgress error:', error);
  }
  return data;
}

// 保存爬虫进度（使用 update 而不是 upsert）
async function saveCrawlProgress(progress: CrawlProgress & { id?: string }): Promise<void> {
  if (!progress.id) {
    console.error('[Crawl] saveCrawlProgress: no id');
    return;
  }
  
  const { error } = await supabase
    .from('crawl_progress')
    .update({
      reddit_index: progress.reddit_index,
      github_index: progress.github_index,
      reddit_found: progress.reddit_found,
      reddit_extracted: progress.reddit_extracted,
      github_found: progress.github_found,
      github_extracted: progress.github_extracted,
      updated_at: new Date().toISOString()
    })
    .eq('id', progress.id);
  
  if (error) {
    console.error('[Crawl] saveCrawlProgress error:', error);
  }
}

// 创建新的爬虫进度
async function createCrawlProgress(userId: string, jobType: 'reddit' | 'github' | 'all'): Promise<CrawlProgress & { id: string }> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('crawl_progress')
    .insert({
      user_id: userId,
      job_type: jobType,
      reddit_index: 0,
      github_index: 0,
      reddit_found: 0,
      reddit_extracted: 0,
      github_found: 0,
      github_extracted: 0,
      started_at: now,
      updated_at: now,
      status: 'running'
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Crawl] createCrawlProgress error:', error);
    throw new Error(`创建进度失败: ${error.message}`);
  }
  
  console.log('[Crawl] Created progress:', data.id);
  return data;
}

// 标记进度完成
async function completeCrawlProgress(userId: string, jobType: 'reddit' | 'github' | 'all'): Promise<void> {
  const { error } = await supabase
    .from('crawl_progress')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('job_type', jobType)
    .eq('status', 'running');
}

// 计算内容哈希（用于去重）
async function computeContentHash(content: string): Promise<string> {
  const normalized = content.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').replace(/\s+/g, ' ').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 爬取单个 Reddit 子版块
async function crawlSingleSubreddit(subreddit: string, minScore: number): Promise<any[]> {
  const results: any[] = [];
  
  // CORS 代理列表（服务端也可以用）
  const corsProxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
  
  try {
    console.log(`[Crawl] Fetching r/${subreddit}...`);
    
    const targetUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=30&raw_json=1`;
    let data = null;
    
    // 尝试不同的代理
    for (const proxyFn of corsProxies) {
      try {
        const proxyUrl = proxyFn(targetUrl);
        console.log(`[Crawl] Trying proxy for r/${subreddit}...`);
        
        const response = await fetch(proxyUrl, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          data = await response.json();
          console.log(`[Crawl] r/${subreddit} proxy success`);
          break;
        }
      } catch (proxyErr) {
        console.log(`[Crawl] Proxy failed for r/${subreddit}, trying next...`);
      }
    }
    
    if (!data) {
      console.log(`[Crawl] r/${subreddit} failed: all proxies failed`);
      return results;
    }
    
    const children = data?.data?.children || [];
    
    for (const child of children) {
      const post = child.data;
      if (post.stickied || post.score < minScore) continue;
      if (!post.title || !post.selftext || post.selftext.length < 50) continue;
      
      results.push({
        id: post.id,
        title: post.title,
        content: post.selftext,
        url: `https://reddit.com${post.permalink}`,
        author: post.author,
        subreddit: post.subreddit
      });
    }
    
    console.log(`[Crawl] r/${subreddit}: found ${results.length} posts`);
  } catch (e) {
    console.error(`[Crawl] Error crawling r/${subreddit}:`, e);
  }
  
  return results;
}

// 爬取单个 GitHub 搜索词
async function crawlSingleGitHubQuery(query: string, minStars: number): Promise<any[]> {
  const results: any[] = [];
  
  try {
    console.log(`[Crawl] Searching GitHub "${query}" (minStars: ${minStars})...`);
    
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=10`;
    console.log(`[Crawl] GitHub API URL: ${url}`);
    
    const response = await fetch(url, { 
      headers: { 
        'Accept': 'application/vnd.github.v3+json', 
        'User-Agent': 'Lumina-Bot/1.0' 
      } 
    });
    
    console.log(`[Crawl] GitHub response status: ${response.status}`);
    
    if (!response.ok) {
      const errText = await response.text();
      console.log(`[Crawl] GitHub search failed: ${response.status} - ${errText}`);
      return results;
    }
    
    const data = await response.json();
    const items = data?.items || [];
    console.log(`[Crawl] GitHub returned ${items.length} items, total_count: ${data?.total_count}`);
    
    for (const repo of items) {
      console.log(`[Crawl] Checking repo: ${repo.full_name}, stars: ${repo.stargazers_count}`);
      
      if (repo.stargazers_count < minStars) {
        console.log(`[Crawl] Skipping ${repo.full_name}: stars ${repo.stargazers_count} < ${minStars}`);
        continue;
      }
      
      // 尝试获取 README
      let readme = '';
      try {
        const readmeRes = await fetch(
          `https://api.github.com/repos/${repo.full_name}/readme`,
          { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Lumina-Bot/1.0' } }
        );
        if (readmeRes.ok) {
          const readmeData = await readmeRes.json();
          readme = atob(readmeData.content || '').substring(0, 2000);
        }
      } catch (e) {
        console.log(`[Crawl] Failed to get README for ${repo.full_name}`);
      }
      
      results.push({
        id: repo.full_name,
        title: repo.name,
        content: `${repo.description || ''}\n\n${readme}`,
        url: repo.html_url,
        author: repo.owner.login,
        repoName: repo.full_name,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        pushedAt: repo.pushed_at
      });
    }
    
    console.log(`[Crawl] GitHub "${query}": found ${results.length} repos with >= ${minStars} stars`);
  } catch (e) {
    console.error(`[Crawl] Error searching GitHub "${query}":`, e);
  }
  
  return results;
}

// 批量爬取 Reddit（服务端版本）
async function crawlRedditServer(subreddits: string[], minScore: number): Promise<any[]> {
  const allPosts: any[] = [];
  
  for (const subreddit of subreddits) {
    const posts = await crawlSingleSubreddit(subreddit, minScore);
    allPosts.push(...posts);
    // 避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }
  
  return allPosts;
}

// 批量爬取 GitHub（服务端版本）
async function crawlGitHubServer(queries: string[], minStars: number): Promise<any[]> {
  const allRepos: any[] = [];
  const seenRepos = new Set<string>();
  
  for (const query of queries) {
    const repos = await crawlSingleGitHubQuery(query, minStars);
    for (const repo of repos) {
      if (!seenRepos.has(repo.id)) {
        seenRepos.add(repo.id);
        allRepos.push(repo);
      }
    }
    // 避免请求过快
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return allRepos;
}

// AI 分析提取提示词
async function analyzeWithAIServer(
  content: string,
  sourceType: string,
  title: string
): Promise<{ prompts: Array<{ title: string; content: string; category: string; quality: number }>; analysis: any } | null> {
  if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) return null;
  if (content.trim().length < 50) return null;

  const systemPrompt = `你是 AI 提示词专家。分析内容，提取高质量 AI 提示词。
输出 JSON：{"prompts": [{ "title": "标题", "content": "完整提示词", "category": "分类", "quality": 8.5 }], "analysis": { "summary": "摘要", "language": "语言" }}
评分：10分=专业级，7-9=高质量，4-6=一般，1-3=低质量。无提示词返回空数组。`;

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `来源: ${sourceType}\n标题: ${title}\n\n${content.substring(0, 2000)}` }
        ],
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    // 尝试解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error('[Crawl] AI analysis error:', e);
    return null;
  }
}

// 快速爬虫（不做 AI 分析，直接保存到 extracted_prompts 表）
async function executeQuickCrawl(
  jobType: 'github' | 'reddit',
  userId: string,
  openId: string,
  keywords: string[]  // 用户指定的关键词
): Promise<void> {
  const startTime = Date.now();
  
  const isGitHub = jobType === 'github';
  // 最多 3 个关键词
  const sources = keywords.slice(0, 3);
  
  console.log(`[QuickCrawl] Starting ${jobType} crawl for user ${userId}`);
  console.log(`[QuickCrawl] Keywords:`, sources);
  
  await sendTextMessage(openId, `🚀 开始采集 ${isGitHub ? 'GitHub' : 'Reddit'}...\n\n${isGitHub ? '搜索词' : '版块'}：${sources.join(', ')}`);
  
  let found = 0;
  let saved = 0;
  const seenIds = new Set<string>();
  
  try {
    for (const source of sources) {
      if (Date.now() - startTime > 40000) {
        console.log('[QuickCrawl] Timeout approaching, stopping');
        break;
      }
      
      console.log(`[QuickCrawl] Processing: ${source}`);
      
      if (isGitHub) {
        // GitHub 爬取
        const repos = await crawlSingleGitHubQuery(source, CRAWL_CONFIG.min_github_stars);
        console.log(`[QuickCrawl] GitHub "${source}" returned ${repos.length} repos`);
        
        for (const repo of repos) {
          if (seenIds.has(repo.id)) continue;
          seenIds.add(repo.id);
          found++;
          
          const contentHash = await computeContentHash(repo.url + repo.title);
          
          const { data: existing, error: selectError } = await supabase
            .from('extracted_prompts')
            .select('id')
            .eq('user_id', userId)
            .eq('content_hash', contentHash)
            .maybeSingle();
          
          if (selectError) {
            console.error('[QuickCrawl] Select error:', selectError);
          }
          
          if (!existing) {
            const { error } = await supabase.from('extracted_prompts').insert({
              user_id: userId,
              prompt_title: repo.title,
              prompt_content: cleanContent(repo.content).substring(0, 5000),
              suggested_category: 'github',
              quality_score: 7.0,
              language: 'en',
              source_type: 'github',
              source_url: repo.url,
              source_name: repo.repoName,
              source_author: repo.author,
              source_stars: repo.stars,
              source_forks: repo.forks,
              content_hash: contentHash
            });
            
            if (!error) {
              saved++;
              console.log(`[QuickCrawl] Saved: ${repo.title}`);
            } else {
              console.error('[QuickCrawl] Insert error:', error);
            }
          } else {
            console.log(`[QuickCrawl] Already exists: ${repo.title}`);
          }
        }
      } else {
        // Reddit 爬取
        const posts = await crawlSingleSubreddit(source, CRAWL_CONFIG.min_reddit_score);
        console.log(`[QuickCrawl] Reddit r/${source} returned ${posts.length} posts`);
        
        for (const post of posts) {
          if (seenIds.has(post.id)) continue;
          seenIds.add(post.id);
          found++;
          
          const contentHash = await computeContentHash(post.url + post.title);
          
          const { data: existing, error: selectError } = await supabase
            .from('extracted_prompts')
            .select('id')
            .eq('user_id', userId)
            .eq('content_hash', contentHash)
            .maybeSingle();
          
          if (selectError) {
            console.error('[QuickCrawl] Select error:', selectError);
          }
          
          if (!existing) {
            const { error } = await supabase.from('extracted_prompts').insert({
              user_id: userId,
              prompt_title: post.title,
              prompt_content: cleanContent(post.content).substring(0, 5000),
              suggested_category: 'reddit',
              quality_score: 7.0,
              language: 'en',
              source_type: 'reddit',
              source_url: post.url,
              source_name: `r/${post.subreddit}`,
              source_author: post.author,
              content_hash: contentHash
            });
            
            if (!error) {
              saved++;
              console.log(`[QuickCrawl] Saved: ${post.title}`);
            } else {
              console.error('[QuickCrawl] Insert error:', error);
            }
          } else {
            console.log(`[QuickCrawl] Already exists: ${post.title}`);
          }
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[QuickCrawl] Completed: found=${found}, saved=${saved}, duration=${duration}s`);
    
    const resultCard = {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: '✅ 采集完成' }, template: 'green' },
      elements: [
        { tag: 'div', fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**📊 发现${isGitHub ? '仓库' : '帖子'}**\n${found} 个` } },
          { is_short: true, text: { tag: 'lark_md', content: `**💾 新增保存**\n${saved} 个` } },
        ] },
        { tag: 'hr' },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `⏱️ 耗时 ${duration} 秒 | 已保存到「提示词采集」页面` }] },
      ],
    };
    
    await sendCardMessage(openId, resultCard);
    
  } catch (error: any) {
    console.error('[QuickCrawl] Error:', error);
    await sendTextMessage(openId, `❌ 采集出错: ${error.message}\n\n已保存 ${saved} 个。`);
  }
}

// ============ 消息处理 ============
async function handleMessage(event: any): Promise<void> {
  const { message, sender } = event;
  const openId = sender.sender_id.open_id;
  const messageId = message.message_id;
  const msgType = message.message_type;
  const content = message.content;

  console.log('[MSG] === New message ===');
  console.log('[MSG] messageId:', messageId);
  console.log('[MSG] msgType:', msgType);
  console.log('[MSG] openId:', openId);

  // 消息去重 - 防止飞书重复发送事件
  const isDuplicate = await isMessageProcessed(messageId);
  if (isDuplicate) {
    console.log('[MSG] Duplicate ignored:', messageId);
    return;
  }

  const parsed = parseMessageContent(msgType, content);
  console.log('[MSG] Parsed type:', parsed.type, 'content:', parsed.content?.slice(0, 100));
  
  const userId = await getBoundUserId(openId);
  console.log('[MSG] Bound userId:', userId);

  if (parsed.type === 'text' && parsed.content) {
    const text = parsed.content.trim();
    console.log('[MSG] Processing text:', text);
    
    if (text.startsWith('/bind ')) {
      const code = text.replace(/^\/bind /, '').trim();
      const result = await handleBindCommand(openId, code);
      await sendTextMessage(openId, result);
      return;
    }

    if (!userId) {
      await sendTextMessage(openId, '👋 你好！我是 Lumina 资源助手。\n\n请先在 Lumina 设置页面获取绑定码，然后发送：\n`/bind 绑定码`');
      return;
    }

    const cmd = parseCommand(text);
    console.log('[MSG] Command:', cmd);
    
    if (cmd) {
      switch (cmd.command) {
        case 'help': await sendCardMessage(openId, generateHelpCard()); return;
        case 'debug': {
          console.log('[MSG] Debug command');
          const resources = await getResourcesPage(userId, 0, 10);
          const { count } = await supabase
            .from('resources')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null);
          
          const debugInfo = `🔧 调试信息\n\n` +
            `用户ID: ${userId}\n` +
            `飞书OpenID: ${openId}\n` +
            `资源总数: ${count || 0}\n` +
            `AI_API_KEY: ${AI_API_KEY ? '已配置(' + AI_API_KEY.slice(0, 8) + '...)' : '❌ 未配置'}\n` +
            `AI_BASE_URL: ${AI_BASE_URL}\n` +
            `AI_MODEL: ${AI_MODEL}\n\n` +
            `最近资源:\n${resources.map(r => `- [${r.type}] ${r.title}`).join('\n') || '无'}`;
          
          await sendTextMessage(openId, debugInfo);
          return;
        }
        case 'list': {
          const args = cmd.args.split(/\s+/).filter(Boolean);
          let typeFilter = 'all', days = 7;
          const typeMap: Record<string, string> = { 'link': 'link', 'github': 'github', 'document': 'document', 'image': 'image' };
          for (const arg of args) {
            if (typeMap[arg.toLowerCase()]) typeFilter = typeMap[arg.toLowerCase()];
            else if (!isNaN(parseInt(arg))) days = parseInt(arg);
          }
          await handleListCommand(userId, openId, typeFilter, days);
          return;
        }
        case 'search': {
          const result = await handleSearchCommand(userId, cmd.args);
          if (typeof result === 'string') await sendTextMessage(openId, result);
          else await sendCardMessage(openId, result);
          return;
        }
        case 'stats': await sendCardMessage(openId, await handleStatsCommand(userId)); return;
        case 'unbind': await sendTextMessage(openId, await handleUnbindCommand(openId)); return;
        case 'github': {
          // 解析用户指定的关键词
          const keywords = cmd.args.split(/[\s,，]+/).filter(k => k.trim());
          if (keywords.length === 0) {
            await sendTextMessage(openId, '❓ 请指定搜索关键词（最多 3 个）\n\n示例：\n• `/github prompt-engineering`\n• `/github cursor-rules awesome-prompts`\n• `/github comfyui, stable-diffusion`');
            return;
          }
          await executeQuickCrawl('github', userId, openId, keywords);
          return;
        }
        case 'reddit': {
          // 解析用户指定的版块名
          const subreddits = cmd.args.split(/[\s,，]+/).filter(k => k.trim());
          if (subreddits.length === 0) {
            await sendTextMessage(openId, '❓ 请指定 Reddit 版块名（最多 3 个）\n\n示例：\n• `/reddit ChatGPT`\n• `/reddit cursor vibecoding`\n• `/reddit PromptEngineering, comfyui`');
            return;
          }
          await executeQuickCrawl('reddit', userId, openId, subreddits);
          return;
        }
        case 'crawl': {
          await sendTextMessage(openId, '❓ 请使用具体的采集指令：\n\n• `/github 关键词1 关键词2` - 采集 GitHub\n• `/reddit 版块1 版块2` - 采集 Reddit\n\n示例：\n• `/github prompt-engineering cursor-rules`\n• `/reddit ChatGPT PromptEngineering`');
          return;
        }
      }
    }

    // 检查是否包含 URL - 如果是链接则添加资源
    const url = extractUrl(text);
    if (url) {
      console.log('[MSG] URL detected:', url);
      try {
        const result = await addLinkResource(userId, url);
        await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
      } catch (e) {
        console.error('[MSG] Add link error:', e);
        await sendTextMessage(openId, '❌ 添加链接失败');
      }
      return;
    }

    // 没有匹配到指令，也不是链接，发送给 AI 搜索
    console.log('[MSG] >>> Triggering AI search for:', text);
    try {
      const aiResult = await handleAISearch(userId, text);
      console.log('[MSG] AI search completed, result type:', typeof aiResult);
      if (typeof aiResult === 'string') {
        await sendTextMessage(openId, aiResult);
      } else {
        await sendCardMessage(openId, aiResult);
      }
    } catch (e) {
      console.error('[MSG] AI search error:', e);
      await sendTextMessage(openId, '❌ AI 搜索出错，请稍后重试');
    }
    return;
  }

  if (!userId) {
    await sendTextMessage(openId, '❌ 请先绑定账号 /bind');
    return;
  }

  if (parsed.type === 'image' && parsed.fileKey) {
    try {
      const blob = await downloadFeishuImage(messageId, parsed.fileKey);
      const result = await uploadFileResource(userId, blob, `feishu_${Date.now()}.png`, true);
      await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
    } catch {
      await sendTextMessage(openId, '❌ 上传图片失败');
    }
    return;
  }

  if (parsed.type === 'file' && parsed.fileKey && parsed.fileName) {
    try {
      const blob = await downloadFeishuFile(messageId, parsed.fileKey);
      const result = await uploadFileResource(userId, blob, parsed.fileName, false);
      await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
    } catch {
      await sendTextMessage(openId, '❌ 上传文件失败');
    }
    return;
  }

  await sendTextMessage(openId, '❓ 暂不支持此类型的消息');
}

// ============ 主入口 ============
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.header?.token !== FEISHU_VERIFICATION_TOKEN) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.header?.event_type === 'im.message.receive_v1') {
      handleMessage(body.event).catch(console.error);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
