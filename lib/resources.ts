// 资源中心数据库操作
import { supabase } from './supabase';

// 资源类型
export type ResourceType = 'link' | 'github' | 'document' | 'image' | 'article';

// 资源接口
export interface Resource {
  id: string;
  user_id: string;
  type: ResourceType;
  title: string;
  description?: string;
  url?: string;
  storage_path?: string;
  file_name?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  deleted_at?: string;
}

// 资源统计
export interface ResourceStats {
  all: number;
  link: number;
  github: number;
  document: number;
  image: number;
  article: number;
}

// 从 URL 生成标题
export function generateTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return parsed.host + path;
  } catch {
    return url;
  }
}

// 从文件名生成标题（保留扩展名）
export function generateTitleFromFileName(fileName: string): string {
  return fileName;
}

// 检测 URL 类型
export function detectUrlType(url: string): 'github' | 'link' {
  if (url.includes('github.com')) {
    return 'github';
  }
  return 'link';
}

// 解析 GitHub URL
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.host.includes('github.com')) return null;
    
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

// GitHub 仓库信息
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  homepage: string | null;
  pushed_at: string;
}

// 获取 GitHub 仓库信息（公共 API，无需 token）
export async function fetchGitHubRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      console.error('GitHub API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      owner: data.owner.login,
      repo: data.name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language,
      topics: data.topics || [],
      homepage: data.homepage,
      pushed_at: data.pushed_at,
    };
  } catch (err) {
    console.error('Failed to fetch GitHub repo info:', err);
    return null;
  }
}

// 获取资源列表
export async function getResources(
  userId: string, 
  type?: ResourceType,
  archived: boolean = false,
  excludeFolderItems: boolean = true // 默认排除已在文件夹中的资源
): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // 排除已在文件夹中的资源（只显示根目录的资源）
  if (excludeFolderItems) {
    query = query.is('folder_id', null);
  }

  // 归档筛选
  if (archived) {
    query = query.not('archived_at', 'is', null);
  } else {
    query = query.is('archived_at', null);
  }

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// 获取资源统计（统计所有资源，包括文件夹内的）
export async function getResourceStats(userId: string, archived: boolean = false): Promise<ResourceStats> {
  // 使用 count 查询来获取准确的统计数字，避免 1000 条限制
  const stats: ResourceStats = {
    all: 0,
    link: 0,
    github: 0,
    document: 0,
    image: 0,
    article: 0,
  };

  // 构建基础查询条件
  const baseQuery = (type?: string) => {
    let query = supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (archived) {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    return query;
  };

  try {
    // 并行查询所有统计
    const [allResult, linkResult, githubResult, documentResult, imageResult, articleResult] = await Promise.all([
      baseQuery(),
      baseQuery('link'),
      baseQuery('github'),
      baseQuery('document'),
      baseQuery('image'),
      baseQuery('article'),
    ]);

    stats.all = allResult.count || 0;
    stats.link = linkResult.count || 0;
    stats.github = githubResult.count || 0;
    stats.document = documentResult.count || 0;
    stats.image = imageResult.count || 0;
    stats.article = articleResult.count || 0;

    return stats;
  } catch (error) {
    console.error('Failed to get resource stats:', error);
    return stats;
  }
}

// 创建链接资源
export async function createLinkResource(
  userId: string,
  url: string,
  description?: string
): Promise<Resource> {
  const type = detectUrlType(url);
  let title: string;
  let metadata: Record<string, any> = {};
  let finalDescription = description;

  if (type === 'github') {
    const parsed = parseGitHubUrl(url);
    if (parsed) {
      title = `${parsed.owner}/${parsed.repo}`;
      
      // 获取 GitHub 仓库详细信息
      const repoInfo = await fetchGitHubRepoInfo(parsed.owner, parsed.repo);
      if (repoInfo) {
        metadata = {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          stars: repoInfo.stars,
          forks: repoInfo.forks,
          language: repoInfo.language,
          topics: repoInfo.topics,
          homepage: repoInfo.homepage,
          pushed_at: repoInfo.pushed_at,
        };
        // 如果没有提供描述，使用 GitHub 的描述
        if (!finalDescription && repoInfo.description) {
          finalDescription = repoInfo.description;
        }
      } else {
        metadata = { owner: parsed.owner, repo: parsed.repo };
      }
    } else {
      title = generateTitleFromUrl(url);
    }
  } else {
    title = generateTitleFromUrl(url);
  }

  const { data, error } = await supabase
    .from('resources')
    .insert({
      user_id: userId,
      type,
      title,
      description: finalDescription,
      url,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 上传文件并创建资源
export async function uploadFileResource(
  userId: string,
  file: File,
  description?: string
): Promise<Resource> {
  // 确定类型
  const isImage = file.type.startsWith('image/');
  const type: ResourceType = isImage ? 'image' : 'document';
  
  // 生成存储路径
  const resourceId = crypto.randomUUID();
  const ext = file.name.split('.').pop() || '';
  const storagePath = `${userId}/${resourceId}.${ext}`;

  // 确定 content-type，文本文件添加 UTF-8 编码
  let contentType = file.type || 'application/octet-stream';
  if (contentType.startsWith('text/') || ext === 'md' || ext === 'json' || ext === 'txt') {
    contentType = contentType.includes('charset') ? contentType : `${contentType}; charset=utf-8`;
  }

  // 上传文件
  const { error: uploadError } = await supabase.storage
    .from('resources')
    .upload(storagePath, file, {
      contentType,
    });

  if (uploadError) throw uploadError;

  // 创建数据库记录
  const title = generateTitleFromFileName(file.name);
  const { data, error } = await supabase
    .from('resources')
    .insert({
      id: resourceId,
      user_id: userId,
      type,
      title,
      description,
      storage_path: storagePath,
      file_name: file.name,
      metadata: {},
    })
    .select()
    .single();

  if (error) {
    // 回滚：删除已上传的文件
    await supabase.storage.from('resources').remove([storagePath]);
    throw error;
  }

  return data;
}

// 获取文件 URL
export function getFileUrl(storagePath: string): string {
  const { data } = supabase.storage.from('resources').getPublicUrl(storagePath);
  return data.publicUrl;
}

// 下载文件
export async function downloadFile(storagePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('resources')
    .download(storagePath);
  
  if (error) throw error;
  
  // 创建下载链接
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 删除资源（软删除）
export async function deleteResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resourceId);

  if (error) throw error;
}

// 永久删除资源（包括文件）
export async function permanentDeleteResource(resource: Resource): Promise<void> {
  // 如果有文件，先删除文件
  if (resource.storage_path) {
    await supabase.storage.from('resources').remove([resource.storage_path]);
  }

  // 删除数据库记录
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', resource.id);

  if (error) throw error;
}

// 获取已删除的资源
export async function getDeletedResources(userId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 恢复资源
export async function restoreResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ deleted_at: null })
    .eq('id', resourceId);

  if (error) throw error;
}

// 永久删除资源（通过 ID）
export async function permanentDeleteResourceById(resourceId: string): Promise<void> {
  // 先获取资源信息
  const { data: resource, error: fetchError } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single();

  if (fetchError) throw fetchError;
  if (!resource) throw new Error('Resource not found');

  await permanentDeleteResource(resource);
}

// 清空资源回收站
export async function emptyResourceTrash(userId: string): Promise<void> {
  // 先获取所有已删除的资源
  const deletedResources = await getDeletedResources(userId);
  
  // 删除所有文件
  const filePaths = deletedResources
    .filter(r => r.storage_path)
    .map(r => r.storage_path as string);
  
  if (filePaths.length > 0) {
    await supabase.storage.from('resources').remove(filePaths);
  }

  // 删除数据库记录
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (error) throw error;
}

// 更新资源
export async function updateResource(
  resourceId: string,
  updates: Partial<Pick<Resource, 'title' | 'description'>>
): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update(updates)
    .eq('id', resourceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 归档资源
export async function archiveResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', resourceId);

  if (error) throw error;
}

// 取消归档
export async function unarchiveResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ archived_at: null })
    .eq('id', resourceId);

  if (error) throw error;
}

