// 资源拖拽 Hook - 支持拖拽创建文件夹、嵌套文件夹、移动/复制资源
// 使用乐观更新实现快速响应
import { useState, useCallback, useRef } from 'react';
import { Resource } from './resources';
import { 
  ResourceFolder, 
  createFolderFromResources, 
  moveResourceToFolder,
  copyResourceToFolder,
  moveFolderToFolder,
  canCreateFolderFromResources,
  canAddResourceToFolder,
  RESOURCE_TYPE_LABELS
} from './resource-folders';

export interface DragState {
  isDragging: boolean;
  draggedResource: Resource | null;
  draggedFolder: ResourceFolder | null;
  dragPosition: { x: number; y: number };
  dropTarget: {
    type: 'resource' | 'folder' | null;
    id: string | null;
    resource?: Resource;
    folder?: ResourceFolder;
  };
  showFolderPreview: boolean;
  canDrop: boolean;
  dropError?: string;
  isCopyMode: boolean;
}

export interface UseResourceDragOptions {
  userId: string;
  resources: Resource[];
  folders: ResourceFolder[];
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
  setFolders: React.Dispatch<React.SetStateAction<ResourceFolder[]>>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRefresh?: () => void;
}

export function useResourceDrag({ 
  userId, 
  resources,
  folders,
  setResources,
  setFolders,
  onSuccess,
  onError,
  onRefresh
}: UseResourceDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedResource: null,
    draggedFolder: null,
    dragPosition: { x: 0, y: 0 },
    dropTarget: { type: null, id: null },
    showFolderPreview: false,
    canDrop: false,
    isCopyMode: false
  });

  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 保存原始数据用于回滚
  const rollbackDataRef = useRef<{ resources: Resource[]; folders: ResourceFolder[] } | null>(null);

  // 开始拖拽资源
  const handleDragStart = useCallback((resource: Resource, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', resource.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    
    // 隐藏默认拖拽图像
    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    setDragState({
      isDragging: true,
      draggedResource: resource,
      draggedFolder: null,
      dragPosition: { x: e.clientX, y: e.clientY },
      dropTarget: { type: null, id: null },
      showFolderPreview: false,
      canDrop: false,
      isCopyMode: e.ctrlKey || e.metaKey
    });
  }, []);

  // 开始拖拽文件夹
  const handleFolderDragStart = useCallback((folder: ResourceFolder, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    
    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    setDragState({
      isDragging: true,
      draggedResource: null,
      draggedFolder: folder,
      dragPosition: { x: e.clientX, y: e.clientY },
      dropTarget: { type: null, id: null },
      showFolderPreview: false,
      canDrop: false,
      isCopyMode: false
    });
  }, []);

  // 拖拽移动
  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    
    const isCopy = e.ctrlKey || e.metaKey;
    setDragState(prev => ({
      ...prev,
      dragPosition: { x: e.clientX, y: e.clientY },
      isCopyMode: prev.draggedResource ? isCopy : false
    }));
  }, []);

  // 拖拽进入资源卡片 - 同步操作，无延迟
  const handleDragEnterResource = useCallback((targetResource: Resource) => {
    setDragState(prev => {
      if (!prev.draggedResource || prev.draggedResource.id === targetResource.id) {
        return prev;
      }

      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }

      const canCreate = canCreateFolderFromResources(prev.draggedResource, targetResource);
      const dropError = canCreate 
        ? undefined 
        : `不能将 ${RESOURCE_TYPE_LABELS[prev.draggedResource.type]} 和 ${RESOURCE_TYPE_LABELS[targetResource.type]} 放入同一文件夹`;

      // 立即显示预览，不用延迟
      return {
        ...prev,
        dropTarget: { type: 'resource', id: targetResource.id, resource: targetResource },
        showFolderPreview: canCreate,
        canDrop: canCreate,
        dropError
      };
    });
  }, []);

  // 拖拽进入文件夹 - 同步操作，无延迟
  const handleDragEnterFolder = useCallback((folder: ResourceFolder) => {
    setDragState(prev => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }

      // 拖拽资源到文件夹
      if (prev.draggedResource) {
        const canAdd = canAddResourceToFolder(prev.draggedResource, folder);
        return {
          ...prev,
          dropTarget: { type: 'folder', id: folder.id, folder },
          showFolderPreview: false,
          canDrop: canAdd,
          dropError: canAdd ? undefined : `此文件夹只能放入 ${RESOURCE_TYPE_LABELS[folder.resource_type]} 类型的资源`
        };
      }

      // 拖拽文件夹到文件夹
      if (prev.draggedFolder) {
        if (prev.draggedFolder.id === folder.id) {
          return {
            ...prev,
            dropTarget: { type: 'folder', id: folder.id, folder },
            showFolderPreview: false,
            canDrop: false,
            dropError: '不能将文件夹放入自身'
          };
        }

        if (prev.draggedFolder.resource_type !== folder.resource_type) {
          return {
            ...prev,
            dropTarget: { type: 'folder', id: folder.id, folder },
            showFolderPreview: false,
            canDrop: false,
            dropError: `只能将 ${RESOURCE_TYPE_LABELS[folder.resource_type]} 类型的文件夹放入此文件夹`
          };
        }

        // 简化检查：只检查直接父子关系，不做深度检查
        const isChild = prev.draggedFolder.parent_id === folder.id;
        return {
          ...prev,
          dropTarget: { type: 'folder', id: folder.id, folder },
          showFolderPreview: false,
          canDrop: !isChild,
          dropError: isChild ? '不能将文件夹放入其子文件夹中' : undefined
        };
      }

      return {
        ...prev,
        dropTarget: { type: 'folder', id: folder.id, folder },
        showFolderPreview: false,
        canDrop: false
      };
    });
  }, []);

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    setDragState(prev => ({
      ...prev,
      dropTarget: { type: null, id: null },
      showFolderPreview: false,
      canDrop: false,
      dropError: undefined
    }));
  }, []);

  // 重置拖拽状态
  const resetDragState = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    setDragState({
      isDragging: false,
      draggedResource: null,
      draggedFolder: null,
      dragPosition: { x: 0, y: 0 },
      dropTarget: { type: null, id: null },
      showFolderPreview: false,
      canDrop: false,
      dropError: undefined,
      isCopyMode: false
    });
  }, []);

  // 回滚数据
  const rollback = useCallback(() => {
    if (rollbackDataRef.current) {
      setResources(rollbackDataRef.current.resources);
      setFolders(rollbackDataRef.current.folders);
      rollbackDataRef.current = null;
    }
  }, [setResources, setFolders]);

  // 放下 - 乐观更新
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    const { draggedResource, draggedFolder, dropTarget, canDrop, isCopyMode } = dragState;

    if ((!draggedResource && !draggedFolder) || !canDrop) {
      resetDragState();
      return;
    }

    // 保存回滚数据
    rollbackDataRef.current = { resources: [...resources], folders: [...folders] };

    try {
      // 拖拽资源
      if (draggedResource) {
        // 放到资源上 - 创建文件夹
        if (dropTarget.type === 'resource' && dropTarget.resource) {
          // 创建临时文件夹用于乐观更新
          const tempFolderId = `temp-${Date.now()}`;
          const tempFolder: ResourceFolder = {
            id: tempFolderId,
            user_id: userId,
            name: '新建文件夹',
            resource_type: draggedResource.type,
            parent_id: null,
            color: null,
            icon: null,
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // 乐观更新：立即从列表移除两个资源，添加临时文件夹
          setResources(prev => prev.filter(r => 
            r.id !== draggedResource.id && r.id !== dropTarget.resource!.id
          ));
          setFolders(prev => [tempFolder, ...prev]);
          
          resetDragState();
          
          // 异步创建文件夹
          try {
            const folder = await createFolderFromResources(
              userId,
              [draggedResource.id, dropTarget.resource.id],
              [draggedResource, dropTarget.resource],
              '新建文件夹'
            );
            
            // 用真实文件夹替换临时文件夹
            setFolders(prev => prev.map(f => f.id === tempFolderId ? folder : f));
            onSuccess?.('文件夹已创建');
          } catch (err) {
            console.error('Create folder failed:', err);
            // 回滚：移除临时文件夹，恢复资源
            rollback();
            onError?.('创建文件夹失败');
          }
          return;
        }
        
        // 放到文件夹上 - 移动或复制
        if (dropTarget.type === 'folder' && dropTarget.folder) {
          if (isCopyMode) {
            // 复制模式
            resetDragState();
            await copyResourceToFolder(draggedResource.id, dropTarget.folder.id);
            onSuccess?.('已复制到文件夹');
            onRefresh?.();
          } else {
            // 移动模式 - 乐观更新：从资源列表移除
            setResources(prev => prev.filter(r => r.id !== draggedResource.id));
            resetDragState();
            await moveResourceToFolder(draggedResource.id, dropTarget.folder.id);
            onSuccess?.('已移入文件夹');
          }
          return;
        }
      }
      
      // 拖拽文件夹
      if (draggedFolder && dropTarget.type === 'folder' && dropTarget.folder) {
        // 乐观更新：从列表移除
        setFolders(prev => prev.filter(f => f.id !== draggedFolder.id));
        
        resetDragState();
        
        // 异步移动
        await moveFolderToFolder(draggedFolder.id, dropTarget.folder.id);
        onSuccess?.('文件夹已移动');
        return;
      }
    } catch (err) {
      console.error('Drop operation failed:', err);
      rollback();
      onError?.('操作失败');
    }

    resetDragState();
  }, [dragState, userId, resources, folders, setResources, setFolders, resetDragState, rollback, onSuccess, onError, onRefresh]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  return {
    dragState,
    handleDragStart,
    handleFolderDragStart,
    handleDrag,
    handleDragEnterResource,
    handleDragEnterFolder,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    resetDragState
  };
}

export default useResourceDrag;
