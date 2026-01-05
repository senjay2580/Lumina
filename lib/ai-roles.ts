// AI 角色模板库 API
import { supabase } from './supabase';
import { getCached, setCache, invalidateCache, CACHE_KEYS } from './cache';

// 类型定义
export interface AIRoleCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  userId: string | null;
}

export interface AIRoleTemplate {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  content: string;
  icon: string;
  tags: string[];
  isSystem: boolean;
  userId: string | null;
  copyCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============ 分类 API ============

export async function getRoleCategories(userId: string): Promise<AIRoleCategory[]> {
  const cached = getCached<AIRoleCategory[]>('role_categories', userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ai_role_categories')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${userId}`)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取角色分类失败:', error);
    return [];
  }

  const result = (data || []).map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon || '📌',
    color: r.color || 'gray',
    sortOrder: r.sort_order || 0,
    isSystem: r.is_system || false,
    userId: r.user_id,
  }));

  setCache('role_categories', userId, result);
  return result;
}

export async function createRoleCategory(
  userId: string,
  data: { name: string; icon?: string; color?: string }
): Promise<AIRoleCategory | null> {
  const { data: result, error } = await supabase
    .from('ai_role_categories')
    .insert({
      name: data.name,
      icon: data.icon || '📌',
      color: data.color || 'gray',
      user_id: userId,
      is_system: false,
    })
    .select()
    .single();

  if (error) {
    console.error('创建角色分类失败:', error);
    return null;
  }

  invalidateCache('role_categories', userId);
  return {
    id: result.id,
    name: result.name,
    icon: result.icon,
    color: result.color,
    sortOrder: result.sort_order || 0,
    isSystem: false,
    userId: result.user_id,
  };
}

export async function updateRoleCategory(
  categoryId: string,
  data: { name?: string; icon?: string; color?: string }
): Promise<boolean> {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.color !== undefined) updateData.color = data.color;

  const { error } = await supabase
    .from('ai_role_categories')
    .update(updateData)
    .eq('id', categoryId);

  if (error) {
    console.error('更新角色分类失败:', error);
    return false;
  }

  return true;
}

export async function deleteRoleCategory(categoryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_role_categories')
    .delete()
    .eq('id', categoryId);

  if (error) {
    console.error('删除角色分类失败:', error);
    return false;
  }

  return !error;
}

// ============ 模板 API ============

export async function getRoleTemplates(userId: string): Promise<AIRoleTemplate[]> {
  const cached = getCached<AIRoleTemplate[]>('role_templates', userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ai_role_templates')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${userId}`)
    .order('copy_count', { ascending: false });

  if (error) {
    console.error('获取角色模板失败:', error);
    return [];
  }

  const result = (data || []).map(r => ({
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description || '',
    content: r.content,
    icon: r.icon || '🎭',
    tags: r.tags || [],
    isSystem: r.is_system || false,
    userId: r.user_id,
    copyCount: r.copy_count || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  setCache('role_templates', userId, result);
  return result;
}

export async function createRoleTemplate(
  userId: string,
  data: {
    categoryId?: string;
    name: string;
    description?: string;
    content: string;
    icon?: string;
    tags?: string[];
  }
): Promise<AIRoleTemplate | null> {
  const { data: result, error } = await supabase
    .from('ai_role_templates')
    .insert({
      category_id: data.categoryId || null,
      name: data.name,
      description: data.description || '',
      content: data.content,
      icon: data.icon || '🎭',
      tags: data.tags || [],
      user_id: userId,
      is_system: false,
    })
    .select()
    .single();

  if (error) {
    console.error('创建角色模板失败:', error);
    return null;
  }

  invalidateCache('role_templates', userId);
  return {
    id: result.id,
    categoryId: result.category_id,
    name: result.name,
    description: result.description || '',
    content: result.content,
    icon: result.icon || '🎭',
    tags: result.tags || [],
    isSystem: false,
    userId: result.user_id,
    copyCount: 0,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function updateRoleTemplate(
  templateId: string,
  data: {
    categoryId?: string;
    name?: string;
    description?: string;
    content?: string;
    icon?: string;
    tags?: string[];
  }
): Promise<boolean> {
  const updateData: any = {};
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.tags !== undefined) updateData.tags = data.tags;

  const { error } = await supabase
    .from('ai_role_templates')
    .update(updateData)
    .eq('id', templateId);

  if (error) {
    console.error('更新角色模板失败:', error);
    return false;
  }

  return true;
}

export async function deleteRoleTemplate(templateId: string, userId?: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_role_templates')
    .delete()
    .eq('id', templateId);

  if (!error && userId) {
    invalidateCache('role_templates', userId);
  }

  return !error;
}

// 增加复制次数
export async function incrementRoleCopyCount(templateId: string): Promise<void> {
  try {
    await supabase.rpc('increment_role_copy_count', { template_id: templateId });
  } catch {
    // 如果 RPC 不存在，使用普通更新
    const { data } = await supabase
      .from('ai_role_templates')
      .select('copy_count')
      .eq('id', templateId)
      .single();
    
    if (data) {
      await supabase
        .from('ai_role_templates')
        .update({ copy_count: (data.copy_count || 0) + 1 })
        .eq('id', templateId);
    }
  }
}
