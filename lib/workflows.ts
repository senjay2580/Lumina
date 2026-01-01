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
