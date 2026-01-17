// 投递记录管理
import { supabase } from './supabase';

export type ApplicationStatus = 'pending' | 'interview' | 'offer' | 'rejected' | 'accepted';

export interface JobApplication {
  id: string;
  user_id: string;
  creation_id: string;
  version_id: string;
  company_name: string;
  position: string;
  application_date: string;
  status: ApplicationStatus;
  current_stage?: string;
  notes?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  salary_range?: string;
  created_at: string;
  updated_at: string;
  
  // 关联数据
  creation?: {
    title: string;
  };
  version?: {
    title: string;
    version_number: number;
  };
}

export interface CreateApplicationData {
  user_id: string;
  creation_id: string;
  version_id: string;
  company_name: string;
  position: string;
  application_date?: string;
  status?: ApplicationStatus;
  current_stage?: string;
  notes?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  salary_range?: string;
}

export interface UpdateApplicationData {
  company_name?: string;
  position?: string;
  application_date?: string;
  status?: ApplicationStatus;
  current_stage?: string;
  notes?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  salary_range?: string;
}

/**
 * 获取用户的所有投递记录
 */
export async function getApplications(userId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      creation:creations!inner(title),
      version:creation_versions!inner(title, version_number)
    `)
    .eq('user_id', userId)
    .order('application_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch applications:', error);
    throw error;
  }

  return data || [];
}

/**
 * 创建投递记录
 */
export async function createApplication(data: CreateApplicationData): Promise<JobApplication> {
  const { data: result, error } = await supabase
    .from('job_applications')
    .insert([data])
    .select(`
      *,
      creation:creations!inner(title),
      version:creation_versions!inner(title, version_number)
    `)
    .single();

  if (error) {
    console.error('Failed to create application:', error);
    throw error;
  }

  return result;
}

/**
 * 更新投递记录
 */
export async function updateApplication(
  id: string,
  data: UpdateApplicationData
): Promise<JobApplication> {
  const { data: result, error } = await supabase
    .from('job_applications')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      creation:creations!inner(title),
      version:creation_versions!inner(title, version_number)
    `)
    .single();

  if (error) {
    console.error('Failed to update application:', error);
    throw error;
  }

  return result;
}

/**
 * 删除投递记录
 */
export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete application:', error);
    throw error;
  }
}

/**
 * 获取状态统计
 */
export async function getApplicationStats(userId: string) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('status')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch stats:', error);
    throw error;
  }

  const stats = {
    total: data.length,
    pending: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    accepted: 0
  };

  data.forEach(app => {
    stats[app.status as ApplicationStatus]++;
  });

  return stats;
}

// 状态显示配置
export const STATUS_CONFIG = {
  pending: { label: '待回复', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  interview: { label: '面试中', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  offer: { label: '已Offer', color: 'bg-green-100 text-green-700 border-green-300' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700 border-red-300' },
  accepted: { label: '已接受', color: 'bg-purple-100 text-purple-700 border-purple-300' }
};
