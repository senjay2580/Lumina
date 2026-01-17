// 习惯纠正站 - 定时提醒任务
// 每分钟执行一次，检查是否有需要发送的提醒
// 使用内存缓存防止重复发送

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') || '';
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') || '';

interface HabitSchedule {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  reminder_times: string[];
  days_of_week: number[];
  is_active: boolean;
}

interface FeishuBinding {
  feishu_open_id: string;
}

interface SendResult {
  schedule_id: string;
  title: string;
  success: boolean;
  error?: string;
}

// 内存缓存：记录今天已发送的提醒（格式：schedule_id:YYYY-MM-DD:HH:MM）
const sentToday = new Set<string>();

// 每天凌晨清空缓存
let lastClearDate = new Date().toDateString();

// 飞书 token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

// 获取飞书 tenant_access_token
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

// 发送飞书卡片消息
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
    throw new Error(`发送卡片消息失败: ${data.msg}`);
  }
}

// 生成提醒卡片
function generateReminderCard(schedule: HabitSchedule, currentTime: string): object {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '⏰ 习惯提醒' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${schedule.title}**\n现在是 ${currentTime}，该开始了！`,
        },
      },
      ...(schedule.description ? [{
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: schedule.description,
        },
      }] : []),
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: '来自 Lumina 习惯纠正站' },
        ],
      },
    ],
  };
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 获取当前时间（转换为中国时区 UTC+8）
    const now = new Date();
    const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // UTC+8
    const currentDay = chinaTime.getUTCDay() || 7; // 转换为 1-7 (周一到周日)
    const currentTime = chinaTime.toISOString().slice(11, 16); // HH:MM
    const currentDate = chinaTime.toISOString().slice(0, 10); // YYYY-MM-DD
    
    // 检查是否需要清空缓存
    if (currentDate !== lastClearDate) {
      sentToday.clear();
      lastClearDate = currentDate;
      console.log('[Habit Reminder] Cache cleared for new day');
    }
    
    console.log(`[Habit Reminder] China Time: ${chinaTime.toISOString()}`);
    console.log(`[Habit Reminder] Checking at ${currentTime}, day ${currentDay}`);
    
    // 获取所有活跃的计划
    const { data: schedules, error: schedulesError } = await supabase
      .from('habit_schedules')
      .select('*')
      .eq('is_active', true);
    
    if (schedulesError) {
      console.error('Failed to fetch schedules:', schedulesError);
      return new Response(JSON.stringify({ error: schedulesError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!schedules || schedules.length === 0) {
      console.log('[Habit Reminder] No active schedules found');
      return new Response(JSON.stringify({ message: 'No active schedules' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[Habit Reminder] Found ${schedules.length} active schedules`);
    
    const results: SendResult[] = [];
    
    for (const schedule of schedules as HabitSchedule[]) {
      // 检查是否是今天要执行的日期
      if (!schedule.days_of_week.includes(currentDay)) {
        continue;
      }
      
      // 检查当前时间是否在提醒时间列表中
      // 支持两种格式：HH:MM 和 HH:MM:SS
      const isTimeMatch = schedule.reminder_times.some(time => {
        // 将时间转换为字符串并截取前5位
        const timeStr = String(time);
        const normalizedTime = timeStr.length > 5 ? timeStr.slice(0, 5) : timeStr;
        return normalizedTime === currentTime;
      });
      
      if (!isTimeMatch) {
        continue;
      }
      
      console.log(`[Habit Reminder] Time matched for schedule: ${schedule.title}, time: ${currentTime}`);
      
      // 检查今天这个时间点是否已经发送过（使用内存缓存）
      const cacheKey = `${schedule.id}:${currentDate}:${currentTime}`;
      if (sentToday.has(cacheKey)) {
        console.log(`[Habit Reminder] Already sent for schedule: ${schedule.title} at ${currentTime}`);
        continue;
      }
      
      console.log(`[Habit Reminder] Sending reminder for schedule: ${schedule.title}`);
      
      // 获取用户的飞书绑定
      const { data: binding, error: bindingError } = await supabase
        .from('feishu_user_bindings')
        .select('feishu_open_id')
        .eq('user_id', schedule.user_id)
        .single();
      
      if (bindingError || !binding) {
        console.error(`[Habit Reminder] No Feishu binding for user: ${schedule.user_id}`);
        
        results.push({
          schedule_id: schedule.id,
          title: schedule.title,
          success: false,
          error: 'No Feishu binding'
        });
        continue;
      }
      
      try {
        // 发送卡片消息
        const card = generateReminderCard(schedule, currentTime);
        await sendCardMessage((binding as FeishuBinding).feishu_open_id, card);
        
        // 标记为已发送
        sentToday.add(cacheKey);
        
        results.push({
          schedule_id: schedule.id,
          title: schedule.title,
          success: true
        });
        
        console.log(`[Habit Reminder] Successfully sent reminder for: ${schedule.title}`);
      } catch (error) {
        console.error(`[Habit Reminder] Failed to send reminder:`, error);
        
        results.push({
          schedule_id: schedule.id,
          title: schedule.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return new Response(JSON.stringify({
      message: 'Habit reminders processed',
      processed: results.length,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Habit Reminder] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
