import { supabase } from './supabase';
import { getCached, setCache, invalidateCache, CACHE_KEYS } from './cache';

// 类型定义
export interface PromptCategory {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  tags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  copy_count?: number;
  last_copied_at?: string | null;
  is_pinned?: boolean;                   // 是否置顶
  pinned_at?: string | null;             // 置顶时间
  // AI 功能新增字段
  content_en?: string | null;           // 英文翻译版本
  content_translated_at?: string | null; // 翻译时间
  ai_analysis?: {                        // AI 分析结果
    qualityScore: number;
    issues: string[];
    suggestions: string[];
    analyzedAt: string;
  } | null;
}

// ============ 分类 CRUD ============

export async function getCategories(userId: string, forceRefresh = false): Promise<PromptCategory[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<PromptCategory[]>(CACHE_KEYS.CATEGORIES, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('prompt_categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  const result = data || [];
  
  setCache(CACHE_KEYS.CATEGORIES, userId, result);
  return result;
}

export async function createCategory(userId: string, name: string, color: string): Promise<PromptCategory> {
  console.log('Creating category with user_id:', userId);
  
  // 先验证用户是否存在
  const { data: userExists } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (!userExists) {
    console.error('User not found in database:', userId);
    throw new Error('用户不存在，请重新登录');
  }
  
  const { data, error } = await supabase
    .from('prompt_categories')
    .insert({ user_id: userId, name, color })
    .select()
    .single();
  
  if (error) {
    console.error('Create category error:', error);
    throw new Error('创建分类失败: ' + error.message);
  }
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.CATEGORIES, userId);
  
  return data;
}

export async function updateCategory(id: string, updates: { name?: string; color?: string }): Promise<PromptCategory> {
  const { data, error } = await supabase
    .from('prompt_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.CATEGORIES, data.user_id);
  
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  // 先获取 user_id
  const { data: category } = await supabase
    .from('prompt_categories')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('prompt_categories')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (category) {
    invalidateCache(CACHE_KEYS.CATEGORIES, category.user_id);
  }
}

// ============ 提示词 CRUD ============

export async function getPrompts(userId: string, forceRefresh = false): Promise<Prompt[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<Prompt[]>(CACHE_KEYS.PROMPTS, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  const result = data || [];
  
  setCache(CACHE_KEYS.PROMPTS, userId, result);
  return result;
}

export async function createPrompt(
  userId: string, 
  prompt: { title: string; content: string; category_id?: string | null; tags?: string[] }
): Promise<Prompt> {
  console.log('Creating prompt with user_id:', userId);
  
  // 先验证用户是否存在
  const { data: userExists } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (!userExists) {
    console.error('User not found in database:', userId);
    throw new Error('用户不存在，请重新登录');
  }
  
  const { data, error } = await supabase
    .from('prompts')
    .insert({ 
      user_id: userId, 
      title: prompt.title,
      content: prompt.content,
      category_id: prompt.category_id || null,
      tags: prompt.tags || []
    })
    .select()
    .single();
  
  if (error) {
    console.error('Create prompt error:', error);
    throw new Error('创建提示词失败: ' + error.message);
  }
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.PROMPTS, userId);
  invalidateCache(CACHE_KEYS.STATS, userId);
  invalidateCache(CACHE_KEYS.ACTIVITY, userId);
  
  return data;
}

export async function updatePrompt(
  id: string, 
  updates: { title?: string; content?: string; category_id?: string | null; tags?: string[] }
): Promise<Prompt> {
  const { data, error } = await supabase
    .from('prompts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.PROMPTS, data.user_id);
  invalidateCache(CACHE_KEYS.ACTIVITY, data.user_id);
  
  return data;
}

// 置顶/取消置顶提示词
export async function togglePinPrompt(id: string, isPinned: boolean): Promise<Prompt> {
  const { data, error } = await supabase
    .from('prompts')
    .update({ 
      is_pinned: isPinned, 
      pinned_at: isPinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.PROMPTS, data.user_id);
  
  return data;
}

export async function deletePrompt(id: string): Promise<void> {
  // 先获取 user_id
  const { data: prompt } = await supabase
    .from('prompts')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('prompts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (prompt) {
    invalidateCache(CACHE_KEYS.PROMPTS, prompt.user_id);
    invalidateCache(CACHE_KEYS.STATS, prompt.user_id);
    invalidateCache(CACHE_KEYS.DELETED_PROMPTS, prompt.user_id);
  }
}

// 永久删除提示词
export async function permanentDeletePrompt(id: string): Promise<void> {
  // 先获取 user_id
  const { data: prompt } = await supabase
    .from('prompts')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (prompt) {
    invalidateCache(CACHE_KEYS.PROMPTS, prompt.user_id);
    invalidateCache(CACHE_KEYS.STATS, prompt.user_id);
    invalidateCache(CACHE_KEYS.DELETED_PROMPTS, prompt.user_id);
  }
}

// 恢复提示词
export async function restorePrompt(id: string): Promise<void> {
  // 先获取 user_id
  const { data: prompt } = await supabase
    .from('prompts')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('prompts')
    .update({ deleted_at: null })
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (prompt) {
    invalidateCache(CACHE_KEYS.PROMPTS, prompt.user_id);
    invalidateCache(CACHE_KEYS.STATS, prompt.user_id);
    invalidateCache(CACHE_KEYS.DELETED_PROMPTS, prompt.user_id);
  }
}

// 获取已删除的提示词（回收站）
export async function getDeletedPrompts(userId: string, forceRefresh = false): Promise<Prompt[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<Prompt[]>(CACHE_KEYS.DELETED_PROMPTS, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, deleted_at')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  
  if (error) throw error;
  const result = data || [];
  
  setCache(CACHE_KEYS.DELETED_PROMPTS, userId, result);
  return result as Prompt[];
}

// 清空回收站中的提示词
export async function emptyPromptTrash(userId: string): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.DELETED_PROMPTS, userId);
}



// ============ 复制次数统计 ============

// 记录提示词复制
export async function logPromptCopy(promptId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('log_prompt_copy', {
    p_prompt_id: promptId,
    p_user_id: userId
  });
  
  if (error) {
    console.error('Log copy error:', error);
    // 静默失败，不影响用户体验
  }
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.PROMPTS, userId);
  invalidateCache(CACHE_KEYS.STATS, userId);
}

// 获取提示词统计
export interface PromptStats {
  totalPrompts: number;
  totalCopies: number;
  avgCopies: number;
  maxCopies: number;
  usedPrompts: number;
  promptsThisWeek: number;
  promptsThisMonth: number;
}

export async function getPromptStats(userId: string): Promise<PromptStats | null> {
  const { data, error } = await supabase
    .from('prompt_statistics')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Get stats error:', error);
    return null;
  }
  
  return {
    totalPrompts: data.total_prompts || 0,
    totalCopies: data.total_copies || 0,
    avgCopies: data.avg_copies || 0,
    maxCopies: data.max_copies || 0,
    usedPrompts: data.used_prompts || 0,
    promptsThisWeek: data.prompts_this_week || 0,
    promptsThisMonth: data.prompts_this_month || 0
  };
}

// 获取分类统计
export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  promptCount: number;
  totalCopies: number;
}

