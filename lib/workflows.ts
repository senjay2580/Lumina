import { supabase, deleteWorkflowImages } from './supabase';
import { getCached, setCache, invalidateCache, CACHE_KEYS } from './cache';

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 列表用的精简类型（不包含 edges）
export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  nodes: any[]; // 只用于计算节点数量
  is_pinned?: boolean;
}

// 计算列表数据版本（用于缓存一致性验证）
function getListDataVersion(items: { updated_at: string }[]): string {
  if (items.length === 0) return '0';
  // 使用最新的 updated_at 作为版本
  return items.reduce((max, item) => 
    item.updated_at > max ? item.updated_at : max, 
    items[0].updated_at
  );
}

// 获取用户所有工作流（不包含已删除的）- 优化版本，只获取列表需要的字段
export async function getWorkflows(userId: string, forceRefresh = false): Promise<WorkflowListItem[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<WorkflowListItem[]>(CACHE_KEYS.WORKFLOWS, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('workflows')
    .select('id, name, description, updated_at, nodes, is_pinned')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  const result = data || [];
  
  // 设置缓存，使用数据版本
  const dataVersion = getListDataVersion(result);
  setCache(CACHE_KEYS.WORKFLOWS, userId, result, dataVersion);
  return result;
}

// 获取单个工作流 - 带 localStorage 缓存
export async function getWorkflow(id: string, forceRefresh = false): Promise<WorkflowRecord | null> {
  const cacheKey = `${CACHE_KEYS.WORKFLOW_DETAIL}_${id}`;
  
  // 检查缓存（使用特殊的用户无关缓存）
  if (!forceRefresh) {
    const cached = getCached<WorkflowRecord>(cacheKey, 'global');
    if (cached) {
      // 验证缓存是否过期（通过快速查询 updated_at）
      const { data: freshCheck } = await supabase
        .from('workflows')
        .select('updated_at')
        .eq('id', id)
        .single();
      
      // 如果 updated_at 没变，使用缓存
      if (freshCheck && freshCheck.updated_at === cached.updated_at) {
        return cached;
      }
    }
  }

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  
  // 设置缓存，使用 updated_at 作为数据版本
  setCache(cacheKey, 'global', data, data.updated_at);
  return data;
}

// 预加载单个工作流（用于 hover 预加载）
export function preloadWorkflow(id: string): void {
  const cacheKey = `${CACHE_KEYS.WORKFLOW_DETAIL}_${id}`;
  const cached = getCached<WorkflowRecord>(cacheKey, 'global');
  
  // 如果已有缓存，不重复加载（后台静默验证）
  if (cached) {
    // 静默验证缓存新鲜度
    supabase
      .from('workflows')
      .select('updated_at')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data && data.updated_at !== cached.updated_at) {
          // 缓存过期，重新加载
          getWorkflow(id, true);
        }
      });
    return;
  }
  
  // 静默预加载，不阻塞
  getWorkflow(id);
}

// 使单个工作流缓存失效
export function invalidateWorkflowCache(id: string): void {
  const cacheKey = `${CACHE_KEYS.WORKFLOW_DETAIL}_${id}`;
  invalidateCache(cacheKey, 'global');
}

// 创建工作流
export async function createWorkflow(userId: string, workflow: { name: string; description?: string; nodes?: any[]; edges?: any[] }): Promise<WorkflowRecord> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('无效的用户ID，请重新登录');
  }
  
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      user_id: userId,
      name: workflow.name,
      description: workflow.description || null,
      nodes: workflow.nodes || [],
      edges: workflow.edges || []
    })
    .select()
    .single();
  
  if (error) {
    throw new Error('创建工作流失败，请检查网络连接');
  }
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.WORKFLOWS, userId);
  invalidateCache(CACHE_KEYS.STATS, userId);
  invalidateCache(CACHE_KEYS.ACTIVITY, userId);
  
  return data;
}

// 更新工作流
export async function updateWorkflow(id: string, updates: { name?: string; description?: string; nodes?: any[]; edges?: any[] }): Promise<WorkflowRecord> {
  const { data, error } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.WORKFLOWS, data.user_id);
  invalidateCache(CACHE_KEYS.ACTIVITY, data.user_id);
  invalidateWorkflowCache(id);
  
  // 更新单个工作流缓存
  const cacheKey = `${CACHE_KEYS.WORKFLOW_DETAIL}_${id}`;
  setCache(cacheKey, 'global', data, data.updated_at);
  
  return data;
}

// 删除工作流（软删除）
export async function deleteWorkflow(id: string): Promise<void> {
  // 先获取 user_id
  const { data: workflow } = await supabase
    .from('workflows')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('workflows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (workflow) {
    invalidateCache(CACHE_KEYS.WORKFLOWS, workflow.user_id);
    invalidateCache(CACHE_KEYS.STATS, workflow.user_id);
    invalidateCache(CACHE_KEYS.DELETED_WORKFLOWS, workflow.user_id);
  }
  invalidateWorkflowCache(id);
}

