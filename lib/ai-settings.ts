import { supabase } from './supabase';

// AI 厂商配置类型
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AISettings {
  qwen: AIProviderConfig;
  glm: AIProviderConfig;
  google: AIProviderConfig;
  deepseek: AIProviderConfig;
  custom: AIProviderConfig;
}

// 默认配置
export const defaultAISettings: AISettings = {
  qwen: { apiKey: '', baseUrl: '', enabled: false },
  glm: { apiKey: '', baseUrl: '', enabled: false },
  google: { apiKey: '', enabled: false },
  deepseek: { apiKey: '', baseUrl: '', enabled: false },
  custom: { apiKey: '', baseUrl: '', enabled: false },
};

// 获取用户的 AI 设置
export async function getAISettings(userId: string): Promise<AISettings> {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('settings')
    .eq('user_id', userId)
    .single();

  if (error) {
    // 如果没有记录，返回默认值
    if (error.code === 'PGRST116') {
      return defaultAISettings;
    }
    console.error('获取 AI 设置失败:', error);
    return defaultAISettings;
  }

  return data?.settings || defaultAISettings;
}

// 保存用户的 AI 设置
export async function saveAISettings(userId: string, settings: AISettings): Promise<void> {
  const { error } = await supabase
    .from('ai_settings')
    .upsert({
      user_id: userId,
      settings,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('保存 AI 设置失败:', error);
    throw new Error('保存 AI 设置失败');
  }
}

// 获取特定厂商的配置
export async function getProviderConfig(userId: string, providerId: keyof AISettings): Promise<AIProviderConfig | null> {
  const settings = await getAISettings(userId);
  return settings[providerId] || null;
}

// 更新特定厂商的配置
export async function updateProviderConfig(
  userId: string, 
  providerId: keyof AISettings, 
  config: Partial<AIProviderConfig>
): Promise<void> {
  const settings = await getAISettings(userId);
  settings[providerId] = { ...settings[providerId], ...config };
  await saveAISettings(userId, settings);
}
