// 飞书绑定码生成函数
// 为用户生成一次性绑定码

// @ts-ignore - Deno types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 生成 6 位随机绑定码
function generateBindCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 获取用户 ID（从请求体或查询参数）
    let userId: string | null = null;

    if (req.method === 'POST') {
      const body = await req.json();
      userId = body.user_id;
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id');
    } else if (req.method === 'DELETE') {
      // 解绑操作
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id');
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 删除绑定
      const { error } = await supabase
        .from('feishu_user_bindings')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('解绑失败:', error);
        return new Response(
          JSON.stringify({ error: '解绑失败' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET 请求：获取绑定状态
    if (req.method === 'GET') {
      const { data: binding } = await supabase
        .from('feishu_user_bindings')
        .select('feishu_name, feishu_avatar, bound_at')
        .eq('user_id', userId)
        .single();

      return new Response(
        JSON.stringify({
          bound: !!binding,
          feishu_name: binding?.feishu_name,
          feishu_avatar: binding?.feishu_avatar,
          bound_at: binding?.bound_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST 请求：生成绑定码
    // 检查是否已绑定
    const { data: existingBinding } = await supabase
      .from('feishu_user_bindings')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingBinding) {
      return new Response(
        JSON.stringify({ error: '已绑定飞书账号，请先解绑' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 删除该用户之前未使用的绑定码
    await supabase
      .from('feishu_bind_codes')
      .delete()
      .eq('user_id', userId)
      .is('used_at', null);

    // 生成新绑定码
    const code = generateBindCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟后过期

    const { error } = await supabase
      .from('feishu_bind_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      console.error('生成绑定码失败:', error);
      return new Response(
        JSON.stringify({ error: '生成绑定码失败' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        code,
        expires_at: expiresAt.toISOString(),
        expires_in: 300, // 秒
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('处理请求失败:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
