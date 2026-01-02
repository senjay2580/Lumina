import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 图片存储相关
const STORAGE_BUCKET = 'workflow-images';

export interface WorkflowImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

// 上传图片到 Supabase Storage（按工作流ID分组）
export async function uploadWorkflowImage(userId: string, file: File, workflowId?: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  // 路径格式: userId/workflowId/timestamp_random.ext
  const folder = workflowId ? `${userId}/${workflowId}` : `${userId}/temp`;
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: '31536000',
      upsert: false
    });
  
  if (error) {
    console.error('Upload error:', error);
    throw new Error('图片上传失败');
  }
  
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}

// 获取工作流的所有图片
export async function getWorkflowImages(userId: string, workflowId: string): Promise<WorkflowImage[]> {
  const folder = `${userId}/${workflowId}`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(folder, {
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  if (error) {
    console.error('List images error:', error);
    return [];
  }
  
  return (data || [])
    .filter(item => !item.id.endsWith('/')) // 排除文件夹
    .map(item => {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(`${folder}/${item.name}`);
      
      return {
        name: item.name,
        url: urlData.publicUrl,
        size: item.metadata?.size || 0,
        createdAt: item.created_at || ''
      };
    });
}

// 删除单张图片
export async function deleteWorkflowImage(url: string): Promise<void> {
  const match = url.match(/workflow-images\/(.+)$/);
  if (!match) return;
  
  const path = decodeURIComponent(match[1]);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    console.error('Delete image error:', error);
    throw new Error('删除图片失败');
  }
}

// 删除工作流的所有图片
export async function deleteWorkflowImages(userId: string, workflowId: string): Promise<void> {
  const folder = `${userId}/${workflowId}`;
  
  // 先列出所有图片
  const { data: files, error: listError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(folder);
  
  if (listError) {
    console.error('List images error:', listError);
    return;
  }
  
  if (!files || files.length === 0) return;
  
  // 批量删除
  const paths = files.map(f => `${folder}/${f.name}`);
  const { error: deleteError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(paths);
  
  if (deleteError) {
    console.error('Delete images error:', deleteError);
  }
}

// 移动临时图片到工作流文件夹
export async function moveImagesToWorkflow(userId: string, workflowId: string, imageUrls: string[]): Promise<string[]> {
  const newUrls: string[] = [];
  
  for (const url of imageUrls) {
    // 检查是否是临时图片
    if (!url.includes(`/${userId}/temp/`)) {
      newUrls.push(url);
      continue;
    }
    
    const match = url.match(/workflow-images\/(.+)$/);
    if (!match) {
      newUrls.push(url);
      continue;
    }
    
    const oldPath = decodeURIComponent(match[1]);
    const fileName = oldPath.split('/').pop();
    const newPath = `${userId}/${workflowId}/${fileName}`;
    
    // 移动文件
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .move(oldPath, newPath);
    
    if (error) {
      console.error('Move image error:', error);
      newUrls.push(url); // 保留原 URL
    } else {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(newPath);
      newUrls.push(urlData.publicUrl);
    }
  }
  
  return newUrls;
}
