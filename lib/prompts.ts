import { supabase } from './supabase';

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
}

// ============ 分类 CRUD ============

export async function getCategories(userId: string): Promise<PromptCategory[]> {
  const { data, error } = await supabase
    .from('prompt_categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
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
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompt_categories')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============ 提示词 CRUD ============

export async function getPrompts(userId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
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
  return data;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}


