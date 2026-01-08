// 文件夹卡片组件 - 用于资源列表中显示
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MoreHorizontal, Edit3, Trash2, Check, Archive, ArchiveRestore } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ResourceFolder, updateFolder, archiveFolder, unarchiveFolder, RESOURCE_TYPE_LABELS } from '../lib/resource-folders';
import { FolderIcon, FolderOpenIcon } from './FolderIcon';
import { ConfirmModal, Modal } from './Modal';

interface FolderCardProps {
  folder: ResourceFolder;
  onClick: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  isDragOver?: boolean;
  canDrop?: boolean; // 是否可以放入（类型匹配）
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  // 作为放置目标的拖拽事件
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  // 作为拖拽源的事件
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDrag?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean; // 当前是否正在被拖拽
}

export function FolderCard({
  folder,
  onClick,
  onUpdate,
  onDelete,
  isDragOver = false,
  canDrop = true,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  draggable = false,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging = false
}: FolderCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - 140)
      });
    }
  }, [showMenu]);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await updateFolder(folder.id, { name: editName.trim() });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to update folder:', err);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    // 直接调用回调，让父组件处理删除逻辑（支持乐观更新）
    onDelete();
    setIsDeleting(false);
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(folder.id);
    } else {
      onClick();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // 预览图片 - 不再使用
  // const previewItems = folder.previewItems || [];

  return (
    <>
    <div
      draggable={draggable && !isSelectionMode}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={isDragging ? 'opacity-30' : ''}
    >
      <motion.div
        layout
        initial={false}
        animate={{ 
          opacity: 1, 
          scale: isDragOver ? 1.05 : 1
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        className={`
          relative group rounded-2xl overflow-hidden cursor-pointer transition-all
          ${isDragOver && !canDrop ? 'ring-2 ring-red-400 ring-offset-2' : ''}
          ${!isDragOver ? 'hover:scale-105 hover:drop-shadow-md' : ''}
          ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
        `}
      >
      {/* 选择框 */}
      {isSelectionMode && (
        <div 
          className={`absolute top-1 left-1 z-10 w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-all ${
            isSelected 
              ? 'bg-primary text-white' 
              : 'bg-white hover:bg-gray-50 border border-gray-300'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(folder.id);
          }}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </div>
      )}

      {/* 菜单按钮 */}
      <button
        ref={menuButtonRef}
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-1 right-1 z-10 p-1 rounded-md bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-sm"
      >
        <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
      </button>

      {/* 菜单 */}
      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setIsEditing(true); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> 重命名
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleArchive(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              {folder.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {folder.archived_at ? '取消归档' : '归档'}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true); }}
              className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </motion.div>
        </>,
        document.body
      )}

      {/* 卡片内容 */}
      <div className="pt-3 pb-1 px-1 flex flex-col items-center">
        {/* 文件夹图标 */}
        <div className="relative">
          {isDragOver ? (
            <FolderOpenIcon size={100} />
          ) : (
            <FolderIcon size={100} />
          )}
          
          {/* 拖拽提示 */}
          <AnimatePresence>
            {isDragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap"
              >
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  canDrop 
                    ? 'text-indigo-700 bg-indigo-50' 
                    : 'text-red-700 bg-red-50'
                }`}>
                  {canDrop ? '放入' : `仅限${RESOURCE_TYPE_LABELS[folder.resource_type]}`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 文件夹名称 */}
        <div className="text-center w-full px-1">
          <h3 className="font-medium text-gray-800 text-xs truncate leading-tight">{folder.name}</h3>
          {folder.resource_type && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-50 text-orange-600 mt-0.5 inline-block">
              {RESOURCE_TYPE_LABELS[folder.resource_type]}
            </span>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); onClick(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <MoreHorizontal className="w-3.5 h-3.5" /> 打开
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setIsEditing(true); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> 重命名
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleArchive(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              {folder.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {folder.archived_at ? '取消归档' : '归档'}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button 
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setShowDeleteConfirm(true); }}
              className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </motion.div>
        </>,
        document.body
      )}
    </motion.div>
    </div>

    {/* 删除确认弹窗 - 移到最外层 */}
    <ConfirmModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      title="删除文件夹"
      message={`确定要删除文件夹「${folder.name}」吗？文件夹内的所有资源将被移到回收站。`}
      confirmText="删除"
      cancelText="取消"
      type="danger"
      loading={isDeleting}
    />

    {/* 重命名弹窗 */}
    <Modal isOpen={isEditing} onClose={() => { setIsEditing(false); setEditName(folder.name); }} title="重命名文件夹" size="sm">
      <div className="space-y-4">
        <input
          type="text"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveName()}
          autoFocus
          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="文件夹名称"
        />
        <div className="flex gap-3">
          <button
            onClick={() => { setIsEditing(false); setEditName(folder.name); }}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSaveName}
            disabled={!editName.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}

export default FolderCard;