// 获取已归档资源
export async function getArchivedResources(userId: string, type?: ResourceType): Promise<Resource[]> {
  return getResources(userId, type, true);
}

// ========== 文件预览能力检测 ==========

// 可在浏览器中预览的文本文件扩展名
const PREVIEWABLE_TEXT_EXTENSIONS = [
  'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 
  'yaml', 'yml', 'log', 'csv', 'svg', 'sh', 'bash', 'py', 'rb', 'go',
  'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'sql', 'graphql', 'vue', 'svelte'
];

// 可在浏览器中预览的图片扩展名
const PREVIEWABLE_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'
];

// 不可预览，需要下载的文件扩展名
const DOWNLOAD_ONLY_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'tar', 'gz',
  'exe', 'dmg', 'pkg', 'deb', 'rpm',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'wav', 'flac',
  'psd', 'ai', 'sketch', 'fig',
  'ttf', 'otf', 'woff', 'woff2', 'eot'
];

export interface FilePreviewInfo {
  canPreview: boolean;
  previewType: 'text' | 'image' | 'none';
  reason?: string; // 不能预览时的原因
}

// 检测文件是否可预览
export function getFilePreviewInfo(fileName: string): FilePreviewInfo {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 检查是否是可预览的文本文件
  if (PREVIEWABLE_TEXT_EXTENSIONS.includes(ext)) {
    return { canPreview: true, previewType: 'text' };
  }
  
  // 检查是否是可预览的图片
  if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(ext)) {
    return { canPreview: true, previewType: 'image' };
  }
  
  // 检查是否是明确需要下载的文件
  if (DOWNLOAD_ONLY_EXTENSIONS.includes(ext)) {
    const reasons: Record<string, string> = {
      pdf: 'PDF 文件需要专用阅读器',
      doc: 'Word 文档需要专用软件打开',
      docx: 'Word 文档需要专用软件打开',
      xls: 'Excel 文件需要专用软件打开',
      xlsx: 'Excel 文件需要专用软件打开',
      ppt: 'PPT 文件需要专用软件打开',
      pptx: 'PPT 文件需要专用软件打开',
      zip: '压缩文件需要解压后查看',
      rar: '压缩文件需要解压后查看',
      '7z': '压缩文件需要解压后查看',
    };
    return { 
      canPreview: false, 
      previewType: 'none',
      reason: reasons[ext] || '此文件类型不支持在线预览'
    };
  }
  
  // 未知类型，默认不可预览
  return { 
    canPreview: false, 
    previewType: 'none',
    reason: '未知文件类型，无法预览'
  };
}

// 判断资源是否可在内置预览器中打开
export function canOpenInViewer(resource: Resource): FilePreviewInfo {
  // 图片类型
  if (resource.type === 'image') {
    if (resource.file_name) {
      return getFilePreviewInfo(resource.file_name);
    }
    return { canPreview: true, previewType: 'image' };
  }
  
  // 文档类型 - 检查文件名来判断是否可预览
  if (resource.type === 'document' && resource.file_name) {
    return getFilePreviewInfo(resource.file_name);
  }
  
  // 链接和 GitHub 不在内置预览器中打开（在新标签页打开）
  return { canPreview: false, previewType: 'none', reason: '将在浏览器中打开' };
}
