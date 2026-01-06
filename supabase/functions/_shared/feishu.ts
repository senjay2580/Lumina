// 飞书 API 封装
// 用于 Edge Functions 中调用飞书开放平台 API

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') || '';
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') || '';

// 缓存 tenant_access_token
let cachedToken: { token: string; expiresAt: number } | null = null;

// 获取 tenant_access_token
export async function getTenantAccessToken(): Promise<string> {
  // 检查缓存
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

  // 缓存 token，提前 5 分钟过期
  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000,
  };

  return data.tenant_access_token;
}

// 发送文本消息
export async function sendTextMessage(openId: string, text: string): Promise<void> {
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
    throw new Error(`发送消息失败: ${data.msg}`);
  }
}

// 发送卡片消息
export async function sendCardMessage(openId: string, card: object): Promise<void> {
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
    throw new Error(`发送卡片消息失败: ${data.msg}`);
  }
}

// 下载飞书文件
export async function downloadFeishuFile(messageId: string, fileKey: string): Promise<Blob> {
  const token = await getTenantAccessToken();
  
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${fileKey}?type=file`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`下载文件失败: ${response.status}`);
  }

  return response.blob();
}

// 下载飞书图片
export async function downloadFeishuImage(messageId: string, imageKey: string): Promise<Blob> {
  const token = await getTenantAccessToken();
  
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }

  return response.blob();
}

// 获取用户信息
export async function getFeishuUserInfo(openId: string): Promise<{
  name: string;
  avatar: string;
  userId?: string;
  unionId?: string;
}> {
  const token = await getTenantAccessToken();
  
  const response = await fetch(
    `https://open.feishu.cn/open-apis/contact/v3/users/${openId}?user_id_type=open_id`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (data.code !== 0) {
    console.error('获取用户信息失败:', data);
    return { name: '飞书用户', avatar: '' };
  }

  return {
    name: data.data.user.name,
    avatar: data.data.user.avatar?.avatar_origin || '',
    userId: data.data.user.user_id,
    unionId: data.data.user.union_id,
  };
}

// 解析消息内容
export interface ParsedMessage {
  type: 'text' | 'image' | 'file' | 'unknown';
  content?: string;
  url?: string;
  fileKey?: string;
  fileName?: string;
}

export function parseMessageContent(msgType: string, content: string): ParsedMessage {
  try {
    const parsed = JSON.parse(content);
    
    switch (msgType) {
      case 'text':
        return { type: 'text', content: parsed.text };
      case 'image':
        return { type: 'image', fileKey: parsed.image_key };
      case 'file':
        return { type: 'file', fileKey: parsed.file_key, fileName: parsed.file_name };
      default:
        return { type: 'unknown' };
    }
  } catch {
    return { type: 'unknown' };
  }
}

// 检测文本中的 URL
export function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

// 检测是否是指令
export function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = text.trim();
  
  // 支持 /command 和中文指令
  const commandMap: Record<string, string> = {
    '帮助': 'help',
    '列表': 'list',
    '搜索': 'search',
    '统计': 'stats',
    '解绑': 'unbind',
  };
  
  // 检查中文指令
  for (const [cn, en] of Object.entries(commandMap)) {
    if (trimmed.startsWith(cn)) {
      return { command: en, args: trimmed.slice(cn.length).trim() };
    }
  }
  
  // 检查 /command 格式
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    return { command: parts[0].toLowerCase(), args: parts.slice(1).join(' ') };
  }
  
  return null;
}

// 生成帮助消息卡片
export function generateHelpCard(): object {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '📚 Lumina 资源助手' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**直接发送内容即可添加资源：**\n• 发送链接 → 自动识别并保存\n• 发送图片 → 自动上传保存\n• 发送文件 → 自动上传保存',
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**查询指令：**\n• `列表` - 查看最近资源\n• `列表 链接` - 只看链接类型\n• `列表 30` - 查看最近 30 天\n• `列表 GitHub 7` - GitHub 类型最近 7 天\n• `搜索 关键词` - 搜索资源\n• `搜索 关键词 文档` - 在文档中搜索',
        },
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**其他指令：**\n• `统计` - 查看资源统计\n• `解绑` - 解除账号绑定\n• `帮助` - 显示此帮助',
        },
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: '支持的类型：链接、GitHub、文档、图片' },
        ],
      },
    ],
  };
}

// 生成成功添加资源的卡片
export function generateResourceAddedCard(title: string, type: string): object {
  const typeLabels: Record<string, string> = {
    link: '🔗 链接',
    github: '📦 GitHub',
    document: '📄 文档',
    image: '🖼️ 图片',
  };

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '✅ 资源已添加' },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**类型**\n${typeLabels[type] || type}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**标题**\n${title}` } },
        ],
      },
    ],
  };
}
