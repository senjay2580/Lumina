// 飞书 Webhook 处理函数
// 接收飞书消息并处理资源添加

// @ts-ignore - Deno types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  sendTextMessage,
  sendCardMessage,
  downloadFeishuFile,
  downloadFeishuImage,
  getFeishuUserInfo,
  parseMessageContent,
  extractUrl,
  parseCommand,
  generateHelpCard,
  generateResourceAddedCard,
} from '../_shared/feishu.ts'

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FEISHU_VERIFICATION_TOKEN = Deno.env.get('FEISHU_VERIFICATION_TOKEN') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 获取绑定的用户 ID
async function getBoundUserId(openId: string): Promise<string | null> {
  const { data } = await supabase
    .from('feishu_user_bindings')
    .select('user_id')
    .eq('feishu_open_id', openId)
    .single();
  
  return data?.user_id || null;
}

// 处理绑定指令
async function handleBindCommand(openId: string, code: string): Promise<string> {
  // 查找绑定码
  const { data: bindCode } = await supabase
    .from('feishu_bind_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!bindCode) {
    return '❌ 绑定码无效或已过期，请重新获取';
  }

  // 检查是否已绑定其他账号
  const { data: existingBinding } = await supabase
    .from('feishu_user_bindings')
    .select('id')
    .eq('feishu_open_id', openId)
    .single();

  if (existingBinding) {
    return '❌ 此飞书账号已绑定其他用户，请先解绑';
  }

  // 获取飞书用户信息
  const userInfo = await getFeishuUserInfo(openId);

  // 创建绑定
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

  if (bindError) {
    console.error('绑定失败:', bindError);
    return '❌ 绑定失败，请稍后重试';
  }

  // 标记绑定码已使用
  await supabase
    .from('feishu_bind_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', bindCode.id);

  return `✅ 绑定成功！\n\n你好 ${userInfo.name}，现在可以直接发送链接、图片或文件来添加资源了。\n\n发送「帮助」查看更多指令。`;
}

// 处理解绑指令
async function handleUnbindCommand(openId: string): Promise<string> {
  const { error } = await supabase
    .from('feishu_user_bindings')
    .delete()
    .eq('feishu_open_id', openId);

  if (error) {
    console.error('解绑失败:', error);
    return '❌ 解绑失败，请稍后重试';
  }

  return '✅ 已解除绑定\n\n如需重新使用，请在 Lumina 设置页面获取新的绑定码。';
}

// 添加链接资源
async function addLinkResource(userId: string, url: string): Promise<{ title: string; type: string }> {
  // 检测是否是 GitHub 链接
  const isGitHub = url.includes('github.com');
  const type = isGitHub ? 'github' : 'link';
  
  let title: string;
  let metadata: Record<string, any> = {};
  let description: string | undefined;

  if (isGitHub) {
    // 解析 GitHub URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      const [, owner, repo] = match;
      title = `${owner}/${repo}`;
      
      // 获取 GitHub 仓库信息
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (response.ok) {
          const data = await response.json();
          metadata = {
            owner: data.owner.login,
            repo: data.name,
            stars: data.stargazers_count,
            forks: data.forks_count,
            language: data.language,
            topics: data.topics || [],
          };
          description = data.description;
        }
      } catch (err) {
        console.error('获取 GitHub 信息失败:', err);
      }
    } else {
      title = new URL(url).host + new URL(url).pathname;
    }
  } else {
    // 普通链接：使用 host + pathname 作为标题
    const parsed = new URL(url);
    title = parsed.host + parsed.pathname.replace(/\/$/, '');
  }

  // 插入数据库
  const { error } = await supabase
    .from('resources')
    .insert({
      user_id: userId,
      type,
      title,
      description,
      url,
      metadata,
    });

  if (error) throw error;
  return { title, type };
}

// 上传文件资源
async function uploadFileResource(
  userId: string,
  blob: Blob,
  fileName: string,
  isImage: boolean
): Promise<{ title: string; type: string }> {
  const resourceId = crypto.randomUUID();
  const ext = fileName.split('.').pop() || (isImage ? 'png' : 'bin');
  const storagePath = `${userId}/${resourceId}.${ext}`;
  const type = isImage ? 'image' : 'document';

  // 上传到 Storage
  const { error: uploadError } = await supabase.storage
    .from('resources')
    .upload(storagePath, blob, {
      contentType: isImage ? `image/${ext}` : 'application/octet-stream',
    });

  if (uploadError) throw uploadError;

  // 插入数据库
  const { error } = await supabase
    .from('resources')
    .insert({
      id: resourceId,
      user_id: userId,
      type,
      title: fileName,
      storage_path: storagePath,
      file_name: fileName,
      metadata: {},
    });

  if (error) {
    // 回滚：删除已上传的文件
    await supabase.storage.from('resources').remove([storagePath]);
    throw error;
  }

  return { title: fileName, type };
}

