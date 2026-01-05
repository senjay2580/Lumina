// 提示词爬虫管理库
import { supabase } from './supabase';

// 类型定义
export interface PromptSource {
  id: string;
  source_type: 'reddit' | 'github' | 'manual';
  source_id: string;
  source_url: string;
  title: string;
  content: string;
  author: string;
  score: number;
  raw_data: any;
  crawled_at: string;
}

export interface ExtractedPrompt {
  id: string;
  source_id: string;
  prompt_title: string;
  prompt_content: string;
  suggested_category: string;
  quality_score: number;
  ai_analysis: any;
  language: string;
  is_approved: boolean;
  approved_by: string | null;
  imported_to_prompt_id: string | null;
  created_at: string;
  // 关联数据
  source?: PromptSource;
}

export interface CrawlJob {
  id: string;
  job_type: 'reddit' | 'github' | 'all';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  items_found: number;
  items_new: number;
  prompts_extracted: number;
  error_message: string | null;
  created_at: string;
}

export interface CrawlStats {
  totalSources: number;
  redditSources: number;
  githubSources: number;
  totalExtracted: number;
  pendingReview: number;
  approved: number;
  imported: number;
}

// ============ 爬取任务 ============

// 触发爬取任务
export async function triggerCrawl(jobType: 'reddit' | 'github' | 'all' = 'all'): Promise<{ jobId: string; stats: any }> {
  const { data, error } = await supabase.functions.invoke('prompt-crawler', {
    body: { jobType }
  });
  
  if (error) throw new Error(error.message);
  return data;
}

// 获取爬取任务历史
export async function getCrawlJobs(limit = 20): Promise<CrawlJob[]> {
  const { data, error } = await supabase
    .from('crawl_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

// ============ 来源管理 ============

// 获取所有来源
export async function getPromptSources(
  filters?: { sourceType?: string; limit?: number; offset?: number }
): Promise<PromptSource[]> {
  let query = supabase
    .from('prompt_sources')
    .select('*')
    .order('crawled_at', { ascending: false });
  
  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============ 提取的提示词管理 ============

// 获取待审核的提示词
export async function getPendingPrompts(limit = 50): Promise<ExtractedPrompt[]> {
  const { data, error } = await supabase
    .from('extracted_prompts')
    .select(`
      *,
      source:prompt_sources(*)
    `)
    .eq('is_approved', false)
    .is('imported_to_prompt_id', null)
    .order('quality_score', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

// 获取已审核的提示词
export async function getApprovedPrompts(limit = 50): Promise<ExtractedPrompt[]> {
  const { data, error } = await supabase
    .from('extracted_prompts')
    .select(`
      *,
      source:prompt_sources(*)
    `)
    .eq('is_approved', true)
    .order('quality_score', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

// 审核通过提示词
export async function approvePrompt(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .update({ 
      is_approved: true, 
      approved_by: userId 
    })
    .eq('id', id);
  
  if (error) throw error;
}

// 批量审核
export async function approvePrompts(ids: string[], userId: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .update({ 
      is_approved: true, 
      approved_by: userId 
    })
    .in('id', ids);
  
  if (error) throw error;
}

// 拒绝/删除提示词
export async function rejectPrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 导入提示词到用户的提示词库
export async function importPromptToLibrary(
  extractedPromptId: string,
  userId: string,
  categoryId?: string
): Promise<string> {
  // 获取提取的提示词
  const { data: extracted, error: fetchError } = await supabase
    .from('extracted_prompts')
    .select('*')
    .eq('id', extractedPromptId)
    .single();
  
  if (fetchError) throw fetchError;
  
  // 创建新提示词
  const { data: newPrompt, error: createError } = await supabase
    .from('prompts')
    .insert({
      user_id: userId,
      title: extracted.prompt_title,
      content: extracted.prompt_content,
      category_id: categoryId || null,
      tags: [extracted.suggested_category, 'imported'].filter(Boolean)
    })
    .select()
    .single();
  
  if (createError) throw createError;
  
  // 更新提取记录
  await supabase
    .from('extracted_prompts')
    .update({ 
      imported_to_prompt_id: newPrompt.id,
      is_approved: true,
      approved_by: userId
    })
    .eq('id', extractedPromptId);
  
  return newPrompt.id;
}

// 批量导入
export async function importPromptsToLibrary(
  extractedPromptIds: string[],
  userId: string,
  categoryId?: string
): Promise<string[]> {
  const importedIds: string[] = [];
  
  for (const id of extractedPromptIds) {
    try {
      const newId = await importPromptToLibrary(id, userId, categoryId);
      importedIds.push(newId);
    } catch (error) {
      console.error(`Failed to import prompt ${id}:`, error);
    }
  }
  
  return importedIds;
}

// ============ 统计 ============

export async function getCrawlStats(): Promise<CrawlStats> {
  const [
    { count: totalSources },
    { count: redditSources },
    { count: githubSources },
    { count: totalExtracted },
    { count: pendingReview },
    { count: approved },
    { count: imported }
  ] = await Promise.all([
    supabase.from('prompt_sources').select('*', { count: 'exact', head: true }),
    supabase.from('prompt_sources').select('*', { count: 'exact', head: true }).eq('source_type', 'reddit'),
    supabase.from('prompt_sources').select('*', { count: 'exact', head: true }).eq('source_type', 'github'),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).eq('is_approved', false).is('imported_to_prompt_id', null),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).not('imported_to_prompt_id', 'is', null)
  ]);
  
  return {
    totalSources: totalSources || 0,
    redditSources: redditSources || 0,
    githubSources: githubSources || 0,
    totalExtracted: totalExtracted || 0,
    pendingReview: pendingReview || 0,
    approved: approved || 0,
    imported: imported || 0
  };
}

// ============ 配置管理 ============

export async function getCrawlConfig(): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('crawl_config')
    .select('config_key, config_value');
  
  if (error) throw error;
  
  const config: Record<string, any> = {};
  for (const item of data || []) {
    try {
      config[item.config_key] = JSON.parse(item.config_value);
    } catch {
      config[item.config_key] = item.config_value;
    }
  }
  
  return config;
}

export async function updateCrawlConfig(key: string, value: any): Promise<void> {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  
  const { error } = await supabase
    .from('crawl_config')
    .upsert({ 
      config_key: key, 
      config_value: stringValue,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'config_key' 
    });
  
  if (error) throw error;
}
