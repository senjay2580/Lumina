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


