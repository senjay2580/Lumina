// 文件夹视图组�?- 可拖拽窗口样�?
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Edit3,
  Trash2,
  MoreHorizontal,
  Check,
  Home,
  ChevronLeft,
  Maximize2,
  Minimize2,
  LayoutGrid,
  List,
  ExternalLink,
  Link2,
  FileText,
  Newspaper,
  Image as ImageIcon,
  FolderOutput,
  Archive,
  ArchiveRestore,
  Download,
  Copy
} from 'lucide-react';
// @ts-ignore
import { Github } from 'lucide-react';
import { Resource, getFileUrl, deleteResource, archiveResource, unarchiveResource, downloadFile } from '../lib/resources';
import { 
  ResourceFolder, 
  getFolderPath, 
  getSubFolders, 
  getFolderResources,
  updateFolder,
  deleteFolder,
  moveResourceToFolder,
  moveFolderToFolder,
  archiveFolder,
  unarchiveFolder,
  RESOURCE_TYPE_LABELS
} from '../lib/resource-folders';
import { FolderIcon, FolderOpenIcon } from './FolderIcon';
import { ConfirmModal } from './Modal';
import { Tooltip } from './Tooltip';
import { ResourceItemMenu, ContextMenu, menuItemGenerators, MenuItem } from './ResourceItemMenu';

interface FolderViewProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ResourceFolder;
  userId: string;
  onResourceClick?: (resource: Resource) => void;
  onFolderUpdate?: () => void;
}

