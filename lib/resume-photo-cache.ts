// 简历照片缓存管理（localStorage + 一致性处理）

const PHOTO_CACHE_PREFIX = 'resume_photo_';
const PHOTO_CACHE_INDEX = 'resume_photo_index';

export interface PhotoCache {
  creationId: string;
  versionId: string;
  photoData: string; // base64
  timestamp: number;
}

// 获取照片缓存索引
function getPhotoIndex(): Record<string, PhotoCache> {
  try {
    const index = localStorage.getItem(PHOTO_CACHE_INDEX);
    return index ? JSON.parse(index) : {};
  } catch {
    return {};
  }
}

// 保存照片缓存索引
function savePhotoIndex(index: Record<string, PhotoCache>) {
  try {
    localStorage.setItem(PHOTO_CACHE_INDEX, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to save photo index:', error);
  }
}

// 生成缓存键
function getCacheKey(creationId: string, versionId: string): string {
  return `${PHOTO_CACHE_PREFIX}${creationId}_${versionId}`;
}

// 保存照片
export function savePhoto(creationId: string, versionId: string, photoData: string): void {
  const key = getCacheKey(creationId, versionId);
  const cache: PhotoCache = {
    creationId,
    versionId,
    photoData,
    timestamp: Date.now()
  };

  try {
    // 保存照片数据
    localStorage.setItem(key, photoData);
    
    // 更新索引
    const index = getPhotoIndex();
    index[key] = cache;
    savePhotoIndex(index);
  } catch (error) {
    console.error('Failed to save photo:', error);
    // 如果存储空间不足，清理旧照片
    cleanOldPhotos();
    // 重试
    try {
      localStorage.setItem(key, photoData);
      const index = getPhotoIndex();
      index[key] = cache;
      savePhotoIndex(index);
    } catch (retryError) {
      console.error('Failed to save photo after cleanup:', retryError);
    }
  }
}

// 获取照片
export function getPhoto(creationId: string, versionId: string): string | null {
  const key = getCacheKey(creationId, versionId);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// 删除照片
export function deletePhoto(creationId: string, versionId: string): void {
  const key = getCacheKey(creationId, versionId);
  try {
    localStorage.removeItem(key);
    
    // 更新索引
    const index = getPhotoIndex();
    delete index[key];
    savePhotoIndex(index);
  } catch (error) {
    console.error('Failed to delete photo:', error);
  }
}

// 复制照片到新版本
export function copyPhotoToVersion(
  creationId: string,
  sourceVersionId: string,
  targetVersionId: string
): void {
  const photoData = getPhoto(creationId, sourceVersionId);
  if (photoData) {
    savePhoto(creationId, targetVersionId, photoData);
  }
}

// 清理旧照片（保留最近 10 个版本的照片）
function cleanOldPhotos(): void {
  try {
    const index = getPhotoIndex();
    const entries = Object.entries(index);
    
    // 按时间排序
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // 删除旧照片
    entries.slice(10).forEach(([key]) => {
      localStorage.removeItem(key);
      delete index[key];
    });
    
    savePhotoIndex(index);
  } catch (error) {
    console.error('Failed to clean old photos:', error);
  }
}

// 清理指定创作的所有照片
export function cleanCreationPhotos(creationId: string): void {
  try {
    const index = getPhotoIndex();
    Object.entries(index).forEach(([key, cache]) => {
      if (cache.creationId === creationId) {
        localStorage.removeItem(key);
        delete index[key];
      }
    });
    savePhotoIndex(index);
  } catch (error) {
    console.error('Failed to clean creation photos:', error);
  }
}

// 获取缓存统计
export function getCacheStats(): {
  totalPhotos: number;
  totalSize: number;
  photos: PhotoCache[];
} {
  const index = getPhotoIndex();
  const photos = Object.values(index);
  let totalSize = 0;

  photos.forEach(cache => {
    const photoData = localStorage.getItem(getCacheKey(cache.creationId, cache.versionId));
    if (photoData) {
      totalSize += photoData.length;
    }
  });

  return {
    totalPhotos: photos.length,
    totalSize,
    photos
  };
}
