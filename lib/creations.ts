// 我的创作 - 核心库（支持多种创作类型的版本管理）
import { supabase } from './supabase';

// ============ 类型定义 ============

// 创作类型（可扩展）
export type CreationType = 'resume' | 'article' | 'design' | 'code' | 'document';

// 创作类型配置（插件化设计）
export interface CreationTypeConfig {
  id: CreationType;
  name: string;
  icon: string; // Lucide icon name
  color: string;
  description: string;
  // 编辑器组件（动态导入）
  editorComponent: string; // 组件路径
  // 预览组件
  previewComponent: string;
  // 对比组件
  diffComponent: string;
  // 默认内容结构
  defaultContent: any;
  // 内容验证
  validateContent?: (content: any) => boolean;
}

// 创作项目
export interface Creation {
  id: string;
  user_id: string;
  type: CreationType;
  title: string;
  description?: string;
  // 当前版本
  current_version_id?: string;
  // 元数据
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 创作版本
export interface CreationVersion {
  id: string;
  creation_id: string;
  version_number: number;
  title: string;
  content: any; // JSON 格式，根据创作类型不同而不同
  // 版本说明
  change_description?: string;
  // 标签（如：草稿、发布、归档）
  tags?: string[];
  created_at: string;
  created_by: string;
}

// 版本对比结果
export interface VersionDiff {
  versionA: CreationVersion;
  versionB: CreationVersion;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string; // JSON path
  oldValue?: any;
  newValue?: any;
  description?: string;
}

// ============ 创作类型注册表（插件系统）============

export const CREATION_TYPES: Record<CreationType, CreationTypeConfig> = {
  resume: {
    id: 'resume',
    name: '简历',
    icon: 'FileUser',
    color: '#3B82F6',
    description: '创建和管理个人简历',
    editorComponent: 'ResumeEditor',
    previewComponent: 'ResumePreview',
    diffComponent: 'ResumeDiff',
    defaultContent: {
      personalInfo: {
        name: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        summary: ''
      },
      experience: [],
      education: [],
      skills: [],
      projects: []
    }
  },
  article: {
    id: 'article',
    name: '文章',
    icon: 'FileText',
    color: '#10B981',
    description: '撰写和发布文章',
    editorComponent: 'ArticleEditor',
    previewComponent: 'ArticlePreview',
    diffComponent: 'ArticleDiff',
    defaultContent: {
      title: '',
      content: '',
      tags: [],
      coverImage: ''
    }
  },
  design: {
    id: 'design',
    name: '设计',
    icon: 'Palette',
    color: '#F59E0B',
    description: '创建设计作品',
    editorComponent: 'DesignEditor',
    previewComponent: 'DesignPreview',
    diffComponent: 'DesignDiff',
    defaultContent: {
      canvas: {},
      layers: []
    }
  },
  code: {
    id: 'code',
    name: '代码',
    icon: 'Code',
    color: '#8B5CF6',
    description: '编写代码片段',
    editorComponent: 'CodeEditor',
    previewComponent: 'CodePreview',
    diffComponent: 'CodeDiff',
    defaultContent: {
      language: 'javascript',
      code: ''
    }
  },
  document: {
    id: 'document',
    name: '文档',
    icon: 'FileText',
    color: '#6366F1',
    description: '编写技术文档',
    editorComponent: 'DocumentEditor',
    previewComponent: 'DocumentPreview',
    diffComponent: 'DocumentDiff',
    defaultContent: {
      sections: []
    }
  }
};

// ============ 缓存机制（改进版 - 支持请求去重）============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, PendingRequest<any>>();
const CACHE_TTL = 30000; // 30秒缓存

function getCacheKey(fn: string, ...args: any[]): string {
  return `${fn}:${JSON.stringify(args)}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    pendingRequests.clear();
    return;
  }
  
  const keys = Array.from(cache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  });
  
  const pendingKeys = Array.from(pendingRequests.keys());
  pendingKeys.forEach(key => {
    if (key.includes(pattern)) {
      pendingRequests.delete(key);
    }
  });
}

// 请求去重：如果相同的请求正在进行中，返回同一个 Promise
async function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // 检查缓存
  const cached = getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // 检查是否有正在进行的请求
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending.promise;
  }
  
  // 创建新请求
  const promise = requestFn().then(data => {
    setCache(key, data);
    pendingRequests.delete(key);
    return data;
  }).catch(error => {
    pendingRequests.delete(key);
    throw error;
  });
  
  pendingRequests.set(key, { promise, timestamp: Date.now() });
  return promise;
}

// ============ 创作项目管理 ============

// 获取用户的所有创作项目
export async function getCreations(userId: string, type?: CreationType): Promise<Creation[]> {
  const cacheKey = getCacheKey('getCreations', userId, type);
  
  return dedupeRequest(cacheKey, async () => {
    let query = supabase
      .from('creations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get creations:', error);
      throw error;
    }

    return data || [];
  });
}

// 创建新的创作项目
export async function createCreation(
  userId: string,
  type: CreationType,
  title: string,
  description?: string
): Promise<Creation> {
  const typeConfig = CREATION_TYPES[type];
  
  // 创建项目
  const { data: creation, error: creationError } = await supabase
    .from('creations')
    .insert({
      user_id: userId,
      type,
      title,
      description
    })
    .select()
    .single();

  if (creationError) {
    console.error('Failed to create creation:', creationError);
    throw creationError;
  }

  // 创建初始版本
  const { data: version, error: versionError } = await supabase
    .from('creation_versions')
    .insert({
      creation_id: creation.id,
      version_number: 1,
      title: '初始版本',
      content: typeConfig.defaultContent,
      created_by: userId,
      tags: ['draft']
    })
    .select()
    .single();

  if (versionError) {
    console.error('Failed to create initial version:', versionError);
    throw versionError;
  }

  // 更新项目的当前版本
  const { data: updatedCreation, error: updateError } = await supabase
    .from('creations')
    .update({ current_version_id: version.id })
    .eq('id', creation.id)
    .select()
    .single();

  if (updateError) {
    console.error('Failed to update current version:', updateError);
    throw updateError;
  }

  // 清除缓存
  invalidateCache('getCreations');
  
  return updatedCreation;
}

// 更新创作项目
export async function updateCreation(
  creationId: string,
  updates: Partial<Pick<Creation, 'title' | 'description' | 'metadata'>>
): Promise<void> {
  const { error } = await supabase
    .from('creations')
    .update(updates)
    .eq('id', creationId);

  if (error) {
    console.error('Failed to update creation:', error);
    throw error;
  }
  
  // 清除缓存
  invalidateCache('getCreations');
}

// 删除创作项目（级联删除所有版本）
export async function deleteCreation(creationId: string): Promise<void> {
  const { error } = await supabase
    .from('creations')
    .delete()
    .eq('id', creationId);

  if (error) {
    console.error('Failed to delete creation:', error);
    throw error;
  }
  
  // 清除缓存
  invalidateCache('getCreations');
}

// ============ 版本管理 ============

// 获取创作的所有版本
export async function getVersions(creationId: string): Promise<CreationVersion[]> {
  const { data, error } = await supabase
    .from('creation_versions')
    .select('*')
    .eq('creation_id', creationId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('Failed to get versions:', error);
    throw error;
  }

  return data || [];
}

// 获取单个版本
export async function getVersion(versionId: string): Promise<CreationVersion | null> {
  const { data, error } = await supabase
    .from('creation_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error) {
    console.error('Failed to get version:', error);
    return null;
  }

  return data;
}

// 创建新版本
export async function createVersion(
  creationId: string,
  userId: string,
  content: any,
  title?: string,
  changeDescription?: string,
  tags?: string[]
): Promise<CreationVersion> {
  // 获取最新版本号
  const { data: versions } = await supabase
    .from('creation_versions')
    .select('version_number')
    .eq('creation_id', creationId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

  // 创建新版本
  const { data: version, error } = await supabase
    .from('creation_versions')
    .insert({
      creation_id: creationId,
      version_number: nextVersionNumber,
      title: title || `版本 ${nextVersionNumber}`,
      content,
      change_description: changeDescription,
      tags: tags || ['draft'],
      created_by: userId
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create version:', error);
    throw error;
  }

  // 更新创作项目的当前版本
  await supabase
    .from('creations')
    .update({ 
      current_version_id: version.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', creationId);

  return version;
}

// 更新版本
export async function updateVersion(
  versionId: string,
  updates: Partial<Pick<CreationVersion, 'title' | 'content' | 'change_description' | 'tags'>>
): Promise<void> {
  const { error } = await supabase
    .from('creation_versions')
    .update(updates)
    .eq('id', versionId);

  if (error) {
    console.error('Failed to update version:', error);
    throw error;
  }
}

// 删除版本
export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase
    .from('creation_versions')
    .delete()
    .eq('id', versionId);

  if (error) {
    console.error('Failed to delete version:', error);
    throw error;
  }
}

// 设置当前版本
export async function setCurrentVersion(creationId: string, versionId: string): Promise<void> {
  const { error } = await supabase
    .from('creations')
    .update({ 
      current_version_id: versionId,
      updated_at: new Date().toISOString()
    })
    .eq('id', creationId);

  if (error) {
    console.error('Failed to set current version:', error);
    throw error;
  }
}

// ============ 版本对比 ============

// 对比两个版本（简单的 JSON diff）
export function compareVersions(
  versionA: CreationVersion,
  versionB: CreationVersion
): VersionDiff {
  const changes: DiffChange[] = [];
  
  // 递归对比 JSON 对象
  function compareObjects(objA: any, objB: any, path: string = '') {
    const keysA = Object.keys(objA || {});
    const keysB = Object.keys(objB || {});
    const allKeys = new Set([...keysA, ...keysB]);

    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const valueA = objA?.[key];
      const valueB = objB?.[key];

      if (valueA === undefined && valueB !== undefined) {
        changes.push({
          type: 'added',
          path: currentPath,
          newValue: valueB
        });
      } else if (valueA !== undefined && valueB === undefined) {
        changes.push({
          type: 'removed',
          path: currentPath,
          oldValue: valueA
        });
      } else if (typeof valueA === 'object' && typeof valueB === 'object' && !Array.isArray(valueA) && !Array.isArray(valueB)) {
        compareObjects(valueA, valueB, currentPath);
      } else if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        changes.push({
          type: 'modified',
          path: currentPath,
          oldValue: valueA,
          newValue: valueB
        });
      }
    });
  }

  compareObjects(versionA.content, versionB.content);

  return {
    versionA,
    versionB,
    changes
  };
}

// 获取版本统计
export async function getCreationStats(userId: string): Promise<{
  total: number;
  byType: Record<CreationType, number>;
}> {
  const { data, error } = await supabase
    .from('creations')
    .select('type')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get creation stats:', error);
    return { total: 0, byType: {} as Record<CreationType, number> };
  }

  const byType: Record<string, number> = {};
  data.forEach(item => {
    byType[item.type] = (byType[item.type] || 0) + 1;
  });

  return {
    total: data.length,
    byType: byType as Record<CreationType, number>
  };
}