// 子文件夹行组�?- 带三个点菜单
function SubFolderRow({ 
  folder, 
  onClick, 
  onUpdate,
  onMoveOut
}: { 
  folder: ResourceFolder; 
  onClick: () => void; 
  onUpdate: () => void;
  onMoveOut?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveName = async () => {
    if (!editName.trim() || editName === folder.name) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }
    try {
      await updateFolder(folder.id, { name: editName.trim() });
      onUpdate();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to rename folder:', err);
      setEditName(folder.name);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFolder(folder.id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleArchive = async () => {
    try {
      if (folder.archived_at) {
        await unarchiveFolder(folder.id);
      } else {
        await archiveFolder(folder.id);
      }
      onUpdate();
    } catch (err) {
      console.error('Failed to archive folder:', err);
    }
  };

  const handleMoveOut = async () => {
    try {
      await moveFolderToFolder(folder.id, null);
      onMoveOut?.();
      onUpdate();
    } catch (err) {
      console.error('Failed to move folder out:', err);
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className="grid grid-cols-[1fr_100px_80px] gap-4 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer items-center"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <FolderIcon size={20} />
          </div>
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setIsEditing(false); setEditName(folder.name); }
                }}
                autoFocus
                className="text-sm text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-primary w-32"
              />
              <button onClick={handleSaveName} className="p-0.5 rounded bg-primary text-white"><Check className="w-3 h-3" /></button>
              <button onClick={() => { setIsEditing(false); setEditName(folder.name); }} className="p-0.5 rounded bg-gray-100"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <span className="text-sm text-gray-900 truncate">{folder.name}</span>
            </>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {new Date(folder.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
        </div>
        <div className="text-right" onClick={e => e.stopPropagation()}>
          <button 
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 140) });
              setShowMenu(!showMenu);
            }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 三个点菜�?*/}
      {showMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            className="bg-white rounded-lg shadow-lg border py-1 z-[9999] min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onClick(); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <FolderIcon size={14} /> 打开
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setIsEditing(true); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> 重命�?
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleMoveOut(); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <FolderOutput className="w-3.5 h-3.5" /> 移出文件�?
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleArchive(); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              {folder.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {folder.archived_at ? '取消归档' : '归档'}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true); }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </motion.div>
        </>,
        document.body
      )}

      {/* 删除确认 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="删除文件夹"
        message={`确定要删除文件夹「${folder.name}」吗？`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        loading={isDeleting}
      />
    </>
  );
}

// 子文件夹网格项组件 - 带三个点菜单
function SubFolderGridItem({ 
  folder, 
  onClick, 
  onUpdate,
  onMoveOut
}: { 
  folder: ResourceFolder; 
  onClick: () => void; 
  onUpdate: () => void;
  onMoveOut?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFolder(folder.id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleMoveOut = async () => {
    try {
      await moveFolderToFolder(folder.id, null);
      onMoveOut?.();
      onUpdate();
    } catch (err) {
      console.error('Failed to move folder out:', err);
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className="relative group flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer overflow-hidden"
      >
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
          <FolderIcon size={48} />
        </div>
        <span className="text-xs text-gray-700 mt-1 w-full text-center line-clamp-2 break-all">{folder.name}</span>
        
        {/* 三个点菜单按�?*/}
        <div 
          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-5 h-5 rounded-full bg-white shadow border flex items-center justify-center text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 140) });
              setShowMenu(!showMenu);
            }}
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 三个点菜�?*/}
      {showMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            className="bg-white rounded-lg shadow-lg border py-1 z-[9999] min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onClick(); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <FolderIcon size={14} /> 打开
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleMoveOut(); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <FolderOutput className="w-3.5 h-3.5" /> 移出文件�?
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true); }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </motion.div>
        </>,
        document.body
      )}

      {/* 删除确认 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="删除文件夹"
        message={`确定要删除文件夹「${folder.name}」吗？`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        loading={isDeleting}
      />
    </>
  );
}

export function FolderView({
  isOpen,
  onClose,
  folder: initialFolder,
  userId,
  onResourceClick,
  onFolderUpdate
}: FolderViewProps) {
  const [currentFolder, setCurrentFolder] = useState<ResourceFolder>(initialFolder);
  const [folderPath, setFolderPath] = useState<ResourceFolder[]>([]);
  const [subFolders, setSubFolders] = useState<ResourceFolder[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(initialFolder.name);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 窗口状�?- 居中显示
  const [position, setPosition] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 600) / 2),
    y: Math.max(0, (window.innerHeight - 500) / 2)
  }));
  const [size, setSize] = useState({ width: 600, height: 500 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const savedStateRef = useRef({ 
    position: { 
      x: Math.max(0, (window.innerWidth - 600) / 2), 
      y: Math.max(0, (window.innerHeight - 500) / 2) 
    }, 
    size: { width: 600, height: 500 } 
  });

  // 加载文件夹内�?
  const loadFolderContent = async (folderId: string) => {
    setLoading(true);
    try {
      const [path, folders, items] = await Promise.all([
        getFolderPath(folderId),
        getSubFolders(folderId, userId),
        getFolderResources(folderId, userId)
      ]);
      setFolderPath(path);
      setSubFolders(folders);
      setResources(items);
      if (path.length > 0) {
        setCurrentFolder(path[path.length - 1]);
        setEditName(path[path.length - 1].name);
      }
    } catch (err) {
      console.error('Failed to load folder content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // 每次打开时重新计算居中位�?
      const centerX = Math.max(0, (window.innerWidth - size.width) / 2);
      const centerY = Math.max(0, (window.innerHeight - size.height) / 2);
      setPosition({ x: centerX, y: centerY });
      setIsMaximized(false);
      loadFolderContent(initialFolder.id);
    }
  }, [isOpen, initialFolder.id]);

  // 拖拽处理
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(0, dragStartRef.current.posX + dx),
        y: Math.max(0, dragStartRef.current.posY + dy),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 缩放处理
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;
      let newX = resizeStartRef.current.posX;
      let newY = resizeStartRef.current.posY;

      if (isResizing.includes('e')) newWidth = Math.max(400, resizeStartRef.current.width + dx);
      if (isResizing.includes('w')) {
        newWidth = Math.max(400, resizeStartRef.current.width - dx);
        newX = resizeStartRef.current.posX + (resizeStartRef.current.width - newWidth);
      }
      if (isResizing.includes('s')) newHeight = Math.max(300, resizeStartRef.current.height + dy);
      if (isResizing.includes('n')) {
        newHeight = Math.max(300, resizeStartRef.current.height - dy);
        newY = resizeStartRef.current.posY + (resizeStartRef.current.height - newHeight);
      }
      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    setIsDragging(true);
  };

  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      width: size.width, height: size.height,
      posX: position.x, posY: position.y,
    };
    setIsResizing(direction);
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(savedStateRef.current.position);
      setSize(savedStateRef.current.size);
    } else {
      savedStateRef.current = { position, size };
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    setIsMaximized(!isMaximized);
  };

  const navigateUp = () => {
    if (folderPath.length > 1) {
      loadFolderContent(folderPath[folderPath.length - 2].id);
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await updateFolder(currentFolder.id, { name: editName.trim() });
      setCurrentFolder({ ...currentFolder, name: editName.trim() });
      setIsEditing(false);
      onFolderUpdate?.();
    } catch (err) {
      console.error('Failed to update folder name:', err);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFolder(currentFolder.id);
      // 先关闭确认弹窗和文件夹视图，再触发更�?
      setShowDeleteConfirm(false);
      onClose();
      // 延迟触发更新，避免动画冲�?
      setTimeout(() => {
        onFolderUpdate?.();
      }, 100);
    } catch (err) {
      console.error('Failed to delete folder:', err);
      setIsDeleting(false);
    }
  };

  const handleMoveOut = async (resourceId: string) => {
    // 乐观更新
    const originalResources = [...resources];
    setResources(prev => prev.filter(r => r.id !== resourceId));
    
    try {
      await moveResourceToFolder(resourceId, null);
      onFolderUpdate?.();
    } catch (err) {
      // 回滚
      setResources(originalResources);
      console.error('Failed to move resource:', err);
    }
  };

  // 删除资源（软删除到回收站�? 乐观更新
  const handleDeleteResource = async (resourceId: string) => {
    // 乐观更新
    const originalResources = [...resources];
    setResources(prev => prev.filter(r => r.id !== resourceId));
    
    try {
      await deleteResource(resourceId);
      onFolderUpdate?.();
    } catch (err) {
      // 回滚
      setResources(originalResources);
      console.error('Failed to delete resource:', err);
    }
  };

  // 归档/取消归档资源 - 乐观更新
  const handleArchiveResource = async (resource: Resource) => {
    // 乐观更新
    const originalResources = [...resources];
    setResources(prev => prev.map(r => 
      r.id === resource.id 
        ? { ...r, archived_at: resource.archived_at ? undefined : new Date().toISOString() }
        : r
    ));
    
    try {
      if (resource.archived_at) {
        await unarchiveResource(resource.id);
      } else {
        await archiveResource(resource.id);
      }
      onFolderUpdate?.();
    } catch (err) {
      // 回滚
      setResources(originalResources);
      console.error('Failed to archive resource:', err);
    }
  };

  // 下载资源
  const handleDownloadResource = async (resource: Resource) => {
    if (resource.storage_path && resource.file_name) {
      try {
        await downloadFile(resource.storage_path, resource.file_name);
      } catch (err) {
        console.error('Failed to download:', err);
      }
    }
  };

  // 生成资源菜单�?
  const getResourceMenuItems = (resource: Resource): MenuItem[] => [
    menuItemGenerators.open(() => onResourceClick?.(resource)),
    menuItemGenerators.moveOut(() => handleMoveOut(resource.id)),
    {
      ...menuItemGenerators.download(() => handleDownloadResource(resource)),
      hidden: !resource.storage_path
    },
    menuItemGenerators.archive(() => handleArchiveResource(resource), !!resource.archived_at),
    menuItemGenerators.delete(() => handleDeleteResource(resource.id))
  ];

  if (!isOpen) return null;
  const totalItems = subFolders.length + resources.length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[999]"
            onClick={onClose}
          />
          
          {/* 窗口 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
              zIndex: 1000,
            }}
            className="flex flex-col rounded-xl shadow-2xl overflow-hidden bg-white border border-gray-200"
          >
            {/* 标题�?*/}
            <div
              className="flex items-center h-10 px-3 bg-gray-100 border-b border-gray-200 select-none"
              onMouseDown={handleDragStart}
              onDoubleClick={toggleMaximize}
            >
              {/* 左侧导航 */}
              <div className="flex items-center gap-1">
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500" title="返回">
                  <Home className="w-4 h-4" />
                </button>
                <button
                  onClick={navigateUp}
                  disabled={folderPath.length <= 1}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-30"
                  title="返回上级"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* 标题 */}
              <div className="flex-1 text-center text-sm font-medium text-gray-700 truncate px-4">
                {currentFolder.name}
              </div>

              {/* 右侧控制 */}
              <div className="flex items-center gap-1">
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-10">
                      <button onClick={() => { setShowMenu(false); setIsEditing(true); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5" /> 重命�?
                      </button>
                      <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> 删除
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={toggleMaximize} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 文件夹信�?*/}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <FolderOpenIcon size={40} />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        autoFocus
                        className="text-base font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-primary"
                      />
                      <button onClick={handleSaveName} className="p-1 rounded bg-primary text-white"><Check className="w-4 h-4" /></button>
                      <button onClick={() => { setIsEditing(false); setEditName(currentFolder.name); }} className="p-1 rounded bg-gray-100"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <h2 className="text-base font-semibold text-gray-900 cursor-pointer hover:text-primary" onClick={() => setIsEditing(true)}>
                      {currentFolder.name}
                    </h2>
                  )}
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{totalItems} 个项目</span>
                    {currentFolder.resource_type && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        仅限 {RESOURCE_TYPE_LABELS[currentFolder.resource_type]}
                      </span>
                    )}
                  </p>
                </div>
                {/* 视图切换 */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <Tooltip content="网格视图">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="列表视图">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-all ${
                        viewMode === 'list' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : totalItems === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FolderOpenIcon size={64} />
                  <p className="text-gray-500 mt-3 text-sm">文件夹为空</p>
                  <p className="text-gray-400 text-xs mt-1">拖拽资源到此文件夹</p>
                </div>
              ) : viewMode === 'list' ? (
                /* 列表视图 */
                <div className="border-t border-gray-100">
                  {/* 列表头部 */}
                  <div className="grid grid-cols-[1fr_100px_80px] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
                    <div>名称</div>
                    <div>日期</div>
                    <div className="text-right">操作</div>
                  </div>
                  {/* 子文件夹 */}
                  {subFolders.map(sub => (
                    <SubFolderRow 
                      key={sub.id} 
                      folder={sub} 
                      onClick={() => loadFolderContent(sub.id)}
                      onUpdate={() => loadFolderContent(currentFolder.id)}
                      onMoveOut={onFolderUpdate}
                    />
                  ))}
                  {/* 资源 */}
                  {resources.map(resource => (
                    <div
                      key={resource.id}
                      className="group grid grid-cols-[1fr_100px_80px] gap-4 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer items-center"
                      onClick={() => onResourceClick?.(resource)}
                    >
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        {resource.type === 'image' && resource.storage_path ? (
                          <img src={getFileUrl(resource.storage_path)} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                        ) : resource.type === 'github' ? (
                          <Github className="w-4 h-4 text-gray-700 flex-shrink-0" />
                        ) : resource.type === 'document' ? (
                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        ) : resource.type === 'article' ? (
                          <Newspaper className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        ) : resource.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        ) : (
                          <Link2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        <Tooltip content={resource.title}>
                          <span className="text-sm text-gray-900 truncate">{resource.title}</span>
                        </Tooltip>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(resource.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center justify-end">
                        <ResourceItemMenu items={getResourceMenuItems(resource)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 网格视图 */
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-4">
                  {/* 子文件夹 */}
                  {subFolders.map(sub => (
                    <SubFolderGridItem
                      key={sub.id}
                      folder={sub}
                      onClick={() => loadFolderContent(sub.id)}
                      onUpdate={() => loadFolderContent(currentFolder.id)}
                      onMoveOut={onFolderUpdate}
                    />
                  ))}
                  {/* 资源 */}
                  {resources.map(resource => (
                    <div
                      key={resource.id}
                      className="relative group flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer overflow-hidden"
                      onClick={() => onResourceClick?.(resource)}
                    >
                      {resource.type === 'image' && resource.storage_path ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img src={getFileUrl(resource.storage_path)} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {resource.type === 'github' ? (
                            <Github className="w-6 h-6 text-gray-700" />
                          ) : resource.type === 'document' ? (
                            <FileText className="w-6 h-6 text-blue-500" />
                          ) : resource.type === 'article' ? (
                            <Newspaper className="w-6 h-6 text-orange-500" />
                          ) : resource.type === 'image' ? (
                            <ImageIcon className="w-6 h-6 text-cyan-500" />
                          ) : (
                            <Link2 className="w-6 h-6 text-green-500" />
                          )}
                        </div>
                      )}
                      <Tooltip content={resource.title}>
                        <span className="text-xs text-gray-700 mt-1 w-full text-center line-clamp-2 break-all">{resource.title}</span>
                      </Tooltip>
                      {/* 三个点菜单 */}
                      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100">
                        <ResourceItemMenu 
                          items={getResourceMenuItems(resource)}
                          buttonClassName="w-5 h-5 rounded-full bg-white shadow border flex items-center justify-center text-gray-400 hover:text-gray-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 缩放边框 */}
            {!isMaximized && (
              <>
                <div className="absolute top-0 left-0 right-0 h-1 cursor-n-resize" onMouseDown={handleResizeStart('n')} />
                <div className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize" onMouseDown={handleResizeStart('s')} />
                <div className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize" onMouseDown={handleResizeStart('w')} />
                <div className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize" onMouseDown={handleResizeStart('e')} />
                <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onMouseDown={handleResizeStart('nw')} />
                <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onMouseDown={handleResizeStart('ne')} />
                <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onMouseDown={handleResizeStart('sw')} />
                <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={handleResizeStart('se')} />
              </>
            )}
          </motion.div>

          {/* 删除确认弹窗 */}
          <ConfirmModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="删除文件夹"
            message={`确定要删除文件夹「${currentFolder.name}」吗？文件夹内的所有资源将被移到回收站。`}
            confirmText="删除"
            cancelText="取消"
            type="danger"
            loading={isDeleting}
          />
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default FolderView;
