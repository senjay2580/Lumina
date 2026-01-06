// 飞书绑定相关 API
import { supabase } from './supabase';

// 绑定状态
export interface FeishuBindingStatus {
  bound: boolean;
  feishu_name?: string;
  feishu_avatar?: string;
  bound_at?: string;
}

// 绑定码
export interface FeishuBindCode {
  code: string;
  expires_at: string;
  expires_in: number;
}

// 生成 6 位随机绑定码
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 获取绑定状态（直接从数据库）
export async function getFeishuBindingFromDB(userId: string): Promise<FeishuBindingStatus> {
  const { data, error } = await supabase
    .from('feishu_user_bindings')
    .select('feishu_name, feishu_avatar, bound_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取飞书绑定状态失败:', error);
    // 表不存在时返回未绑定状态
    return { bound: false };
  }

  return {
    bound: !!data,
    feishu_name: data?.feishu_name,
    feishu_avatar: data?.feishu_avatar,
    bound_at: data?.bound_at,
  };
}

// 生成绑定码（直接操作数据库）
export async function generateFeishuBindCode(userId: string): Promise<FeishuBindCode> {
  // 检查是否已绑定
  const { data: existingBinding } = await supabase
    .from('feishu_user_bindings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingBinding) {
    throw new Error('已绑定飞书账号，请先解绑');
  }

  // 删除该用户之前未使用的绑定码
  await supabase
    .from('feishu_bind_codes')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);

  // 生成新绑定码
  const code = generateCode();
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
    throw new Error('生成绑定码失败');
  }

  return {
    code,
    expires_at: expiresAt.toISOString(),
    expires_in: 300,
  };
}

// 解除绑定（直接操作数据库）
export async function unbindFeishu(userId: string): Promise<void> {
  const { error } = await supabase
    .from('feishu_user_bindings')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('解绑失败:', error);
    throw new Error('解绑失败');
  }
}
