// 资源中心页面
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen,
  Link2,
  Image,
  Upload,
  Search,
  Plus,
  Star,
  GitFork,
  Clock,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Edit3,
  Copy,
  X,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  Archive,
  ArchiveRestore,
  Download,
  FileText
} from 'lucide-react';
// @ts-ignore - Github is deprecated but still works
import { Github } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import {
  Resource,
  ResourceType,
  ResourceStats,
  getResources,
  getResourceStats,
  createLinkResource,
  uploadFileResource,
  deleteResource,
  updateResource,
  getFileUrl,
  archiveResource,
  unarchiveResource,
  downloadFile,
  canOpenInViewer
} from '../lib/resources';

import { ResourceViewerHook } from '../lib/useResourceViewer';

// 类型配置
type FilterType = 'all' | ResourceType;

const typeConfig: Record<FilterType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  all: { label: '全部', icon: FolderOpen, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  link: { label: '链接', icon: Link2, color: 'text-green-600', bgColor: 'bg-green-50' },
  github: { label: 'GitHub', icon: Github, color: 'text-gray-700', bgColor: 'bg-gray-100' },
  document: { label: '文档', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  image: { label: '图片', icon: Image, color: 'text-cyan-600', bgColor: 'bg-cyan-50' }
};

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
  return num.toString();
};

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

interface Props {
  userId?: string;
  resourceViewer?: ResourceViewerHook;
}

