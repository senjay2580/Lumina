// 资源文件夹管理
import { supabase } from './supabase';
import { Resource, ResourceType } from './resources';

// 文件夹接口
export interface ResourceFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  resource_type: ResourceType; // 文件夹只能包含此类型的资源
  color: string;
  icon: string;
  position: number;
  archived_at?: string; // 归档时间
  deleted_at?: string; // 软删除时间
  created_at: string;
  updated_at: string;
}

// 资源类型中文名称
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  link: '链接',
  github: 'GitHub',
  document: '文档',
  image: '图片',
  article: '文章'
};

// 检查资源是否可以添加到文件夹
export function canAddResourceToFolder(resource: Resource, folder: ResourceFolder): boolean {
  return resource.type === folder.resource_type;
}

// 检查两个资源是否可以创建文件夹（必须同类型）
export function canCreateFolderFromResources(resource1: Resource, resource2: Resource): boolean {
  return resource1.type === resource2.type;
}

// 文件夹树节点（包含子文件夹）
export interface FolderTreeNode extends ResourceFolder {
  children: FolderTreeNode[];
  resources: Resource[];
}

// 获取用户的所有文件夹
export async function getFolders(userId: string): Promise<ResourceFolder[]> {
  const { data, error } = await supabase
    .from('resource_folders')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
}

// 获取文件夹内的资源
// 获取文件夹资源（支持分页）
export async function getFolderResources(
  folderId: string | null,
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position', { ascending: true });

  if (folderId) {
    query = query.eq('folder_id', folderId);
  } else {
    query = query.is('folder_id', null);
  }

  // 添加分页支持
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// 获取文件夹资源数量（准确统计，不受 1000 条限制）
export async function getFolderResourceCount(
  folderId: string | null,
  userId: string
): Promise<number> {
  let query = supabase
    .from('resources')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null);

  if (folderId) {
    query = query.eq('folder_id', folderId);
  } else {
    query = query.is('folder_id', null);
  }

  const { count, error } = await query;
  if (error) {
    console.error('Failed to get folder resource count:', error);
    return 0;
  }
  return count || 0;
}

