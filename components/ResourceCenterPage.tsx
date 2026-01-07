// 资源中心页面
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen,
  Folder,
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
  FileText,
  Sparkles,
  Newspaper,
  Home,
  ChevronRight,
  LayoutGrid,
  List,
  ChevronLeft,
  Package,
  FileImage
} from 'lucide-react';
// @ts-ignore - Github is deprecated but still works
import { Github } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import { TavilySearch, type TavilySearchResult } from '../shared/TavilySearch';
import { Modal, ConfirmModal } from '../shared/Modal';
import { Tooltip } from '../shared/Tooltip';
import { FolderView } from '../shared/FolderView';
import { FolderCard } from '../shared/FolderCard';
import { DragFolderPreview } from '../shared/DragFolderPreview';
import {
  ResourceFolder,
  getSubFolders,
  getFolderResources,
  createFolder,
  createFolderFromResources,
  moveResourceToFolder,
  getFolderPath,
  updateFolder,
  deleteFolder,
  archiveFolder,
  unarchiveFolder,
  getArchivedFolders
} from '../lib/resource-folders';
import { useResourceDrag } from '../lib/useResourceDrag';
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
  article: { label: '文章', icon: Newspaper, color: 'text-orange-600', bgColor: 'bg-orange-50' },
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

// 判断日期是否是今天
const isToday = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

// 判断日期是否在本周内
const isThisWeek = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // 本周日
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
};

interface Props {
  userId?: string;
  resourceViewer?: ResourceViewerHook;
}