export async function getCategoryStats(userId: string): Promise<CategoryStats[]> {
  const { data, error } = await supabase
    .from('category_statistics')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Get category stats error:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    categoryId: item.category_id,
    categoryName: item.category_name,
    categoryColor: item.category_color,
    promptCount: item.prompt_count || 0,
    totalCopies: item.total_copies || 0
  }));
}

// 获取每日复制统计
export interface DailyCopyStats {
  date: string;
  copyCount: number;
}

export async function getDailyCopyStats(userId: string, days: number = 30): Promise<DailyCopyStats[]> {
  const { data, error } = await supabase.rpc('get_daily_copy_stats', {
    p_user_id: userId,
    p_days: days
  });
  
  if (error) {
    console.error('Get daily stats error:', error);
    return [];
  }
  
  return (data || []).map((item: any) => ({
    date: item.date,
    copyCount: item.copy_count || 0
  }));
}

// 获取热门提示词
export async function getPopularPrompts(userId: string, limit: number = 10): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('copy_count', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Get popular prompts error:', error);
    return [];
  }
  
  return data || [];
}

// 按复制次数排序获取提示词
export async function getPromptsByCopyCount(userId: string, ascending: boolean = false): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('copy_count', { ascending });
  
  if (error) throw error;
  return data || [];
}