export default function ResourceCenterPage({ userId, resourceViewer }: Props) {
  const [activeType, setActiveType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<ResourceStats>({ all: 0, link: 0, github: 0, document: 0, image: 0 });
  const [loading, setLoading] = useState(true);
  const [addInputValue, setAddInputValue] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [showDescInput, setShowDescInput] = useState(false);
  const [isDraggingOnInput, setIsDraggingOnInput] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [downloadConfirm, setDownloadConfirm] = useState<{
    fileName: string;
    reason: string;
    onConfirm: () => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast 提示
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // 下载确认
  const handleConfirmDownload = useCallback((fileName: string, reason: string, onConfirm: () => void) => {
    setDownloadConfirm({ fileName, reason, onConfirm });
  }, []);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const [resourcesData, statsData] = await Promise.all([
        getResources(userId, activeType === 'all' ? undefined : activeType, showArchived),
        getResourceStats(userId, showArchived)
      ]);
      setResources(resourcesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeType, showArchived]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤资源
  const filteredResources = resources.filter(r => {
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // 添加链接资源
  const handleAddLink = async () => {
    if (!userId || !addInputValue.trim()) return;
    
    setIsAdding(true);
    try {
      await createLinkResource(userId, addInputValue.trim(), addDescription.trim() || undefined);
      setAddInputValue('');
      setAddDescription('');
      setShowDescInput(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add resource:', err);
    } finally {
      setIsAdding(false);
    }
  };

  // 上传文件
  const handleFileUpload = async (files: FileList | null) => {
    if (!userId || !files || files.length === 0) return;
    
    setIsAdding(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFileResource(userId, file, addDescription.trim() || undefined);
      }
      setAddDescription('');
      setShowDescInput(false);
      await loadData();
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setIsAdding(false);
    }
  };

  // 删除资源
  const handleDelete = async (resourceId: string) => {
    try {
      await deleteResource(resourceId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOnInput(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // 粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // 生成文件名：paste_时间戳.扩展名
          const ext = item.type.split('/')[1] || 'png';
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const newFile = new File([file], `paste_${timestamp}.${ext}`, { type: item.type });
          imageFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault(); // 阻止默认粘贴行为
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(f => dataTransfer.items.add(f));
      handleFileUpload(dataTransfer.files);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">资源中心</h1>
            <p className="text-gray-500 text-sm">管理你的资源库</p>
          </div>
        </div>

        {/* 统一添加资源入口 */}
        <div 
          className={`mb-8 p-1 rounded-2xl transition-all ${
            isDraggingOnInput 
              ? 'bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20' 
              : 'bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDraggingOnInput(true); }}
          onDragLeave={() => setIsDraggingOnInput(false)}
          onDrop={handleDrop}
        >
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Plus className={`w-5 h-5 ${isDraggingOnInput ? 'text-primary' : 'text-gray-400'}`} />
                </div>
                <input
                  type="text"
                  placeholder="粘贴链接或图片、拖拽文件，或输入 GitHub 仓库地址..."
                  value={addInputValue}
                  onChange={e => setAddInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                  onPaste={handlePaste}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 focus:border-primary focus:bg-white focus:border-solid outline-none transition-all text-sm"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.json"
                onChange={e => handleFileUpload(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAdding}
                className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all flex items-center gap-2 text-gray-600 text-sm font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                上传文件
              </button>
              <button
                onClick={handleAddLink}
                disabled={!addInputValue.trim() || isAdding}
                className="px-6 py-3.5 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : '添加'}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <button
                onClick={() => setShowDescInput(!showDescInput)}
                className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors"
              >
                {showDescInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                添加描述
              </button>
              <span className="flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5" />
                GitHub 项目
              </span>
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                网页链接
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                文档
              </span>
              <span className="flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" />
                图片
              </span>
            </div>
            
            {/* 可折叠的描述输入框 - 预留高度避免滚动条 */}
            <div style={{ minHeight: showDescInput ? 76 : 0 }} className="transition-all duration-200">
              <AnimatePresence initial={false}>
                {showDescInput && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <textarea
                      placeholder="添加描述（可选）..."
                      value={addDescription}
                      onChange={e => setAddDescription(e.target.value)}
                      rows={2}
                      className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:border-primary focus:bg-white outline-none transition-all text-sm resize-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* 类型统计卡片 */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {(Object.keys(typeConfig) as FilterType[]).map(type => {
            const config = typeConfig[type];
            const Icon = config.icon;
            const count = stats[type] || 0;
            const isActive = activeType === type;
            
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  isActive
                    ? 'bg-white border-primary shadow-lg shadow-primary/10'
                    : 'bg-white border-transparent hover:border-gray-200 hover:shadow-md'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-primary/10' : config.bgColor
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : config.color}`} />
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${isActive ? 'text-primary' : 'text-gray-900'}`}>{count}</div>
                  <div className="text-xs text-gray-500">{config.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 搜索 */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索资源..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
              showArchived 
                ? 'bg-primary text-white border-primary' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? '已归档' : '归档'}
          </button>
        </div>

        {/* 资源列表 */}
        <div className="min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                {showArchived ? (
                  <Archive className="w-8 h-8 text-gray-400" />
                ) : (
                  <FolderOpen className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <p className="text-gray-500 mb-2">
                {showArchived ? '暂无归档资源' : '暂无资源'}
              </p>
              <p className="text-gray-400 text-sm">
                {showArchived ? '归档的资源会显示在这里' : '粘贴链接或上传文件添加资源'}
              </p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              <AnimatePresence>
                {filteredResources.map((resource) => (
                  <ResourceCard 
                    key={resource.id} 
                    resource={resource} 
                    onDelete={handleDelete}
                    onUpdate={loadData}
                    onOpenInViewer={resourceViewer?.openResource}
                    onShowToast={showToast}
                    onConfirmDownload={handleConfirmDownload}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Toast 提示 */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-lg z-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 下载确认弹窗 - Portal 到 body */}
      {downloadConfirm && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setDownloadConfirm(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          >
            <div className="p-5">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">无法预览此文件</h3>
              <p className="text-sm text-gray-500 text-center mb-1">{downloadConfirm.reason}</p>
              <p className="text-xs text-gray-400 text-center mb-4 truncate px-4">
                {downloadConfirm.fileName}
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setDownloadConfirm(null)}
                className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <div className="w-px bg-gray-100" />
              <button
                onClick={() => {
                  downloadConfirm.onConfirm();
                  setDownloadConfirm(null);
                }}
                className="flex-1 py-3 text-sm text-primary font-medium hover:bg-orange-50 transition-colors"
              >
                下载文件
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}

// 卡片菜单组件
interface CardMenuProps {
  dark?: boolean;
  resource: Resource;
  canPreview: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDownload?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function CardMenu({ dark = false, resource, canPreview, onOpen, onEdit, onDownload, onArchive, onDelete }: CardMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, showAbove: false });
  const isArchived = !!resource.archived_at;
  const isFile = !!resource.storage_path;
  // 链接和 GitHub 类型始终可以打开（在新标签页）
  const showOpenButton = canPreview || resource.type === 'link' || resource.type === 'github';

  // 计算菜单项数量来估算菜单高度
  const menuItemCount = (showOpenButton ? 1 : 0) + 1 + 1 + (isFile && onDownload ? 1 : 0) + 1 + 1; // 打开、编辑、复制、下载、归档、删除
  const estimatedMenuHeight = menuItemCount * 36 + 16; // 每项约36px + padding

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // 如果下方空间不够且上方空间更大，则显示在上方
      const showAbove = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      
      setMenuPosition({
        top: showAbove ? rect.top - estimatedMenuHeight : rect.bottom + 4,
        left: Math.max(8, rect.right - 120), // 确保不超出左边界
        showAbove
      });
    }
  }, [showMenu, estimatedMenuHeight]);

  // 复制链接
  const handleCopy = async () => {
    const textToCopy = resource.url || (resource.storage_path ? getFileUrl(resource.storage_path) : resource.title);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
          dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
        }`}
      >
        <MoreHorizontal className={`w-4 h-4 ${dark ? 'text-gray-400' : 'text-gray-400'}`} />
      </button>
      
      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            {showOpenButton && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onOpen(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> 编辑
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制'}
            </button>
            {isFile && onDownload && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDownload(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> 下载
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onArchive(); }}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            >
              {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {isArchived ? '取消归档' : '归档'}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(); }}
              className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
}

// 资源卡片组件
function ResourceCard({ resource, onDelete, onUpdate, onOpenInViewer, onShowToast, onConfirmDownload }: { 
  resource: Resource; 
  onDelete: (id: string) => void;
  onUpdate: () => void;
  onOpenInViewer?: (resource: Resource, url: string) => void;
  onShowToast?: (message: string) => void;
  onConfirmDownload?: (fileName: string, reason: string, onConfirm: () => void) => void;
}) {
  const config = typeConfig[resource.type] || typeConfig.link;
  const Icon = config.icon;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(resource.title);
  const [editDescription, setEditDescription] = useState(resource.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 检查是否可预览
  const previewInfo = canOpenInViewer(resource);

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // 打开资源
  const handleOpen = async () => {
    // 可预览的文件，在内置预览器中打开
    if (previewInfo.canPreview && resource.storage_path && onOpenInViewer) {
      const url = getFileUrl(resource.storage_path);
      onOpenInViewer(resource, url);
      return;
    }
    
    // 不可预览的文件（或没有预览器），弹出确认框下载
    if (resource.storage_path && resource.file_name && !previewInfo.canPreview) {
      const doDownload = async () => {
        try {
          await downloadFile(resource.storage_path!, resource.file_name!);
        } catch (err) {
          console.error('Failed to download:', err);
        }
      };

      if (onConfirmDownload) {
        const reason = previewInfo.reason || '此文件类型不支持在线预览';
        onConfirmDownload(resource.file_name, reason, doDownload);
      } else {
        await doDownload();
      }
      return;
    }
    
    // 链接类型，在新标签页打开
    if (resource.url) {
      window.open(resource.url, '_blank');
    }
  };

  // 归档/取消归档
  const handleArchive = async () => {
    try {
      if (resource.archived_at) {
        await unarchiveResource(resource.id);
      } else {
        await archiveResource(resource.id);
      }
      onUpdate();
    } catch (err) {
      console.error('Failed to archive resource:', err);
    }
  };

  // 下载文件
  const handleDownload = async () => {
    if (resource.storage_path && resource.file_name) {
      try {
        await downloadFile(resource.storage_path, resource.file_name);
      } catch (err) {
        console.error('Failed to download file:', err);
      }
    }
  };

  // 保存编辑
  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      await updateResource(resource.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to update resource:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 编辑弹窗
  const EditModal = () => (
    createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsEditing(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">编辑资源</h3>
            <button onClick={() => setIsEditing(false)} className="p-1 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!editTitle.trim() || isSaving}
              className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    )
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="break-inside-avoid mb-4"
    >
      {isEditing && <EditModal />}
      
      {/* GitHub 项目卡片 */}
      {resource.type === 'github' ? (
        <div 
          className="rounded-2xl overflow-hidden relative group border border-[#30363d] cursor-pointer"
          style={{ background: 'linear-gradient(145deg, #161b22 0%, #0d1117 100%)' }}
          onClick={handleOpen}
          onContextMenu={handleContextMenu}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Github className="w-5 h-5 text-[#8b949e] flex-shrink-0" />
                <span className="font-semibold text-[#e6edf3] text-sm hover:text-[#58a6ff] transition-colors truncate">
                  {resource.title}
                </span>
              </div>
              <CardMenu 
                dark 
                resource={resource}
                canPreview={previewInfo.canPreview}
                onOpen={handleOpen}
                onEdit={() => setIsEditing(true)}
                onDownload={resource.storage_path ? handleDownload : undefined}
                onArchive={handleArchive}
                onDelete={() => onDelete(resource.id)} 
              />
            </div>
            
            {/* 项目描述 */}
            {resource.description && (
              <p className="text-sm text-[#8b949e] mb-3 line-clamp-2 leading-relaxed">{resource.description}</p>
            )}
            
            {/* 统计信息 */}
            <div className="flex items-center gap-4 text-xs mb-3">
              {resource.metadata?.stars !== undefined && (
                <span className="flex items-center gap-1.5 text-[#8b949e]">
                  <Star className="w-4 h-4 text-[#e3b341]" />
                  <span className="text-[#e6edf3] font-medium">{formatNumber(resource.metadata.stars)}</span>
                </span>
              )}
              {resource.metadata?.forks !== undefined && (
                <span className="flex items-center gap-1.5 text-[#8b949e]">
                  <GitFork className="w-4 h-4" />
                  <span className="text-[#e6edf3]">{formatNumber(resource.metadata.forks)}</span>
                </span>
              )}
              {resource.metadata?.language && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-full ${
                    resource.metadata.language === 'TypeScript' ? 'bg-[#3178c6]' :
                    resource.metadata.language === 'JavaScript' ? 'bg-[#f1e05a]' :
                    resource.metadata.language === 'Python' ? 'bg-[#3572A5]' :
                    resource.metadata.language === 'Go' ? 'bg-[#00ADD8]' :
                    resource.metadata.language === 'Rust' ? 'bg-[#DEA584]' :
                    resource.metadata.language === 'Java' ? 'bg-[#b07219]' :
                    resource.metadata.language === 'C++' ? 'bg-[#f34b7d]' :
                    resource.metadata.language === 'C' ? 'bg-[#555555]' :
                    resource.metadata.language === 'Ruby' ? 'bg-[#701516]' :
                    resource.metadata.language === 'PHP' ? 'bg-[#4F5D95]' :
                    resource.metadata.language === 'Swift' ? 'bg-[#F05138]' :
                    resource.metadata.language === 'Kotlin' ? 'bg-[#A97BFF]' : 'bg-[#8b949e]'
                  }`} />
                  <span className="text-[#8b949e]">{resource.metadata.language}</span>
                </span>
              )}
            </div>
            
            {/* 添加时间 */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#6e7681]">
              <Clock className="w-3 h-3" />
              <span>添加于 {formatDate(resource.created_at)}</span>
            </div>
          </div>
        </div>
      ) : resource.type === 'image' && resource.storage_path ? (
        /* 图片卡片 - 带缩略图预览 */
        <div 
          className="bg-white rounded-xl border border-gray-100 overflow-hidden group hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
          onClick={handleOpen}
          onContextMenu={handleContextMenu}
        >
          {/* 图片预览 */}
          <div className="relative aspect-video bg-gray-100 overflow-hidden">
            <img 
              src={getFileUrl(resource.storage_path)} 
              alt={resource.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* 悬浮遮罩 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
          {/* 信息区域 */}
          <div className="p-3">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900 text-sm truncate flex-1">{resource.title}</h3>
              <CardMenu 
                resource={resource}
                canPreview={previewInfo.canPreview}
                onOpen={handleOpen}
                onEdit={() => setIsEditing(true)}
                onDownload={resource.storage_path ? handleDownload : undefined}
                onArchive={handleArchive}
                onDelete={() => onDelete(resource.id)} 
              />
            </div>
            {resource.description && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{resource.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatDate(resource.created_at)}</span>
            </div>
          </div>
        </div>
      ) : (
        /* 链接/文档卡片 */
        <div 
          className="bg-white rounded-xl border border-gray-100 p-3 group hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
          onClick={handleOpen}
          onContextMenu={handleContextMenu}
        >
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
              {resource.type === 'document' && resource.file_name ? (
                <FileTypeIcon fileName={resource.file_name} className="w-5 h-5" />
              ) : (
                <Icon className={`w-4 h-4 ${config.color}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-gray-900 text-sm truncate flex-1">{resource.title}</h3>
                <CardMenu 
                  resource={resource}
                  canPreview={previewInfo.canPreview}
                  onOpen={handleOpen}
                  onEdit={() => setIsEditing(true)}
                  onDownload={resource.storage_path ? handleDownload : undefined}
                  onArchive={handleArchive}
                  onDelete={() => onDelete(resource.id)} 
                />
              </div>
              {resource.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{resource.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{formatDate(resource.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <ContextMenuContent
            position={contextMenu}
            resource={resource}
            canPreview={previewInfo.canPreview}
            onOpen={() => { setContextMenu(null); handleOpen(); }}
            onEdit={() => { setContextMenu(null); setIsEditing(true); }}
            onDownload={resource.storage_path ? () => { setContextMenu(null); handleDownload(); } : undefined}
            onArchive={() => { setContextMenu(null); handleArchive(); }}
            onDelete={() => { setContextMenu(null); onDelete(resource.id); }}
          />
        </>,
        document.body
      )}
    </motion.div>
  );
}

// 右键菜单内容组件
function ContextMenuContent({ 
  position, 
  resource, 
  canPreview,
  onOpen, 
  onEdit, 
  onDownload, 
  onArchive, 
  onDelete 
}: {
  position: { x: number; y: number };
  resource: Resource;
  canPreview: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDownload?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isArchived = !!resource.archived_at;
  const isFile = !!resource.storage_path;
  const showOpenButton = canPreview || resource.type === 'link' || resource.type === 'github';

  // 智能定位
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = position.x;
      let y = position.y;
      
      // 如果超出右边界
      if (x + rect.width > viewportWidth - 8) {
        x = viewportWidth - rect.width - 8;
      }
      // 如果超出下边界
      if (y + rect.height > viewportHeight - 8) {
        y = viewportHeight - rect.height - 8;
      }
      
      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const handleCopy = async () => {
    const textToCopy = resource.url || (resource.storage_path ? getFileUrl(resource.storage_path) : resource.title);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'fixed', top: adjustedPosition.y, left: adjustedPosition.x }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
    >
      {showOpenButton && (
        <button 
          onClick={onOpen}
          className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <ExternalLink className="w-3.5 h-3.5" /> 打开
        </button>
      )}
      <button 
        onClick={onEdit}
        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
      >
        <Edit3 className="w-3.5 h-3.5" /> 编辑
      </button>
      <button 
        onClick={handleCopy}
        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? '已复制' : '复制'}
      </button>
      {isFile && onDownload && (
        <button 
          onClick={onDownload}
          className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5" /> 下载
        </button>
      )}
      <button 
        onClick={onArchive}
        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
      >
        {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
        {isArchived ? '取消归档' : '归档'}
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button 
        onClick={onDelete}
        className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" /> 删除
      </button>
    </motion.div>
  );
}
