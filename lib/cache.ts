// 持久化缓存层 - 支持 localStorage + 内存缓存
// 使用版本号和时间戳确保缓存一致性

const CACHE_PREFIX = 'lumina_cache_';
const CACHE_VERSION = 'v1'; // 缓存版本，升级时修改此值会清除旧缓存
const DEFAULT_TTL = 5 * 60 * 1000; // 默认 5 分钟

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId: string;
  version: string;
  // 用于验证数据新鲜度的时间戳（如 updated_at）
  dataVersion?: string;
}

// 内存缓存
const memoryCache = new Map<string, CacheEntry<any>>();

// 生成完整的缓存键
function getCacheKey(key: string, userId: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}_${userId}_${key}`;
}

// 从 localStorage 读取
function readFromStorage<T>(key: string, userId: string): CacheEntry<T> | null {
  try {
    const fullKey = getCacheKey(key, userId);
    const stored = localStorage.getItem(fullKey);
    if (!stored) return null;
    
    const entry = JSON.parse(stored) as CacheEntry<T>;
    
    // 验证版本
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(fullKey);
      return null;
    }
    
    // 验证用户
    if (entry.userId !== userId) {
      localStorage.removeItem(fullKey);
      return null;
    }
    
    return entry;
  } catch {
    return null;
  }
}

// 写入 localStorage
function writeToStorage<T>(key: string, userId: string, entry: CacheEntry<T>): void {
  try {
    const fullKey = getCacheKey(key, userId);
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch (e) {
    // localStorage 可能已满，清理旧缓存
    console.warn('localStorage 写入失败，尝试清理旧缓存', e);
    clearOldCache();
  }
}

// 清理旧缓存
function clearOldCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && !key.includes(CACHE_VERSION)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {}
}

// 获取缓存（优先内存，其次 localStorage）
export function getCached<T>(key: string, userId: string, ttl = DEFAULT_TTL): T | null {
  // 先检查内存缓存
  const memKey = getCacheKey(key, userId);
  const memEntry = memoryCache.get(memKey);
  
  if (memEntry && memEntry.userId === userId && Date.now() - memEntry.timestamp < ttl) {
    return memEntry.data as T;
  }
  
  // 检查 localStorage
  const storageEntry = readFromStorage<T>(key, userId);
  if (storageEntry && Date.now() - storageEntry.timestamp < ttl) {
    // 恢复到内存缓存
    memoryCache.set(memKey, storageEntry);
    return storageEntry.data;
  }
  
  return null;
}

// 设置缓存（同时写入内存和 localStorage）
export function setCache<T>(key: string, userId: string, data: T, dataVersion?: string): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    userId,
    version: CACHE_VERSION,
    dataVersion,
  };
  
  const memKey = getCacheKey(key, userId);
  memoryCache.set(memKey, entry);
  writeToStorage(key, userId, entry);
}

// 使单个缓存失效
export function invalidateCache(key: string, userId?: string): void {
  if (userId) {
    const memKey = getCacheKey(key, userId);
    memoryCache.delete(memKey);
    try {
      localStorage.removeItem(memKey);
    } catch {}
  } else {
    // 如果没有指定 userId，清除所有匹配的缓存
    const keysToRemove: string[] = [];
    memoryCache.forEach((_, k) => {
      if (k.includes(`_${key}`)) {
        keysToRemove.push(k);
      }
    });
    keysToRemove.forEach(k => {
      memoryCache.delete(k);
      try { localStorage.removeItem(k); } catch {}
    });
  }
}

// 清除用户所有缓存
export function clearUserCache(userId: string): void {
  // 内存缓存
  const memKeysToRemove: string[] = [];
  memoryCache.forEach((_, k) => {
    if (k.includes(userId)) {
      memKeysToRemove.push(k);
    }
  });
  memKeysToRemove.forEach(k => memoryCache.delete(k));
  
  // localStorage
  try {
    const storageKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) && key.includes(userId)) {
        storageKeysToRemove.push(key);
      }
    }
    storageKeysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

// 缓存键常量
export const CACHE_KEYS = {
  WORKFLOWS: 'workflows',
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  STATS: 'stats',
  ACTIVITY: 'activity',
  DELETED_WORKFLOWS: 'deleted_workflows',
  DELETED_PROMPTS: 'deleted_prompts',
  PROVIDER_TEMPLATES: 'provider_templates',
  USER_PROVIDERS: 'user_providers',
  NODE_TEMPLATES: 'node_templates',
  WORKFLOW_DETAIL: 'workflow_detail', // 单个工作流详情
} as const;

// 初始化时清理旧版本缓存
clearOldCache();
