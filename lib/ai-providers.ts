import { supabase } from './supabase';

// 类型定义
export interface AIProviderTemplate {
  id: string;
  providerKey: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  color: string;
  sortOrder: number;
}

export interface AIProvider {
  id: string;
  userId: string;
  providerKey: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  isEnabled: boolean;
}

// 获取 AI 提供商模板（系统预设）
export async function getProviderTemplates(): Promise<AIProviderTemplate[]> {
  const { data, error } = await supabase
    .from('ai_provider_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取提供商模板失败:', error);
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    providerKey: r.provider_key,
    name: r.name,
    baseUrl: r.base_url || '',
    models: r.models || [],
    color: r.color || 'gray',
    sortOrder: r.sort_order || 0,
  }));
}

// 获取用户的 AI 提供商配置
export async function getUserProviders(userId: string): Promise<AIProvider[]> {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('获取用户提供商配置失败:', error);
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    userId: r.user_id,
    providerKey: r.provider_key,
    name: r.name,
    apiKey: r.api_key || '',
    baseUrl: r.base_url || '',
    models: r.models || [],
    isEnabled: r.is_enabled || false,
  }));
}

// 检查用户是否有已启用的 AI 提供商
export async function hasEnabledProvider(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('id')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .limit(1);

  if (error) return false;
  return (data?.length || 0) > 0;
}

// 保存用户的 AI 提供商配置
export async function saveUserProvider(
  userId: string,
  providerKey: string,
  config: { name: string; apiKey: string; baseUrl?: string; models?: any[] }
): Promise<AIProvider | null> {
  const { data, error } = await supabase
    .from('ai_providers')
    .upsert({
      user_id: userId,
      provider_key: providerKey,
      name: config.name,
      api_key: config.apiKey,
      base_url: config.baseUrl || '',
      models: config.models || [],
      is_enabled: !!config.apiKey,
    }, {
      onConflict: 'user_id,provider_key'
    })
    .select()
    .single();

  if (error) {
    console.error('保存提供商配置失败:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    providerKey: data.provider_key,
    name: data.name,
    apiKey: data.api_key || '',
    baseUrl: data.base_url || '',
    models: data.models || [],
    isEnabled: data.is_enabled || false,
  };
}

// 删除用户的 AI 提供商配置
export async function deleteUserProvider(providerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_providers')
    .delete()
    .eq('id', providerId);

  return !error;
}