// 获取子文件夹 - 简化版本
export async function getSubFolders(
  parentId: string | null,
  userId: string
): Promise<ResourceFolder[]> {
  let query = supabase
    .from('resource_folders')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position', { ascending: true });

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// 创建文件夹
export async function createFolder(
  userId: string,
  resourceType: ResourceType,
  name: string = '新建文件夹',
  parentId: string | null = null,
  color: string = '#6366f1'
): Promise<ResourceFolder> {
  // 获取当前最大 position
  const { data: maxData } = await supabase
    .from('resource_folders')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  
  const nextPosition = (maxData?.position || 0) + 1;

  const { data, error } = await supabase
    .from('resource_folders')
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
      resource_type: resourceType,
      color,
      position: nextPosition
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 通过拖拽两个资源创建文件夹
export async function createFolderFromResources(
  userId: string,
  resourceIds: string[],
  resources: Resource[],
  folderName: string = '新建文件夹'
): Promise<ResourceFolder> {
  // 验证资源类型一致
  if (resources.length < 2) {
    throw new Error('至少需要两个资源来创建文件夹');
  }
  
  const resourceType = resources[0].type;
  const allSameType = resources.every(r => r.type === resourceType);
  
  if (!allSameType) {
    throw new Error('只能将相同类型的资源放入同一文件夹');
  }

  // 1. 创建文件夹（带类型）
  const folder = await createFolder(userId, resourceType, folderName);

  // 2. 将资源移入文件夹
  await moveResourcesToFolder(resourceIds, folder.id);

  return folder;
}

// 更新文件夹
export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<ResourceFolder, 'name' | 'color' | 'icon' | 'parent_id' | 'position'>>
): Promise<ResourceFolder> {
  const { data, error } = await supabase
    .from('resource_folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 删除文件夹（软删除文件夹及其内容到回收站）
export async function deleteFolder(folderId: string): Promise<void> {
  const now = new Date().toISOString();
  
  // 1. 软删除文件夹本身
  const { error } = await supabase
    .from('resource_folders')
    .update({ deleted_at: now })
    .eq('id', folderId);

  if (error) throw error;

  // 2. 软删除文件夹内的所有资源
  await supabase
    .from('resources')
    .update({ deleted_at: now })
    .eq('folder_id', folderId);

  // 3. 递归软删除子文件夹
  const { data: subFolders } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('parent_id', folderId)
    .is('deleted_at', null);
  
  if (subFolders && subFolders.length > 0) {
    for (const sub of subFolders) {
      await deleteFolder(sub.id);
    }
  }
}

// 获取已删除的文件夹
export async function getDeletedFolders(userId: string): Promise<ResourceFolder[]> {
  const { data, error } = await supabase
    .from('resource_folders')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 恢复文件夹（包括其内容）
export async function restoreFolder(folderId: string): Promise<void> {
  // 1. 恢复文件夹本身
  const { error } = await supabase
    .from('resource_folders')
    .update({ deleted_at: null })
    .eq('id', folderId);

  if (error) throw error;

  // 2. 恢复文件夹内的资源
  await supabase
    .from('resources')
    .update({ deleted_at: null })
    .eq('folder_id', folderId);

  // 3. 递归恢复子文件夹
  const { data: subFolders } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('parent_id', folderId)
    .not('deleted_at', 'is', null);
  
  if (subFolders && subFolders.length > 0) {
    for (const sub of subFolders) {
      await restoreFolder(sub.id);
    }
  }
}

// 永久删除文件夹
export async function permanentDeleteFolder(folderId: string): Promise<void> {
  // 1. 永久删除文件夹内的资源
  await supabase
    .from('resources')
    .delete()
    .eq('folder_id', folderId);

  // 2. 递归永久删除子文件夹
  const { data: subFolders } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('parent_id', folderId);
  
  if (subFolders && subFolders.length > 0) {
    for (const sub of subFolders) {
      await permanentDeleteFolder(sub.id);
    }
  }

  // 3. 永久删除文件夹本身
  const { error } = await supabase
    .from('resource_folders')
    .delete()
    .eq('id', folderId);

  if (error) throw error;
}

// 清空文件夹回收站
export async function emptyFolderTrash(userId: string): Promise<void> {
  // 获取所有已删除的文件夹
  const { data: deletedFolders } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (deletedFolders && deletedFolders.length > 0) {
    for (const folder of deletedFolders) {
      await permanentDeleteFolder(folder.id);
    }
  }
}

// 移动资源到文件夹（带类型验证）
export async function moveResourcesToFolder(
  resourceIds: string[],
  folderId: string | null
): Promise<void> {
  // 如果移动到文件夹，需要验证类型
  if (folderId) {
    const { data: folder } = await supabase
      .from('resource_folders')
      .select('resource_type')
      .eq('id', folderId)
      .single();
    
    if (folder) {
      // 获取要移动的资源
      const { data: resources } = await supabase
        .from('resources')
        .select('id, type')
        .in('id', resourceIds);
      
      if (resources) {
        const invalidResources = resources.filter(r => r.type !== folder.resource_type);
        if (invalidResources.length > 0) {
          throw new Error(`只能将 ${RESOURCE_TYPE_LABELS[folder.resource_type as ResourceType]} 类型的资源放入此文件夹`);
        }
      }
    }
  }

  const { error } = await supabase
    .from('resources')
    .update({ folder_id: folderId })
    .in('id', resourceIds);

  if (error) throw error;
}

// 移动单个资源到文件夹（带类型验证）
export async function moveResourceToFolder(
  resourceId: string,
  folderId: string | null
): Promise<void> {
  // 如果移动到文件夹，需要验证类型
  if (folderId) {
    const [{ data: folder }, { data: resource }] = await Promise.all([
      supabase.from('resource_folders').select('resource_type').eq('id', folderId).single(),
      supabase.from('resources').select('type').eq('id', resourceId).single()
    ]);
    
    if (folder && resource && folder.resource_type !== resource.type) {
      throw new Error(`只能将 ${RESOURCE_TYPE_LABELS[folder.resource_type as ResourceType]} 类型的资源放入此文件夹`);
    }
  }

  const { error } = await supabase
    .from('resources')
    .update({ folder_id: folderId })
    .eq('id', resourceId);

  if (error) throw error;
}

// 复制资源到文件夹（Ctrl+拖拽）
export async function copyResourceToFolder(
  resourceId: string,
  folderId: string
): Promise<Resource> {
  // 获取原资源
  const { data: original, error: fetchError } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single();

  if (fetchError || !original) throw fetchError || new Error('资源不存在');

  // 验证类型
  const { data: folder } = await supabase
    .from('resource_folders')
    .select('resource_type')
    .eq('id', folderId)
    .single();

  if (folder && folder.resource_type !== original.type) {
    throw new Error(`只能将 ${RESOURCE_TYPE_LABELS[folder.resource_type as ResourceType]} 类型的资源放入此文件夹`);
  }

  // 创建副本
  const { data: newResource, error: insertError } = await supabase
    .from('resources')
    .insert({
      user_id: original.user_id,
      type: original.type,
      title: `${original.title} (副本)`,
      description: original.description,
      url: original.url,
      storage_path: original.storage_path, // 注意：文件不会被复制，只是引用
      file_name: original.file_name,
      metadata: original.metadata,
      folder_id: folderId
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return newResource;
}

// 移动文件夹到另一个文件夹
export async function moveFolderToFolder(
  folderId: string,
  targetFolderId: string | null
): Promise<void> {
  // 防止循环引用
  if (folderId === targetFolderId) return;

  const { error } = await supabase
    .from('resource_folders')
    .update({ parent_id: targetFolderId })
    .eq('id', folderId);

  if (error) throw error;
}

// 获取文件夹路径（面包屑）
export async function getFolderPath(folderId: string): Promise<ResourceFolder[]> {
  const path: ResourceFolder[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const { data, error } = await supabase
      .from('resource_folders')
      .select('*')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    path.unshift(data);
    currentId = data.parent_id;
  }

  return path;
}

// 检查是否可以移动（防止循环引用）
export async function canMoveFolder(
  folderId: string,
  targetFolderId: string
): Promise<boolean> {
  if (folderId === targetFolderId) return false;

  // 检查目标是否是源的子文件夹
  let currentId: string | null = targetFolderId;
  while (currentId) {
    if (currentId === folderId) return false;

    const { data } = await supabase
      .from('resource_folders')
      .select('parent_id')
      .eq('id', currentId)
      .single();

    currentId = data?.parent_id || null;
  }

  return true;
}

// 归档文件夹
export async function archiveFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('resource_folders')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', folderId);

  if (error) throw error;
}

// 取消归档文件夹
export async function unarchiveFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('resource_folders')
    .update({ archived_at: null })
    .eq('id', folderId);

  if (error) throw error;
}

// 获取已归档的文件夹 - 简化版本
export async function getArchivedFolders(userId: string): Promise<ResourceFolder[]> {
  const { data, error } = await supabase
    .from('resource_folders')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });

  if (error) throw error;
  return data || [];;
}


// 按公众号/订阅源名称自动分类文章
// 返回分类结果统计
export async function autoClassifyArticlesBySource(userId: string): Promise<{
  created: number;  // 新创建的文件夹数
  moved: number;    // 移动的文章数
  skipped: number;  // 跳过的文章数（只有1篇或已在文件夹中）
}> {
  // 1. 获取所有未归档、未删除、不在文件夹中的文章
  const { data: articles, error: articlesError } = await supabase
    .from('resources')
    .select('id, title, metadata')
    .eq('user_id', userId)
    .eq('type', 'article')
    .is('folder_id', null)
    .is('deleted_at', null)
    .is('archived_at', null);

  if (articlesError) throw articlesError;
  if (!articles || articles.length === 0) {
    return { created: 0, moved: 0, skipped: 0 };
  }

  // 2. 按公众号/订阅源名称分组
  const groupedBySource: Record<string, { id: string; title: string }[]> = {};
  for (const article of articles) {
    const sourceName = article.metadata?.subscription_title || article.metadata?.author || '未知来源';
    if (!groupedBySource[sourceName]) {
      groupedBySource[sourceName] = [];
    }
    groupedBySource[sourceName].push({ id: article.id, title: article.title });
  }

  // 3. 获取已存在的文章类型文件夹
  const { data: existingFolders, error: foldersError } = await supabase
    .from('resource_folders')
    .select('id, name')
    .eq('user_id', userId)
    .eq('resource_type', 'article')
    .is('deleted_at', null);

  if (foldersError) throw foldersError;

  // 创建文件夹名称到ID的映射
  const folderNameToId: Record<string, string> = {};
  for (const folder of existingFolders || []) {
    folderNameToId[folder.name] = folder.id;
  }

  let created = 0;
  let moved = 0;
  let skipped = 0;

  // 4. 处理每个分组
  for (const [sourceName, sourceArticles] of Object.entries(groupedBySource)) {
    // 只有1篇文章的来源，跳过不创建文件夹
    if (sourceArticles.length < 2) {
      skipped += sourceArticles.length;
      continue;
    }

    let folderId = folderNameToId[sourceName];

    // 如果文件夹不存在，创建新文件夹
    if (!folderId) {
      const newFolder = await createFolder(userId, 'article', sourceName, null, '#f97316'); // 橙色
      folderId = newFolder.id;
      folderNameToId[sourceName] = folderId;
      created++;
    }

    // 移动文章到文件夹
    const articleIds = sourceArticles.map(a => a.id);
    await moveResourcesToFolder(articleIds, folderId);
    moved += articleIds.length;
  }

  return { created, moved, skipped };
}

// 根据公众号名称查找或创建文件夹
export async function findOrCreateArticleFolder(
  userId: string,
  sourceName: string
): Promise<string | null> {
  if (!sourceName) return null;

  // 查找已存在的文件夹
  const { data: existingFolder } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('resource_type', 'article')
    .eq('name', sourceName)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingFolder) {
    return existingFolder.id;
  }

  // 检查该来源是否有足够的文章（至少2篇）才创建文件夹
  const { count } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'article')
    .eq('metadata->>subscription_title', sourceName)
    .is('deleted_at', null);

  // 如果已有1篇，加上新的就是2篇，可以创建文件夹
  if (count && count >= 1) {
    const newFolder = await createFolder(userId, 'article', sourceName, null, '#f97316');
    return newFolder.id;
  }

  return null;
}

// 将单篇文章归类到对应的公众号文件夹（如果存在）
export async function classifyArticleToFolder(
  userId: string,
  resourceId: string,
  sourceName: string
): Promise<boolean> {
  if (!sourceName) return false;

  // 查找已存在的文件夹
  const { data: existingFolder } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('resource_type', 'article')
    .eq('name', sourceName)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingFolder) {
    await moveResourceToFolder(resourceId, existingFolder.id);
    return true;
  }

  return false;
}
