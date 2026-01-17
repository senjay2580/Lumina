// 通用版本管理库（可插拔设计）
import { supabase } from './supabase';

export interface VersionManagerConfig {
  creationId: string;
  userId: string;
  onVersionChange?: (versionId: string) => void;
}

export interface Version {
  id: string;
  creation_id: string;
  version_number: number;
  title: string;
  content: any;
  change_description?: string;
  tags?: string[];
  created_at: string;
  created_by: string;
}

// ============ 缓存机制（改进版 - 支持请求去重）============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const versionCache = new Map<string, CacheEntry<any>>();
const versionPendingRequests = new Map<string, PendingRequest<any>>();
const VERSION_CACHE_TTL = 30000; // 30秒缓存

function getCacheKey(fn: string, ...args: any[]): string {
  return `${fn}:${JSON.stringify(args)}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = versionCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > VERSION_CACHE_TTL) {
    versionCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  versionCache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(pattern?: string): void {
  if (!pattern) {
    versionCache.clear();
    versionPendingRequests.clear();
    return;
  }
  
  const keys = Array.from(versionCache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      versionCache.delete(key);
    }
  });
  
  const pendingKeys = Array.from(versionPendingRequests.keys());
  pendingKeys.forEach(key => {
    if (key.includes(pattern)) {
      versionPendingRequests.delete(key);
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
  const pending = versionPendingRequests.get(key);
  if (pending) {
    return pending.promise;
  }
  
  // 创建新请求
  const promise = requestFn().then(data => {
    setCache(key, data);
    versionPendingRequests.delete(key);
    return data;
  }).catch(error => {
    versionPendingRequests.delete(key);
    throw error;
  });
  
  versionPendingRequests.set(key, { promise, timestamp: Date.now() });
  return promise;
}

// 获取所有版本
export async function getVersions(creationId: string): Promise<Version[]> {
  const cacheKey = getCacheKey('getVersions', creationId);
  
  return dedupeRequest(cacheKey, async () => {
    const { data, error } = await supabase
      .from('creation_versions')
      .select('*')
      .eq('creation_id', creationId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  });
}

// 批量获取多个创作的最新版本（性能优化）
export async function getLatestVersionsForCreations(creationIds: string[]): Promise<Record<string, Version>> {
  if (creationIds.length === 0) return {};
  
  const cacheKey = getCacheKey('getLatestVersionsForCreations', creationIds.sort());
  
  return dedupeRequest(cacheKey, async () => {
    // 一次性查询所有创作的版本，按版本号降序
    const { data, error } = await supabase
      .from('creation_versions')
      .select('*')
      .in('creation_id', creationIds)
      .order('creation_id')
      .order('version_number', { ascending: false });

    if (error) throw error;
    
    // 为每个创作保留最新版本
    const latestVersions: Record<string, Version> = {};
    data?.forEach(version => {
      if (!latestVersions[version.creation_id]) {
        latestVersions[version.creation_id] = version;
      }
    });
    
    return latestVersions;
  });
}

// 获取当前版本
export async function getCurrentVersion(creationId: string): Promise<Version | null> {
  const cacheKey = getCacheKey('getCurrentVersion', creationId);
  
  return dedupeRequest(cacheKey, async () => {
    const { data: creation } = await supabase
      .from('creations')
      .select('current_version_id')
      .eq('id', creationId)
      .single();

    if (!creation?.current_version_id) return null;

    const { data: version } = await supabase
      .from('creation_versions')
      .select('*')
      .eq('id', creation.current_version_id)
      .single();

    return version;
  });
}

// 创建新版本
export async function createNewVersion(
  creationId: string,
  userId: string,
  content: any,
  options?: {
    title?: string;
    changeDescription?: string;
    tags?: string[];
  }
): Promise<Version> {
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
      title: options?.title || `版本 ${nextVersionNumber}`,
      content,
      change_description: options?.changeDescription,
      tags: options?.tags || ['draft'],
      created_by: userId
    })
    .select()
    .single();

  if (error) throw error;

  // 更新当前版本
  await supabase
    .from('creations')
    .update({ 
      current_version_id: version.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', creationId);

  // 清除缓存
  invalidateCache();

  return version;
}

// 切换版本
export async function switchVersion(creationId: string, versionId: string): Promise<void> {
  const { error } = await supabase
    .from('creations')
    .update({ 
      current_version_id: versionId,
      updated_at: new Date().toISOString()
    })
    .eq('id', creationId);

  if (error) throw error;
}

// 更新版本内容
export async function updateVersionContent(
  versionId: string,
  content: any
): Promise<void> {
  const { error } = await supabase
    .from('creation_versions')
    .update({ content })
    .eq('id', versionId);

  if (error) throw error;
}

// 删除版本
export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase
    .from('creation_versions')
    .delete()
    .eq('id', versionId);

  if (error) throw error;
}

// 对比两个版本
export function compareVersions(versionA: Version, versionB: Version) {
  const changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    type: 'added' | 'removed' | 'modified';
  }> = [];

  function compare(objA: any, objB: any, path: string = '') {
    const keysA = Object.keys(objA || {});
    const keysB = Object.keys(objB || {});
    const allKeys = new Set([...keysA, ...keysB]);

    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const valueA = objA?.[key];
      const valueB = objB?.[key];

      if (valueA === undefined && valueB !== undefined) {
        changes.push({ field: currentPath, oldValue: null, newValue: valueB, type: 'added' });
      } else if (valueA !== undefined && valueB === undefined) {
        changes.push({ field: currentPath, oldValue: valueA, newValue: null, type: 'removed' });
      } else if (typeof valueA === 'object' && typeof valueB === 'object' && !Array.isArray(valueA)) {
        compare(valueA, valueB, currentPath);
      } else if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        changes.push({ field: currentPath, oldValue: valueA, newValue: valueB, type: 'modified' });
      }
    });
  }

  compare(versionA.content, versionB.content);
  return changes;
}