// 处理列表指令 - 返回多张卡片（每张最多 15 条）
async function handleListCommand(userId: string, openId: string, typeFilter?: string, days?: number): Promise<void> {
  const actualDays = days || 7;
  const since = new Date(Date.now() - actualDays * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('resources')
    .select('title, type, url, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  // 按类型筛选
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
    article: '文章',
  };

  const typeEmoji: Record<string, string> = {
    link: '🔗',
    github: '📦',
    document: '📄',
    image: '🖼️',
    article: '📰',
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
    batch.forEach((r, i) => {
      const emoji = typeEmoji[r.type] || '📎';
      const date = new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      
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

// 处理搜索指令 - 返回交互式卡片
async function handleSearchCommand(userId: string, keyword: string, typeFilter?: string): Promise<object | string> {
  if (!keyword) {
    return '❌ 请输入搜索关键词，如：搜索 GitHub';
  }

  let query = supabase
    .from('resources')
    .select('title, type, url, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('title', `%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(50);  // 提高上限到 50 条

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

  const elements: any[] = [];

  // 分类筛选按钮
  elements.push({
    tag: 'action',
    actions: [
      { tag: 'button', text: { tag: 'plain_text', content: '全部' }, type: typeFilter === 'all' || !typeFilter ? 'primary' : 'default', value: { action: 'search', keyword, type: 'all' } },
      { tag: 'button', text: { tag: 'plain_text', content: '🔗 链接' }, type: typeFilter === 'link' ? 'primary' : 'default', value: { action: 'search', keyword, type: 'link' } },
      { tag: 'button', text: { tag: 'plain_text', content: '📦 GitHub' }, type: typeFilter === 'github' ? 'primary' : 'default', value: { action: 'search', keyword, type: 'github' } },
      { tag: 'button', text: { tag: 'plain_text', content: '📄 文档' }, type: typeFilter === 'document' ? 'primary' : 'default', value: { action: 'search', keyword, type: 'document' } },
      { tag: 'button', text: { tag: 'plain_text', content: '🖼️ 图片' }, type: typeFilter === 'image' ? 'primary' : 'default', value: { action: 'search', keyword, type: 'image' } },
    ],
  });

  elements.push({ tag: 'hr' });

  if (error || !data || data.length === 0) {
    elements.push({
      tag: 'div',
      text: { tag: 'plain_text', content: `🔍 未找到包含「${keyword}」的${typeFilter && typeFilter !== 'all' ? typeLabels[typeFilter] : ''}资源` },
    });
  } else {
    // 搜索结果
    data.forEach((r, i) => {
      const emoji = typeEmoji[r.type] || '📎';
      const date = new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      
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
      
      if (i < data.length - 1) {
        elements.push({ tag: 'hr' });
      }
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🔍 搜索「${keyword}」` },
      template: 'blue',
    },
    elements,
  };
}

// 处理统计指令 - 返回交互式卡片
async function handleStatsCommand(userId: string): Promise<object> {
  const { data, error } = await supabase
    .from('resources')
    .select('type, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null);

  const stats = {
    total: data?.length || 0,
    link: data?.filter(r => r.type === 'link').length || 0,
    github: data?.filter(r => r.type === 'github').length || 0,
    document: data?.filter(r => r.type === 'document').length || 0,
    image: data?.filter(r => r.type === 'image').length || 0,
  };

  // 计算最近 7 天新增
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentCount = data?.filter(r => r.created_at >= weekAgo).length || 0;

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '📊 资源统计' },
      template: 'purple',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**📚 总计**\n${stats.total} 条` } },
          { is_short: true, text: { tag: 'lark_md', content: `**📈 本周新增**\n${recentCount} 条` } },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**🔗 链接**\n${stats.link} 条` } },
          { is_short: true, text: { tag: 'lark_md', content: `**📦 GitHub**\n${stats.github} 条` } },
        ],
      },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**📄 文档**\n${stats.document} 条` } },
          { is_short: true, text: { tag: 'lark_md', content: `**🖼️ 图片**\n${stats.image} 条` } },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          { tag: 'button', text: { tag: 'plain_text', content: '查看全部资源' }, type: 'primary', value: { action: 'list', type: 'all', days: 30 } },
        ],
      },
    ],
  };
}

// 处理消息
async function handleMessage(event: any): Promise<void> {
  const { message, sender } = event;
  const openId = sender.sender_id.open_id;
  const messageId = message.message_id;
  const msgType = message.message_type;
  const content = message.content;

  // 解析消息
  const parsed = parseMessageContent(msgType, content);

  // 检查是否已绑定
  const userId = await getBoundUserId(openId);

  // 处理文本消息
  if (parsed.type === 'text' && parsed.content) {
    const text = parsed.content.trim();
    
    // 检查是否是绑定指令
    if (text.startsWith('/bind ') || text.startsWith('绑定 ')) {
      const code = text.replace(/^(\/bind |绑定 )/, '').trim();
      const result = await handleBindCommand(openId, code);
      await sendTextMessage(openId, result);
      return;
    }

    // 未绑定用户只能执行绑定
    if (!userId) {
      await sendTextMessage(openId, 
        '👋 你好！我是 Lumina 资源助手。\n\n' +
        '请先在 Lumina 设置页面获取绑定码，然后发送：\n' +
        '`/bind 绑定码` 或 `绑定 绑定码`\n\n' +
        '完成绑定后即可使用所有功能。'
      );
      return;
    }

    // 检查是否是指令
    const cmd = parseCommand(text);
    if (cmd) {
      switch (cmd.command) {
        case 'help':
          await sendCardMessage(openId, generateHelpCard());
          return;
        case 'list': {
          // 解析参数：列表 [类型] [天数] 或 列表 [天数]
          const args = cmd.args.split(/\s+/).filter(Boolean);
          let typeFilter = 'all';
          let days = 7;
          
          const typeMap: Record<string, string> = {
            '链接': 'link', 'link': 'link',
            'github': 'github', 'GitHub': 'github',
            '文档': 'document', 'document': 'document',
            '图片': 'image', 'image': 'image',
            '全部': 'all', 'all': 'all',
          };
          
          for (const arg of args) {
            if (typeMap[arg]) {
              typeFilter = typeMap[arg];
            } else if (!isNaN(parseInt(arg))) {
              days = parseInt(arg);
            }
          }
          
          await handleListCommand(userId, openId, typeFilter, days);
          return;
        }
        case 'search': {
          // 解析参数：搜索 关键词 [类型]
          const args = cmd.args.split(/\s+/).filter(Boolean);
          const typeMap: Record<string, string> = {
            '链接': 'link', 'link': 'link',
            'github': 'github', 'GitHub': 'github',
            '文档': 'document', 'document': 'document',
            '图片': 'image', 'image': 'image',
          };
          
          let keyword = '';
          let typeFilter = 'all';
          
          for (const arg of args) {
            if (typeMap[arg]) {
              typeFilter = typeMap[arg];
            } else {
              keyword = keyword ? `${keyword} ${arg}` : arg;
            }
          }
          
          const searchResult = await handleSearchCommand(userId, keyword, typeFilter);
          if (typeof searchResult === 'string') {
            await sendTextMessage(openId, searchResult);
          } else {
            await sendCardMessage(openId, searchResult);
          }
          return;
        }
        case 'stats': {
          const statsCard = await handleStatsCommand(userId);
          await sendCardMessage(openId, statsCard);
          return;
        }
        case 'unbind': {
          const response = await handleUnbindCommand(openId);
          await sendTextMessage(openId, response);
          return;
        }
        default:
          await sendTextMessage(openId, '❓ 未知指令，发送「帮助」查看可用指令');
          return;
      }
    }

    // 检查是否包含 URL
    const url = extractUrl(text);
    if (url) {
      try {
        const result = await addLinkResource(userId, url);
        await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
      } catch (err) {
        console.error('添加链接失败:', err);
        await sendTextMessage(openId, '❌ 添加链接失败，请稍后重试');
      }
      return;
    }

    // 普通文本，提示用户
    await sendTextMessage(openId, '💡 发送链接、图片或文件即可添加资源\n发送「帮助」查看更多指令');
    return;
  }

  // 未绑定用户不能上传文件
  if (!userId) {
    await sendTextMessage(openId, '❌ 请先绑定账号后再上传文件');
    return;
  }

  // 处理图片
  if (parsed.type === 'image' && parsed.fileKey) {
    try {
      const blob = await downloadFeishuImage(messageId, parsed.fileKey);
      const fileName = `feishu_${Date.now()}.png`;
      const result = await uploadFileResource(userId, blob, fileName, true);
      await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
    } catch (err) {
      console.error('上传图片失败:', err);
      await sendTextMessage(openId, '❌ 上传图片失败，请稍后重试');
    }
    return;
  }

  // 处理文件
  if (parsed.type === 'file' && parsed.fileKey && parsed.fileName) {
    try {
      const blob = await downloadFeishuFile(messageId, parsed.fileKey);
      const result = await uploadFileResource(userId, blob, parsed.fileName, false);
      await sendCardMessage(openId, generateResourceAddedCard(result.title, result.type));
    } catch (err) {
      console.error('上传文件失败:', err);
      await sendTextMessage(openId, '❌ 上传文件失败，请稍后重试');
    }
    return;
  }

  // 不支持的消息类型
  await sendTextMessage(openId, '❓ 暂不支持此类型的消息');
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // URL 验证（飞书配置 webhook 时会发送）
    if (body.type === 'url_verification') {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 验证 token
    if (body.header?.token !== FEISHU_VERIFICATION_TOKEN) {
      console.error('Token 验证失败');
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 处理消息事件
    if (body.header?.event_type === 'im.message.receive_v1') {
      // 异步处理消息，立即返回成功
      handleMessage(body.event).catch(err => {
        console.error('处理消息失败:', err);
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Webhook 处理错误:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