// 永久删除工作流
export async function permanentDeleteWorkflow(id: string): Promise<void> {
  // 先获取 user_id
  const { data: workflow } = await supabase
    .from('workflows')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // 级联删除工作流图片
  if (workflow) {
    await deleteWorkflowImages(workflow.user_id, id);
  }
  
  // 使缓存失效
  if (workflow) {
    invalidateCache(CACHE_KEYS.WORKFLOWS, workflow.user_id);
    invalidateCache(CACHE_KEYS.STATS, workflow.user_id);
    invalidateCache(CACHE_KEYS.DELETED_WORKFLOWS, workflow.user_id);
  }
  invalidateWorkflowCache(id);
}

// 恢复工作流
export async function restoreWorkflow(id: string): Promise<void> {
  // 先获取 user_id
  const { data: workflow } = await supabase
    .from('workflows')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('workflows')
    .update({ deleted_at: null })
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (workflow) {
    invalidateCache(CACHE_KEYS.WORKFLOWS, workflow.user_id);
    invalidateCache(CACHE_KEYS.STATS, workflow.user_id);
    invalidateCache(CACHE_KEYS.DELETED_WORKFLOWS, workflow.user_id);
  }
}

// 置顶/取消置顶工作流
export async function togglePinWorkflow(id: string, isPinned: boolean): Promise<void> {
  // 先获取 user_id
  const { data: workflow } = await supabase
    .from('workflows')
    .select('user_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('workflows')
    .update({ is_pinned: isPinned })
    .eq('id', id);
  
  if (error) throw error;
  
  // 使缓存失效
  if (workflow) {
    invalidateCache(CACHE_KEYS.WORKFLOWS, workflow.user_id);
  }
}

// 获取已删除的工作流（回收站）
export async function getDeletedWorkflows(userId: string, forceRefresh = false): Promise<WorkflowRecord[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<WorkflowRecord[]>(CACHE_KEYS.DELETED_WORKFLOWS, userId);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('workflows')
    .select('id, name, deleted_at, nodes')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  
  if (error) throw error;
  const result = data || [];
  
  setCache(CACHE_KEYS.DELETED_WORKFLOWS, userId, result);
  return result as WorkflowRecord[];
}

// 清空回收站中的工作流
export async function emptyWorkflowTrash(userId: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);
  
  if (error) throw error;
  
  // 使缓存失效
  invalidateCache(CACHE_KEYS.DELETED_WORKFLOWS, userId);
}

// 获取统计数据
export async function getStats(userId: string, forceRefresh = false): Promise<{ workflows: number; prompts: number; executions: number }> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<{ workflows: number; prompts: number; executions: number }>(CACHE_KEYS.STATS, userId);
    if (cached) return cached;
  }

  const [workflowsRes, promptsRes, executionsRes] = await Promise.all([
    supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
    supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
    supabase.from('workflow_executions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  const result = {
    workflows: workflowsRes.count || 0,
    prompts: promptsRes.count || 0,
    executions: executionsRes.count || 0
  };
  
  setCache(CACHE_KEYS.STATS, userId, result);
  return result;
}

// 获取本地日期字符串 (YYYY-MM-DD)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 获取活动数据（用于热力图）- 包含工作流和提示词的增加/修改
export async function getWorkflowActivity(userId: string, forceRefresh = false): Promise<{ date: string; count: number }[]> {
  // 检查缓存
  if (!forceRefresh) {
    const cached = getCached<{ date: string; count: number }[]>(CACHE_KEYS.ACTIVITY, userId);
    if (cached) return cached;
  }

  // 获取最近 365 天的记录
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);
  
  // 并行获取工作流和提示词的活动数据 - 只获取需要的字段
  const [workflowsRes, promptsRes] = await Promise.all([
    supabase
      .from('workflows')
      .select('created_at, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', startDate.toISOString()),
    supabase
      .from('prompts')
      .select('created_at, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', startDate.toISOString())
  ]);
  
  if (workflowsRes.error) {
    console.error('获取工作流活动数据失败:', workflowsRes.error);
  }
  if (promptsRes.error) {
    console.error('获取提示词活动数据失败:', promptsRes.error);
  }
  
  // 按日期分组统计（使用本地时间）
  const activityMap = new Map<string, number>();
  
  // 统计工作流活动 - 创建和更新都算
  (workflowsRes.data || []).forEach(item => {
    // 创建日期
    const createdDate = getLocalDateString(new Date(item.created_at));
    activityMap.set(createdDate, (activityMap.get(createdDate) || 0) + 1);
    
    // 如果更新日期不同于创建日期，也算一次活动
    const updatedDate = getLocalDateString(new Date(item.updated_at));
    if (updatedDate !== createdDate) {
      activityMap.set(updatedDate, (activityMap.get(updatedDate) || 0) + 1);
    }
  });
  
  // 统计提示词活动 - 创建和更新都算
  (promptsRes.data || []).forEach(item => {
    // 创建日期
    const createdDate = getLocalDateString(new Date(item.created_at));
    activityMap.set(createdDate, (activityMap.get(createdDate) || 0) + 1);
    
    // 如果更新日期不同于创建日期，也算一次活动
    const updatedDate = getLocalDateString(new Date(item.updated_at));
    if (updatedDate !== createdDate) {
      activityMap.set(updatedDate, (activityMap.get(updatedDate) || 0) + 1);
    }
  });
  
  // 转换为数组
  const result = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
  
  setCache(CACHE_KEYS.ACTIVITY, userId, result);
  return result;
}