export default function ResourceCenterPage({ userId, resourceViewer }: Props) {
  const [activeType, setActiveType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAISearch, setShowAISearch] = useState(false);
  const [allResources, setAllResources] = useState<Resource[]>([]); // 所有资源（用于客户端过滤）
  const [resources, setResources] = useState<Resource[]>([]);
  const [allFolders, setAllFolders] = useState<ResourceFolder[]>([]); // 所有文件夹
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<ResourceFolder[]>([]);
  const [openFolder, setOpenFolder] = useState<ResourceFolder | null>(null);
  const [stats, setStats] = useState<ResourceStats>({ all: 0, link: 0, github: 0, document: 0, image: 0, article: 0 });
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false); // 切换分类时的过渡状态
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
  const [addFromSearch, setAddFromSearch] = useState<{
    url: string;
    title: string;
    description: string;
  } | null>(null);
  const [addingFromSearch, setAddingFromSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast 提示
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // 拖拽创建文件夹 - 使用乐观更新
  const {
    dragState,
    handleDragStart,
    handleFolderDragStart,
    handleDrag,
    handleDragEnterResource,
    handleDragEnterFolder,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  } = useResourceDrag({
    userId: userId || '',
    resources,
    folders,
    setResources: (updater) => {
      // 同时更新 resources 和 allResources
      setResources(updater);
      setAllResources(updater);
    },
    setFolders: (updater) => {
      // 同时更新 folders 和 allFolders
      setFolders(updater);
      setAllFolders(updater);
    },
    onSuccess: showToast,
    onError: showToast,
    onRefresh: () => {
      setLoading(true);
      loadData();
    }
  });

  // 下载确认
  const handleConfirmDownload = useCallback((fileName: string, reason: string, onConfirm: () => void) => {
    setDownloadConfirm({ fileName, reason, onConfirm });
  }, []);

  // 加载数据 - 优化：首次加载所有数据，分类切换时客户端过滤
  const loadData = useCallback(async (forceReload = false) => {
    if (!userId) return;
    
    // 如果在文件夹内，直接加载文件夹内容
    if (currentFolderId) {
      try {
        const [resourcesData, path] = await Promise.all([
          getFolderResources(currentFolderId, userId),
          getFolderPath(currentFolderId)
        ]);
        setResources(resourcesData);
        setFolderPath(path);
        setFolders([]);
      } catch (err) {
        console.error('Failed to load folder content:', err);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    try {
      // 加载所有数据（不按类型过滤）
      const [foldersData, resourcesData, statsData, archivedStatsData] = await Promise.all([
        showArchived 
          ? getArchivedFolders(userId)
          : getSubFolders(null, userId),
        getResources(userId, undefined, showArchived), // 加载所有类型
        getResourceStats(userId, showArchived),
        getResourceStats(userId, true)
      ]);
      
      // 保存所有数据
      setAllFolders(foldersData);
      setAllResources(resourcesData);
      setStats(statsData);
      setArchivedCount(archivedStatsData.all || 0);
      setFolderPath([]);
      
      // 根据当前选中的类型过滤
      if (activeType === 'all') {
        setFolders(foldersData);
        setResources(resourcesData);
      } else {
        setFolders(foldersData.filter(f => f.resource_type === activeType));
        setResources(resourcesData.filter(r => r.type === activeType));
      }
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, showArchived, currentFolderId, activeType]);

  // 分类切换时的客户端过滤（不重新请求服务器）
  useEffect(() => {
    if (loading || currentFolderId) return;
    
    // 快速过渡动画
    setIsTransitioning(true);
    
    // 使用 requestAnimationFrame 确保过渡平滑
    requestAnimationFrame(() => {
      if (activeType === 'all') {
        setFolders(allFolders);
        setResources(allResources);
      } else {
        setFolders(allFolders.filter(f => f.resource_type === activeType));
        setResources(allResources.filter(r => r.type === activeType));
      }
      setCurrentPage(1); // 重置分页
      
      // 短暂延迟后结束过渡
      setTimeout(() => setIsTransitioning(false), 150);
    });
  }, [activeType, allFolders, allResources, loading, currentFolderId]);

  // 初始加载和归档/文件夹切换时重新加载
  useEffect(() => {
    setLoading(true);
    loadData();
  }, [userId, showArchived, currentFolderId]);

  // 导航到文件夹
  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
  }, []);

  // 删除文件夹 - 乐观更新
  const handleDeleteFolder = useCallback(async (folderId: string) => {
    // 乐观更新
    const originalFolders = [...folders];
    const originalAllFolders = [...allFolders];
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setAllFolders(prev => prev.filter(f => f.id !== folderId));
    
    try {
      await deleteFolder(folderId);
      // 更新统计
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚
      setFolders(originalFolders);
      setAllFolders(originalAllFolders);
      console.error('Failed to delete folder:', err);
    }
  }, [folders, allFolders, userId, showArchived]);

  // 创建新文件夹 - 已移除，改为通过拖拽两个同类型资源创建
  // const handleCreateFolder = async () => { ... }

  // 过滤资源 - 使用 useMemo 优化（只根据搜索词过滤，类型过滤已在 useEffect 中处理）
  const filteredResources = React.useMemo(() => {
    if (!searchQuery) return resources;
    const query = searchQuery.toLowerCase();
    return resources.filter(r => r.title.toLowerCase().includes(query));
  }, [resources, searchQuery]);

  // 过滤文件夹 - 使用 useMemo 优化
  const filteredFolders = React.useMemo(() => {
    if (!searchQuery) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(f => f.name.toLowerCase().includes(query));
  }, [folders, searchQuery]);

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

  // 删除资源 - 乐观更新
  const handleDelete = async (resourceId: string) => {
    // 乐观更新
    const originalResources = [...resources];
    const originalAllResources = [...allResources];
    setResources(prev => prev.filter(r => r.id !== resourceId));
    setAllResources(prev => prev.filter(r => r.id !== resourceId));
    
    try {
      await deleteResource(resourceId);
      // 只更新统计，不重新加载全部数据
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚
      setResources(originalResources);
      setAllResources(originalAllResources);
      console.error('Failed to delete resource:', err);
    }
  };

  // 切换选择
  const toggleSelect = (resourceId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResources.map(r => r.id)));
    }
  };

  // 批量删除 - 乐观更新（支持资源和文件夹）
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    // 分离资源ID和文件夹ID
    const selectedResourceIds = new Set<string>();
    const selectedFolderIds = new Set<string>();
    
    selectedIds.forEach(id => {
      if (resources.some(r => r.id === id) || allResources.some(r => r.id === id)) {
        selectedResourceIds.add(id);
      }
      if (folders.some(f => f.id === id) || allFolders.some(f => f.id === id)) {
        selectedFolderIds.add(id);
      }
    });
    
    // 乐观更新
    const originalResources = [...resources];
    const originalAllResources = [...allResources];
    const originalFolders = [...folders];
    const originalAllFolders = [...allFolders];
    const deleteCount = selectedIds.size;
    
    // 更新所有相关状态
    if (selectedResourceIds.size > 0) {
      setResources(prev => prev.filter(r => !selectedResourceIds.has(r.id)));
      setAllResources(prev => prev.filter(r => !selectedResourceIds.has(r.id)));
    }
    if (selectedFolderIds.size > 0) {
      setFolders(prev => prev.filter(f => !selectedFolderIds.has(f.id)));
      setAllFolders(prev => prev.filter(f => !selectedFolderIds.has(f.id)));
    }
    
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    showToast(`已删除 ${deleteCount} 个项目`);
    
    setDeletingSelected(true);
    try {
      // 并行删除资源和文件夹
      await Promise.all([
        ...Array.from(selectedResourceIds).map(id => deleteResource(id)),
        ...Array.from(selectedFolderIds).map(id => deleteFolder(id))
      ]);
      // 更新统计
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚
      setResources(originalResources);
      setAllResources(originalAllResources);
      setFolders(originalFolders);
      setAllFolders(originalAllFolders);
      console.error('批量删除失败:', err);
      showToast('删除失败，请重试');
    } finally {
      setDeletingSelected(false);
    }
  };

  // 退出选择模式
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // 拖拽上传文件
  const handleFileDrop = (e: React.DragEvent) => {
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
              <path fill="#8fbffa" d="M4.04 9.856C4.04 5.24 12.976 1.5 24 1.5s19.96 3.74 19.96 8.356c0 0 .54 7.355.54 15.71s-.54 12.579-.54 12.579c0 4.614-8.936 8.355-19.96 8.355S4.04 42.76 4.04 38.145c0 0-.54-4.223-.54-12.578s.54-15.711.54-15.711"/>
              <path fill="#2859c5" d="M4.04 9.856C4.04 5.24 12.975 1.5 24 1.5c11.023 0 19.96 3.74 19.96 8.356c0 4.614-8.937 8.355-19.96 8.355S4.04 14.471 4.04 9.856m-.52 18.418a184 184 0 0 1-.002-5.384c.224 1.721 1.933 3.677 5.539 5.316C12.802 29.908 18.08 31 23.992 31s11.19-1.092 14.936-2.794c3.695-1.68 5.398-3.692 5.553-5.444a208 208 0 0 1 0 5.498c-1.205 1.045-2.692 1.94-4.312 2.677C35.952 32.854 30.231 34 23.992 34s-11.96-1.146-16.177-3.063c-1.612-.733-3.093-1.624-4.295-2.663"/>
              <path fill="#2859c5" fillRule="evenodd" d="M8.508 40a2 2 0 1 0 0-4a2 2 0 0 0 0 4" clipRule="evenodd"/>
              <path fill="#2859c5" d="M15.008 41.75a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/>
              <path fill="#2859c5" fillRule="evenodd" d="M6.508 22.5a2 2 0 1 1 4 0a2 2 0 0 1-4 0" clipRule="evenodd"/>
              <path fill="#2859c5" d="M15.008 26.25a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/>
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">资源中心</h1>
              <p className="text-gray-500 text-sm">管理你的资源库</p>
            </div>
          </div>
          <Tooltip content="AI 搜索 (Tavily)">
            <button
              onClick={() => setShowAISearch(!showAISearch)}
              className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
                showAISearch 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI 搜索
            </button>
          </Tooltip>
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
          onDrop={handleFileDrop}
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
                data-add-link-btn
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
        <div className="grid grid-cols-6 gap-3 mb-8">
          {(Object.keys(typeConfig) as FilterType[]).map(type => {
            const config = typeConfig[type];
            const Icon = config.icon;
            // 统计数 = 只显示资源数量（最小单元），不包括文件夹
            const count = stats[type] || 0;
            const isActive = activeType === type;
            
            return (
              <button
                key={type}
                onClick={() => { setActiveType(type); setCurrentPage(1); }}
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
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <Tooltip content={showArchived ? '返回资源列表' : `查看归档 (${archivedCount})`}>
            <div className="relative">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
                  showArchived 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:border-orange-300'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? '已归档' : '归档'}
              </button>
              {!showArchived && archivedCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full shadow-sm">
                  {archivedCount > 99 ? '99+' : archivedCount}
                </span>
              )}
            </div>
          </Tooltip>
          <Tooltip content={isSelectionMode ? '退出多选' : '批量选择'}>
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
                isSelectionMode 
                  ? 'bg-red-500 text-white border-red-500' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Check className="w-4 h-4" />
              {isSelectionMode ? '取消' : '多选'}
            </button>
          </Tooltip>
          {/* 视图切换 */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <Tooltip content="网格视图">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="列表视图">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 多选操作栏 */}
        <AnimatePresence>
          {isSelectionMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  {selectedIds.size === filteredResources.length ? '取消全选' : '全选'}
                </button>
                <span className="text-sm text-orange-600">
                  已选择 {selectedIds.size} 项
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitSelectionMode}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0 || deletingSelected}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  删除选中
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI 搜索面板 - 改为右侧抽屉 */}
        <AnimatePresence>
          {showAISearch && userId && (
            <>
              {/* 遮罩 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={() => setShowAISearch(false)}
              />
              {/* 右侧抽屉 */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
              >
                {/* 抽屉头部 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">AI 搜索</h3>
                      <p className="text-xs text-gray-500">Powered by Tavily</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAISearch(false)}
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* 抽屉内容 */}
                <div className="flex-1 overflow-y-auto p-5">
                  <TavilySearch
                    userId={userId}
                    placeholder="搜索互联网上的工具、资源、教程..."
                    onSelectResult={(result) => {
                      setAddFromSearch({
                        url: result.url,
                        title: result.title,
                        description: result.content?.substring(0, 200) || ''
                      });
                    }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 文件夹路径导航 */}
        {(currentFolderId || folderPath.length > 0) && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <button
              onClick={() => navigateToFolder(null)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">资源中心</span>
            </button>
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => index < folderPath.length - 1 && navigateToFolder(folder.id)}
                  className={`px-2 py-1 rounded-lg text-sm transition-colors ${
                    index === folderPath.length - 1
                      ? 'font-medium text-gray-900 bg-white shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* 资源列表 */}
        <div className="min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredFolders.length === 0 && filteredResources.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                {showArchived ? (
                  <Archive className="w-8 h-8 text-gray-400" />
                ) : currentFolderId ? (
                  <Folder className="w-8 h-8 text-gray-400" />
                ) : (
                  <FolderOpen className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <p className="text-gray-500 mb-2">
                {showArchived ? '暂无归档资源' : currentFolderId ? '文件夹为空' : '暂无资源'}
              </p>
              <p className="text-gray-400 text-sm">
                {showArchived ? '归档的资源会显示在这里' : currentFolderId ? '拖拽资源到此文件夹' : '粘贴链接或上传文件添加资源'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            /* 列表视图 */
            (() => {
              // 合并文件夹和资源进行分页
              const allItems = [
                ...(!currentFolderId ? filteredFolders.map(f => ({ type: 'folder' as const, data: f })) : []),
                ...filteredResources.map(r => ({ type: 'resource' as const, data: r }))
              ];
              const totalItems = allItems.length;
              const totalPages = Math.ceil(totalItems / pageSize);
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const pageItems = allItems.slice(startIndex, endIndex);

              return (
                <div className="relative">
                  {/* 过渡加载指示器 */}
                  <AnimatePresence>
                    {isTransitioning && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                      >
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.div 
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    initial={false}
                    animate={{ opacity: isTransitioning ? 0.3 : 1 }}
                    transition={{ duration: 0.15 }}
                  >
                  {/* 列表头部 */}
                  <div className="grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                    <div className="w-6" />
                    <div>名称</div>
                    <div>类型</div>
                    <div>日期</div>
                    <div className="text-right">操作</div>
                  </div>
                  {/* 列表内容 */}
                  {pageItems.map((item) => item.type === 'folder' ? (
                    <ResourceListRow
                      key={`folder-${item.data.id}`}
                      type="folder"
                      folder={item.data as ResourceFolder}
                      onClick={() => setOpenFolder(item.data as ResourceFolder)}
                      onUpdate={loadData}
                      onFolderDelete={loadData}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(item.data.id)}
                      onToggleSelect={toggleSelect}
                      isDragOver={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === item.data.id}
                      canDrop={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === item.data.id ? dragState.canDrop : true}
                      draggable={!isSelectionMode}
                      onDragStart={(e) => handleFolderDragStart(item.data as ResourceFolder, e)}
                      onDrag={handleDrag}
                      onDragEnd={handleDragEnd}
                      isDragging={dragState.draggedFolder?.id === item.data.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const folder = item.data as ResourceFolder;
                        if (dragState.draggedResource || (dragState.draggedFolder && dragState.draggedFolder.id !== folder.id)) {
                          handleDragEnterFolder(folder);
                        }
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  ) : (
                    <div
                      key={`resource-${item.data.id}`}
                      draggable={!isSelectionMode}
                      onDragStart={(e) => handleDragStart(item.data as Resource, e)}
                      onDrag={handleDrag}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragState.draggedResource && dragState.draggedResource.id !== item.data.id) {
                          handleDragEnterResource(item.data as Resource);
                        }
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`${
                        dragState.dropTarget.type === 'resource' && dragState.dropTarget.id === item.data.id
                          ? 'bg-indigo-50'
                          : ''
                      } ${dragState.draggedResource?.id === item.data.id ? 'opacity-30' : ''}`}
                    >
                      <ResourceListRow
                        type="resource"
                        resource={item.data as Resource}
                        onDelete={handleDelete}
                        onUpdate={loadData}
                        onOpenInViewer={resourceViewer?.openResource}
                        onShowToast={showToast}
                        onConfirmDownload={handleConfirmDownload}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(item.data.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </div>
                  ))}
                  {totalItems === 0 && (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">暂无内容</div>
                  )}
                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <div className="text-sm text-gray-500">
                        共 {totalItems} 项，第 {currentPage}/{totalPages} 页
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-primary text-white'
                                  : 'hover:bg-gray-200 text-gray-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
                </div>
              );
            })()
          ) : (
            /* 网格视图 */
            <div className="relative">
              {/* 过渡加载指示器 */}
              <AnimatePresence>
                {isTransitioning && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                  >
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                initial={false}
                animate={{ opacity: isTransitioning ? 0.3 : 1 }}
                transition={{ duration: 0.15 }}
              >
              {/* 文件夹列表 */}
              {!currentFolderId && filteredFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onClick={() => setOpenFolder(folder)}
                  onUpdate={loadData}
                  onDelete={() => handleDeleteFolder(folder.id)}
                  isDragOver={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === folder.id}
                  canDrop={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === folder.id ? dragState.canDrop : true}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(folder.id)}
                  onToggleSelect={toggleSelect}
                  draggable={!isSelectionMode}
                  onDragStart={(e) => handleFolderDragStart(folder, e)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  isDragging={dragState.draggedFolder?.id === folder.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragState.draggedResource || (dragState.draggedFolder && dragState.draggedFolder.id !== folder.id)) {
                      handleDragEnterFolder(folder);
                    }
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              ))}
              
              {/* 资源列表 */}
              {filteredResources.map((resource) => (
                <div
                  key={resource.id}
                  draggable={!isSelectionMode}
                  onDragStart={(e) => handleDragStart(resource, e)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragState.draggedResource && dragState.draggedResource.id !== resource.id) {
                      handleDragEnterResource(resource);
                    }
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative ${
                    dragState.dropTarget.type === 'resource' && dragState.dropTarget.id === resource.id
                      ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl'
                      : ''
                  } ${dragState.draggedResource?.id === resource.id ? 'opacity-30' : ''}`}
                >
                  <ResourceCard 
                    resource={resource} 
                    onDelete={handleDelete}
                    onUpdate={loadData}
                    onOpenInViewer={resourceViewer?.openResource}
                    onShowToast={showToast}
                    onConfirmDownload={handleConfirmDownload}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(resource.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </motion.div>
            </div>
          )}
        </div>

        {/* 拖拽创建文件夹预览 */}
        <DragFolderPreview
          isVisible={
            dragState.showFolderPreview || 
            (dragState.dropTarget.type === 'resource' && !dragState.canDrop && !!dragState.dropTarget.resource) ||
            (dragState.draggedFolder && dragState.dropTarget.type === 'folder' && !!dragState.dropTarget.folder) ||
            (dragState.draggedResource && dragState.dropTarget.type === 'folder' && !!dragState.dropTarget.folder)
          }
          position={dragState.dragPosition}
          sourceResource={dragState.draggedResource || undefined}
          targetResource={dragState.dropTarget.resource}
          sourceFolder={dragState.draggedFolder || undefined}
          targetFolder={dragState.dropTarget.folder}
          canDrop={dragState.canDrop}
          dropError={dragState.dropError}
          isCopyMode={dragState.isCopyMode}
        />

        {/* 文件夹视图弹窗 */}
        {openFolder && userId && (
          <FolderView
            isOpen={!!openFolder}
            onClose={() => setOpenFolder(null)}
            folder={openFolder}
            userId={userId}
            onResourceClick={(resource) => {
              // 打开资源
              if (resource.url) {
                window.open(resource.url, '_blank');
              } else if (resource.storage_path && resourceViewer?.openResource) {
                resourceViewer.openResource(resource, getFileUrl(resource.storage_path));
              }
            }}
            onFolderUpdate={loadData}
          />
        )}

        {/* Toast 提示 */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-lg z-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
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

      {/* 从搜索结果添加资源弹窗 */}
      <Modal
        isOpen={!!addFromSearch}
        onClose={() => setAddFromSearch(null)}
        title="添加资源"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">链接</label>
            <input
              type="text"
              value={addFromSearch?.url || ''}
              readOnly
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
            <input
              type="text"
              value={addFromSearch?.title || ''}
              onChange={(e) => addFromSearch && setAddFromSearch({ ...addFromSearch, title: e.target.value })}
              placeholder="输入资源标题"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 ring-primary/20 focus:border-primary outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
            <textarea
              value={addFromSearch?.description || ''}
              onChange={(e) => addFromSearch && setAddFromSearch({ ...addFromSearch, description: e.target.value })}
              placeholder="输入资源描述（可选）"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setAddFromSearch(null)}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={async () => {
                if (!userId || !addFromSearch?.url || !addFromSearch?.title.trim()) return;
                setAddingFromSearch(true);
                try {
                  await createLinkResource(userId, addFromSearch.url, addFromSearch.description.trim() || undefined);
                  showToast('资源添加成功');
                  setAddFromSearch(null);
                  loadData();
                } catch (err: any) {
                  console.error('添加资源失败:', err);
                } finally {
                  setAddingFromSearch(false);
                }
              }}
              disabled={addingFromSearch || !addFromSearch?.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addingFromSearch && <Loader2 className="w-4 h-4 animate-spin" />}
              添加
            </button>
          </div>
        </div>
      </Modal>
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
function ResourceCard({ resource, onDelete, onUpdate, onOpenInViewer, onShowToast, onConfirmDownload, isSelectionMode, isSelected, onToggleSelect }: { 
  resource: Resource; 
  onDelete: (id: string) => void;
  onUpdate: () => void;
  onOpenInViewer?: (resource: Resource, url: string) => void;
  onShowToast?: (message: string) => void;
  onConfirmDownload?: (fileName: string, reason: string, onConfirm: () => void) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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

  // 处理卡片点击
  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(resource.id);
    } else {
      handleOpen();
    }
  };

  // 选择框组件
  const SelectionCheckbox = ({ dark = false }: { dark?: boolean }) => {
    if (!isSelectionMode) return null;
    return (
      <div 
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
          isSelected 
            ? 'bg-primary text-white' 
            : dark 
              ? 'bg-white/20 hover:bg-white/30 border border-white/30' 
              : 'bg-white hover:bg-gray-50 border border-gray-300'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(resource.id);
        }}
      >
        {isSelected && <Check className="w-4 h-4" />}
      </div>
    );
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`break-inside-avoid mb-4 ${isSelectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-2 rounded-2xl' : ''}`}
    >
      {isEditing && <EditModal />}
      
      {/* GitHub 项目卡片 */}
      {resource.type === 'github' ? (
        <div 
          className="rounded-2xl overflow-hidden relative group border border-[#30363d] cursor-pointer"
          style={{ background: 'linear-gradient(145deg, #161b22 0%, #0d1117 100%)' }}
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
        >
          <SelectionCheckbox dark />
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
      ) : resource.type === 'article' ? (
        /* 文章卡片 - RSS 同步的文章 */
        (() => {
          const articleDate = resource.metadata?.pub_date || resource.created_at;
          const isTodayArticle = isToday(articleDate);
          const isThisWeekArticle = isThisWeek(articleDate);
          
          return (
            <div 
              className={`rounded-xl p-4 group hover:shadow-md transition-all cursor-pointer relative ${
                isTodayArticle 
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 animate-pulse-subtle' 
                  : isThisWeekArticle 
                    ? 'bg-orange-50/50 border border-orange-200 hover:border-orange-300' 
                    : 'bg-white border border-gray-100 hover:border-orange-200'
              }`}
              onClick={handleCardClick}
              onContextMenu={handleContextMenu}
            >
              <SelectionCheckbox />
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isTodayArticle ? 'bg-orange-500' : 'bg-orange-50'
                }`}>
                  <Newspaper className={`w-5 h-5 ${isTodayArticle ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug">{resource.title}</h3>
                      {isTodayArticle && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full animate-bounce-subtle flex-shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <CardMenu 
                      resource={resource}
                      canPreview={previewInfo.canPreview}
                      onOpen={handleOpen}
                      onEdit={() => setIsEditing(true)}
                      onArchive={handleArchive}
                      onDelete={() => onDelete(resource.id)} 
                    />
                  </div>
                  {resource.description && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{resource.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-400">
                    {resource.metadata?.subscription_title && (
                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded whitespace-nowrap">{resource.metadata.subscription_title}</span>
                    )}
                    {resource.metadata?.author && resource.metadata.author !== resource.metadata?.subscription_title && (
                      <span className="text-orange-600 font-medium whitespace-nowrap">{resource.metadata.author}</span>
                    )}
                    <span className={`flex items-center gap-1 whitespace-nowrap ${isTodayArticle ? 'text-orange-600 font-medium' : ''}`}>
                      <Clock className="w-3 h-3" />
                      {isTodayArticle ? '今天' : formatDate(articleDate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : resource.type === 'image' && resource.storage_path ? (
        /* 图片卡片 - 带缩略图预览 */
        <div 
          className="bg-white rounded-xl border border-gray-100 overflow-hidden group hover:shadow-md hover:border-gray-200 transition-all cursor-pointer relative"
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
        >
          <SelectionCheckbox />
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
          className="bg-white rounded-xl border border-gray-100 p-3 group hover:shadow-md hover:border-gray-200 transition-all cursor-pointer relative"
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
        >
          <SelectionCheckbox />
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

// 列表视图行组件
function ResourceListRow({ 
  type,
  resource,
  folder,
  onClick,
  onDelete, 
  onUpdate, 
  onOpenInViewer, 
  onShowToast, 
  onConfirmDownload, 
  isSelectionMode, 
  isSelected, 
  onToggleSelect,
  onFolderDelete,
  // 拖拽相关（作为放置目标）
  isDragOver,
  canDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  // 拖拽相关（作为拖拽源 - 文件夹）
  draggable,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging
}: { 
  type: 'resource' | 'folder';
  resource?: Resource;
  folder?: ResourceFolder;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  onUpdate?: () => void;
  onOpenInViewer?: (resource: Resource, url: string) => void;
  onShowToast?: (message: string) => void;
  onConfirmDownload?: (fileName: string, reason: string, onConfirm: () => void) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onFolderDelete?: () => void;
  // 拖拽相关（作为放置目标）
  isDragOver?: boolean;
  canDrop?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  // 拖拽相关（作为拖拽源 - 文件夹）
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDrag?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder?.name || '');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // 文件夹行
  if (type === 'folder' && folder) {
    const id = folder.id;
    const handleClick = () => {
      if (isSelectionMode && onToggleSelect) {
        onToggleSelect(id);
      } else {
        onClick?.();
      }
    };

    const handleSaveName = async () => {
      if (!editName.trim()) return;
      try {
        await updateFolder(folder.id, { name: editName.trim() });
        setIsEditing(false);
        onUpdate?.();
      } catch (err) {
        console.error('Failed to update folder:', err);
      }
    };

    const handleDeleteFolder = async () => {
      setIsDeleting(true);
      try {
        await deleteFolder(folder.id);
        setShowDeleteConfirm(false);
        onFolderDelete?.();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <>
        <div 
          className={`grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors items-center ${
            isSelected ? 'bg-primary/5' : ''
          } ${isDragOver ? (canDrop ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'bg-red-50 ring-2 ring-red-400') : ''} ${isDragging ? 'opacity-30' : ''}`}
          draggable={draggable && !isSelectionMode}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
        {/* 选择框/图标 */}
        <div className="w-6 flex items-center justify-center">
          {isSelectionMode ? (
            <div 
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-primary text-white' 
                  : 'border border-gray-300 hover:border-gray-400'
              }`}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(id); }}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </div>
          ) : (
            <Folder className="w-5 h-5 text-amber-500" />
          )}
        </div>
        {/* 名称 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-900 truncate">{folder.name}</span>
        </div>
        {/* 类型 */}
        <div className="text-sm text-gray-500">
          {folder.resource_type ? typeConfig[folder.resource_type]?.label || '文件夹' : '文件夹'}
        </div>
        {/* 日期 */}
        <div className="text-sm text-gray-400">
          {formatDate(folder.created_at)}
        </div>
        {/* 操作 */}
        <div className="text-right flex items-center justify-end gap-1">
          <button 
            ref={menuButtonRef}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            onClick={(e) => { 
              e.stopPropagation(); 
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) });
              setShowMenu(!showMenu); 
            }}
            title="更多操作"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        </div>

        {/* 文件夹三个点菜单 */}
        {showMenu && createPortal(
          <>
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onClick?.(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); setIsEditing(true); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" /> 重命名
              </button>
              <button 
                onClick={async (e) => { 
                  e.stopPropagation();
                  setShowMenu(false); 
                  try {
                    if (folder.archived_at) {
                      await unarchiveFolder(folder.id);
                    } else {
                      await archiveFolder(folder.id);
                    }
                    onUpdate?.();
                  } catch (err) {
                    console.error('Failed to archive folder:', err);
                  }
                }}
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

        {/* 文件夹右键菜单 */}
        {contextMenu && createPortal(
          <>
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); onClick?.(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); setIsEditing(true); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" /> 重命名
              </button>
              <button 
                onClick={async (e) => { 
                  e.stopPropagation();
                  setContextMenu(null); 
                  try {
                    if (folder.archived_at) {
                      await unarchiveFolder(folder.id);
                    } else {
                      await archiveFolder(folder.id);
                    }
                    onUpdate?.();
                  } catch (err) {
                    console.error('Failed to archive folder:', err);
                  }
                }}
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

        {/* 重命名弹窗 */}
        <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="重命名文件夹" size="sm">
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
                onClick={() => setIsEditing(false)}
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

        {/* 删除确认弹窗 */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteFolder}
          title="删除文件夹"
          message={`确定要删除文件夹「${folder.name}」吗？文件夹内的所有资源将被移到回收站。`}
          confirmText="删除"
          cancelText="取消"
          type="danger"
          loading={isDeleting}
        />
      </>
    );
  }

  // 资源行
  if (type === 'resource' && resource) {
    const config = typeConfig[resource.type] || typeConfig.link;
    const Icon = config.icon;
    const id = resource.id;
    const previewInfo = canOpenInViewer(resource);

    const handleOpen = async () => {
      if (previewInfo.canPreview && resource.storage_path && onOpenInViewer) {
        const url = getFileUrl(resource.storage_path);
        onOpenInViewer(resource, url);
        return;
      }
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
      if (resource.url) {
        window.open(resource.url, '_blank');
      }
    };

    const handleClick = () => {
      if (isSelectionMode && onToggleSelect) {
        onToggleSelect(id);
      } else {
        handleOpen();
      }
    };

    const handleDelete = async () => {
      if (onDelete) {
        onDelete(id);
      }
    };

    const handleArchive = async () => {
      try {
        if (resource.archived_at) {
          await unarchiveResource(id);
        } else {
          await archiveResource(id);
        }
        onUpdate?.();
      } catch (err) {
        console.error('Failed to archive resource:', err);
      }
    };

    useEffect(() => {
      if (showMenu && menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4,
          left: Math.max(8, rect.right - 140)
        });
      }
    }, [showMenu]);

    return (
      <div 
        className={`grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors items-center ${
          isSelected ? 'bg-primary/5' : ''
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* 选择框/图标 */}
        <div className="w-6 flex items-center justify-center">
          {isSelectionMode ? (
            <div 
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-primary text-white' 
                  : 'border border-gray-300 hover:border-gray-400'
              }`}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(id); }}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </div>
          ) : resource.type === 'image' && resource.storage_path ? (
            <img 
              src={getFileUrl(resource.storage_path)} 
              alt="" 
              className="w-6 h-6 rounded object-cover"
            />
          ) : resource.type === 'document' && resource.file_name ? (
            <FileTypeIcon fileName={resource.file_name} className="w-5 h-5" />
          ) : (
            <Icon className={`w-5 h-5 ${config.color}`} />
          )}
        </div>
        {/* 名称 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-900 truncate">{resource.title}</span>
          {resource.type === 'github' && resource.metadata?.stars !== undefined && (
            <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
              <Star className="w-3 h-3 text-amber-400" />
              {formatNumber(resource.metadata.stars)}
            </span>
          )}
        </div>
        {/* 类型 */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${config.bgColor.replace('bg-', 'bg-').replace('-50', '-400')}`} />
          <span className="text-sm text-gray-500">{config.label}</span>
        </div>
        {/* 日期 */}
        <div className="text-sm text-gray-400">
          {formatDate(resource.created_at)}
        </div>
        {/* 操作 */}
        <div className="flex items-center justify-end gap-1">
          <button 
            ref={menuButtonRef}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* 操作菜单 */}
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
                onClick={() => { setShowMenu(false); handleOpen(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              {resource.storage_path && (
                <button 
                  onClick={async () => { 
                    setShowMenu(false); 
                    if (resource.storage_path && resource.file_name) {
                      await downloadFile(resource.storage_path, resource.file_name);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> 下载
                </button>
              )}
              <button 
                onClick={() => { setShowMenu(false); handleArchive(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                {resource.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {resource.archived_at ? '取消归档' : '归档'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button 
                onClick={() => { setShowMenu(false); handleDelete(); }}
                className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
            </motion.div>
          </>,
          document.body
        )}

        {/* 右键菜单 */}
        {contextMenu && createPortal(
          <>
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
            >
              <button 
                onClick={() => { setContextMenu(null); handleOpen(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              {resource.storage_path && (
                <button 
                  onClick={async () => { 
                    setContextMenu(null); 
                    if (resource.storage_path && resource.file_name) {
                      await downloadFile(resource.storage_path, resource.file_name);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> 下载
                </button>
              )}
              <button 
                onClick={() => { setContextMenu(null); handleArchive(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                {resource.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {resource.archived_at ? '取消归档' : '归档'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button 
                onClick={() => { setContextMenu(null); handleDelete(); }}
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

  return null;
}
