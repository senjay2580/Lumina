import { supabase } from './supabase';

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
}

// 获取用户所有工作流
export async function getWorkflows(userId: string): Promise<WorkflowRecord[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// 获取单个工作流
export async function getWorkflow(id: string): Promise<WorkflowRecord | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data;
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
  return data;
}

// 删除工作流
export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 获取统计数据
export async function getStats(userId: string): Promise<{ workflows: number; prompts: number; executions: number }> {
  const [workflowsRes, promptsRes, executionsRes] = await Promise.all([
    supabase.from('workflows').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('workflow_executions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);

  return {
    workflows: workflowsRes.count || 0,
    prompts: promptsRes.count || 0,
    executions: executionsRes.count || 0
  };
}

// 获取本地日期字符串 (YYYY-MM-DD)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 获取工作流活动数据（用于热力图）
export async function getWorkflowActivity(userId: string): Promise<{ date: string; count: number }[]> {
  // 获取最近 365 天的工作流更新记录
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);
  
  const { data, error } = await supabase
    .from('workflows')
    .select('updated_at')
    .eq('user_id', userId)
    .gte('updated_at', startDate.toISOString());
  
  if (error) {
    console.error('获取活动数据失败:', error);
    return [];
  }
  
  // 按日期分组统计（使用本地时间）
  const activityMap = new Map<string, number>();
  
  (data || []).forEach(item => {
    const date = getLocalDateString(new Date(item.updated_at));
    activityMap.set(date, (activityMap.get(date) || 0) + 1);
  });
  
  // 转换为数组
  return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
}
