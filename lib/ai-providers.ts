import { supabase } from './supabase';
import { getCached, setCache, invalidateCache, CACHE_KEYS } from './cache';

// 类型定义
export interface AIProviderTemplate {
  id: string;
  providerKey: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  color: string;
  sortOrder: number;
  iconSvg?: string; // 图标 SVG 或 URL
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
  isDefault: boolean;
  defaultModel?: string; // 用户选择的默认模型
  color?: string;
}

// 简单的加密/解密函数（用于前端存储）
// 注意：这不是真正的安全加密，只是混淆。真正的安全需要后端处理
const ENCRYPTION_KEY = 'lumina-ai-key-v1';

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  try {
    // 简单的 Base64 + 反转混淆
    const encoded = btoa(apiKey);
    return encoded.split('').reverse().join('') + ':v1';
  } catch {
    return apiKey;
  }
}

export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return '';
  try {
    if (encrypted.endsWith(':v1')) {
      const encoded = encrypted.slice(0, -3).split('').reverse().join('');
      return atob(encoded);
    }
    return encrypted;
  } catch {
    return encrypted;
  }
}

// 检查是否是加密的 API Key
export function isEncryptedApiKey(apiKey: string): boolean {
  return apiKey?.endsWith(':v1') || false;
}

// 获取 AI 提供商模板（系统预设）- 带 localStorage 缓存
export async function getProviderTemplates(forceRefresh = false): Promise<AIProviderTemplate[]> {
  // 检查缓存（使用全局用户标识）
  if (!forceRefresh) {
    const cached = getCached<AIProviderTemplate[]>(CACHE_KEYS.PROVIDER_TEMPLATES, 'global', 10 * 60 * 1000);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('ai_provider_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取提供商模板失败:', error);
    // 尝试返回过期缓存
    const staleCache = getCached<AIProviderTemplate[]>(CACHE_KEYS.PROVIDER_TEMPLATES, 'global', Infinity);
    return staleCache || [];
  }

  const result = (data || []).map(r => ({
    id: r.id,
    providerKey: r.provider_key,
    name: r.name,
    baseUrl: r.base_url || '',
    models: r.models || [],
    color: r.color || 'gray',
    sortOrder: r.sort_order || 0,
    iconSvg: r.icon_svg || '',
  }));

  // 设置缓存
  setCache(CACHE_KEYS.PROVIDER_TEMPLATES, 'global', result);
  
  return result;
}

// 获取用户的 AI 提供商配置 - 带缓存
export async function getUserProviders(userId: string, forceRefresh = false): Promise<AIProvider[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<AIProvider[]>(CACHE_KEYS.USER_PROVIDERS, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('获取用户提供商配置失败:', error);
    return [];
  }

  // 获取模板以继承默认值
  const templates = await getProviderTemplates();
  const templateMap = new Map(templates.map(t => [t.providerKey, t]));

  const result = (data || []).map(r => {
    const template = templateMap.get(r.provider_key);
    return {
      id: r.id,
      userId: r.user_id,
      providerKey: r.provider_key,
      name: r.name,
      apiKey: r.api_key || '',
      // 如果用户没有配置 baseUrl，从模板继承
      baseUrl: r.base_url || template?.baseUrl || '',
      // 如果用户没有配置 models，从模板继承
      models: r.models?.length ? r.models : (template?.models || []),
      isEnabled: r.is_enabled || false,
      isDefault: r.is_default || false,
      defaultModel: r.default_model || '',
      color: template?.color || 'gray',
    };
  });

  setCache(CACHE_KEYS.USER_PROVIDERS, userId, result);
  return result;
}

// 获取启用的 AI 提供商（用于选择器）
export async function getEnabledProviders(userId: string): Promise<AIProvider[]> {
  const providers = await getUserProviders(userId);
  return providers.filter(p => p.isEnabled);
}

// 获取默认 AI 提供商
export async function getDefaultProvider(userId: string): Promise<AIProvider | null> {
  const providers = await getUserProviders(userId);
  const defaultProvider = providers.find(p => p.isDefault && p.isEnabled);
  if (defaultProvider) return defaultProvider;
  
  // 如果没有默认的，返回第一个启用的
  return providers.find(p => p.isEnabled) || null;
}

// 设置默认 AI 提供商
export async function setDefaultProvider(userId: string, providerId: string): Promise<boolean> {
  const { error } = await supabase.rpc('set_default_provider', {
    p_user_id: userId,
    p_provider_id: providerId
  });

  if (error) {
    console.error('设置默认提供商失败:', error);
    return false;
  }

  // 使缓存失效
  invalidateCache(CACHE_KEYS.USER_PROVIDERS, userId);
  return true;
}

// 检查用户是否有已启用的 AI 提供商 - 使用缓存的 providers 数据
export async function hasEnabledProvider(userId: string): Promise<boolean> {
  // 优先使用缓存的 providers 数据
  const providers = await getUserProviders(userId);
  return providers.some(p => p.isEnabled);
}

// 保存用户的 AI 提供商配置
export async function saveUserProvider(
  userId: string,
  providerKey: string,
  config: { 
    name: string; 
    apiKey: string; 
    baseUrl?: string; 
    models?: any[];
    isDefault?: boolean;
    defaultModel?: string;
  }
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
      is_default: config.isDefault || false,
      default_model: config.defaultModel || null,
    }, {
      onConflict: 'user_id,provider_key'
    })
    .select()
    .single();

  if (error) {
    console.error('保存提供商配置失败:', error);
    return null;
  }

  // 使缓存失效
  invalidateCache(CACHE_KEYS.USER_PROVIDERS, userId);

  return {
    id: data.id,
    userId: data.user_id,
    providerKey: data.provider_key,
    name: data.name,
    apiKey: data.api_key || '',
    baseUrl: data.base_url || '',
    models: data.models || [],
    isEnabled: data.is_enabled || false,
    isDefault: data.is_default || false,
    defaultModel: data.default_model || '',
  };
}

// 设置默认模型
export async function setDefaultModel(userId: string, providerId: string, modelId: string): Promise<boolean> {
  const { error } = await supabase.rpc('set_default_model', {
    p_user_id: userId,
    p_provider_id: providerId,
    p_model_id: modelId
  });

  if (error) {
    console.error('设置默认模型失败:', error);
    return false;
  }

  invalidateCache(CACHE_KEYS.USER_PROVIDERS, userId);
  return true;
}

// 删除用户的 AI 提供商配置
export async function deleteUserProvider(userId: string, providerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_providers')
    .delete()
    .eq('id', providerId);

  if (!error) {
    // 使缓存失效
    invalidateCache(CACHE_KEYS.USER_PROVIDERS, userId);
  }

  return !error;
}
