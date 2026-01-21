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
  FileImage,
  TrendingUp,
  BookOpen,
  Zap,
  Users,
  Eye,
  Activity,
  UserPlus
} from 'lucide-react';
// @ts-ignore - Github is deprecated but still works
import { Github } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import { TavilySearch, type TavilySearchResult } from '../shared/TavilySearch';
import { Modal, ConfirmModal } from '../shared/Modal';
import { Tooltip } from '../shared/Tooltip';
import { Button } from '../shared/Button';
import { FolderView } from '../shared/FolderView';
import { FolderCard } from '../shared/FolderCard';
import { DragFolderPreview } from '../shared/DragFolderPreview';
import { getGithubToken } from '../lib/user-credentials';
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
  getArchivedFolders,
  autoClassifyArticlesBySource
} from '../lib/resource-folders';
import { useResourceDrag } from '../lib/useResourceDrag';
import {
  Resource,
  ResourceType,
  ResourceStats,
  getResources,
  getResourceStats,
  createLinkResource,
  createBatchLinkResources,
  uploadFileResource,
  deleteResource,
  updateResource,
  getFileUrl,
  archiveResource,
  unarchiveResource,
  downloadFile,
  canOpenInViewer,
  autoCleanupOldTrash
} from '../lib/resources';
import { fetchRecommendedResources, fetchDetailsForResources, fetchFeaturedProjects, groupByYear, formatStars, setGithubToken, type RecommendedResource, type FeaturedCategory } from '../lib/recommended-resources';
import { getDefaultProvider, type AIProvider } from '../lib/ai-providers';
import { streamAIResponse } from '../lib/ai-prompt-assistant';
import {
  setGithubToken as setFollowingGithubToken,
  getFollowingUsers,
  addFollowingUser,
  removeFollowingUser,
  fetchGitHubUser,
  fetchUserStars,
  fetchUserEvents,
  getEventDescription,
  formatRelativeTime,
  formatNumber as formatGitHubNumber,
  type GitHubUser,
  type GitHubRepo,
  type GitHubEvent
} from '../lib/github-following';

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

// 格式化数字 - 超过 999 显示 999+
const formatNumber = (num: number) => {
  if (num > 999) return '999+';
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
  const [showRecommended, setShowRecommended] = useState(false);
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
  const [isClassifying, setIsClassifying] = useState(false); // 一键分类文章状态
  const [showGitHubFollowing, setShowGitHubFollowing] = useState(false); // GitHub 用户关注弹窗
  const [showCreateFolder, setShowCreateFolder] = useState(false); // 新建文件夹弹窗
  const [newFolderName, setNewFolderName] = useState('新建文件夹');
  const [newFolderType, setNewFolderType] = useState<ResourceType>('link');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [textareaRows, setTextareaRows] = useState(1); // textarea 动态行数
  const pageSize = 10;
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
    
    // 首次加载时自动清理30天前的回收站资源
    if (userId && !currentFolderId) {
      autoCleanupOldTrash(userId).then(count => {
        if (count > 0) {
          console.log(`自动清理了 ${count} 个30天前的回收站资源`);
        }
      }).catch(err => {
        console.error('自动清理回收站失败:', err);
      });
    }
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
    const originalStats = { ...stats };
    
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setAllFolders(prev => prev.filter(f => f.id !== folderId));
    
    try {
      await deleteFolder(folderId);
      // 从数据库重新获取准确的统计数据（删除文件夹可能会删除其中的资源）
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚
      setFolders(originalFolders);
      setAllFolders(originalAllFolders);
      setStats(originalStats);
      console.error('Failed to delete folder:', err);
    }
  }, [folders, allFolders, stats, userId, showArchived]);

  // 创建新文件夹 - 已移除，改为通过拖拽两个同类型资源创建
  // const handleCreateFolder = async () => { ... }

  // 过滤资源 - 使用 useMemo 优化（只根据搜索词过滤，类型过滤已在 useEffect 中处理）
  // 对文章类型按发布日期排序，其他类型按创建时间排序
  const filteredResources = React.useMemo(() => {
    let result = resources;
    
    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(query));
    }
    
    // 按日期排序：文章用 pub_date，其他用 created_at
    return [...result].sort((a, b) => {
      const dateA = a.type === 'article' && a.metadata?.pub_date 
        ? new Date(a.metadata.pub_date).getTime() 
        : new Date(a.created_at).getTime();
      const dateB = b.type === 'article' && b.metadata?.pub_date 
        ? new Date(b.metadata.pub_date).getTime() 
        : new Date(b.created_at).getTime();
      return dateB - dateA; // 降序，最新的在前
    });
  }, [resources, searchQuery]);

  // 过滤文件夹 - 使用 useMemo 优化
  const filteredFolders = React.useMemo(() => {
    if (!searchQuery) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(f => f.name.toLowerCase().includes(query));
  }, [folders, searchQuery]);

  // 添加链接资源（支持批量）
  const handleAddLink = async () => {
    if (!userId || !addInputValue.trim()) return;
    
    setIsAdding(true);
    try {
      // 解析输入中的多个 URL（支持换行、空格、逗号分隔）
      const inputText = addInputValue.trim();
      const urlRegex = /https?:\/\/[^\s,，\n]+/gi;
      const urls = inputText.match(urlRegex) || [];
      
      if (urls.length === 0) {
        // 如果没有找到 URL，尝试将整个输入当作单个 URL
        if (inputText.startsWith('http://') || inputText.startsWith('https://')) {
          await createLinkResource(userId, inputText, addDescription.trim() || undefined);
          showToast('已添加 1 个资源');
        } else {
          showToast('请输入有效的链接地址');
          setIsAdding(false);
          return;
        }
      } else if (urls.length === 1) {
        // 单个 URL，使用原有逻辑
        await createLinkResource(userId, urls[0], addDescription.trim() || undefined);
        showToast('已添加 1 个资源');
      } else {
        // 多个 URL，使用批量创建（智能分类 GitHub）
        const result = await createBatchLinkResources(userId, urls, addDescription.trim() || undefined);
        const githubCount = result.success.filter(r => r.type === 'github').length;
        const linkCount = result.success.filter(r => r.type === 'link').length;
        
        let message = `已添加 ${result.success.length} 个资源`;
        if (githubCount > 0 && linkCount > 0) {
          message += ` (${githubCount} GitHub, ${linkCount} 链接)`;
        } else if (githubCount > 0) {
          message += ` (GitHub)`;
        }
        if (result.failed.length > 0) {
          message += `，${result.failed.length} 个失败`;
        }
        showToast(message);
      }
      
      setAddInputValue('');
      setAddDescription('');
      setShowDescInput(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add resource:', err);
      showToast('添加失败，请重试');
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
    // 找到要删除的资源
    const resourceToDelete = allResources.find(r => r.id === resourceId);
    if (!resourceToDelete) return;
    
    // 乐观更新
    const originalResources = [...resources];
    const originalAllResources = [...allResources];
    const originalStats = { ...stats };
    
    setResources(prev => prev.filter(r => r.id !== resourceId));
    setAllResources(prev => prev.filter(r => r.id !== resourceId));
    
    // 乐观更新统计
    setStats(prev => ({
      ...prev,
      all: Math.max(0, prev.all - 1),
      [resourceToDelete.type]: Math.max(0, prev[resourceToDelete.type] - 1)
    }));
    
    try {
      await deleteResource(resourceId);
      // 从数据库重新获取准确的统计数据
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚所有状态
      setResources(originalResources);
      setAllResources(originalAllResources);
      setStats(originalStats);
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
    
    // 计算要删除的资源类型统计（用于乐观更新）
    const resourcesToDelete = allResources.filter(r => selectedResourceIds.has(r.id));
    const typeCount: Record<string, number> = {};
    resourcesToDelete.forEach(r => {
      typeCount[r.type] = (typeCount[r.type] || 0) + 1;
    });
    
    // 乐观更新
    const originalResources = [...resources];
    const originalAllResources = [...allResources];
    const originalFolders = [...folders];
    const originalAllFolders = [...allFolders];
    const originalStats = { ...stats };
    const deleteCount = selectedIds.size;
    
    // 更新所有相关状态
    if (selectedResourceIds.size > 0) {
      setResources(prev => prev.filter(r => !selectedResourceIds.has(r.id)));
      setAllResources(prev => prev.filter(r => !selectedResourceIds.has(r.id)));
      
      // 乐观更新统计
      setStats(prev => {
        const newStats = { ...prev };
        newStats.all = Math.max(0, newStats.all - selectedResourceIds.size);
        Object.keys(typeCount).forEach(type => {
          if (type in newStats) {
            newStats[type as ResourceType] = Math.max(0, newStats[type as ResourceType] - typeCount[type]);
          }
        });
        return newStats;
      });
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
      // 从数据库重新获取准确的统计数据
      if (userId) {
        const statsData = await getResourceStats(userId, showArchived);
        setStats(statsData);
      }
    } catch (err) {
      // 回滚所有状态
      setResources(originalResources);
      setAllResources(originalAllResources);
      setFolders(originalFolders);
      setAllFolders(originalAllFolders);
      setStats(originalStats);
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
          <div className="flex items-center gap-2">
            <Tooltip content="GitHub 用户关注">
              <div>
                <Button
                  variant="purple"
                  size="md"
                  onClick={() => setShowGitHubFollowing(true)}
                  icon={<Users className="w-4 h-4" />}
                >
                  关注
                </Button>
              </div>
            </Tooltip>
            <Tooltip content="推荐资源 (GitHubDaily)">
              <div>
                <Button
                  variant="dark"
                  size="md"
                  onClick={() => setShowRecommended(true)}
                  icon={<TrendingUp className="w-4 h-4" />}
                >
                  推荐
                </Button>
              </div>
            </Tooltip>
            <Tooltip content="AI 搜索 (Tavily)">
              <div>
                <Button
                  variant="gradient"
                  size="md"
                  onClick={() => setShowAISearch(!showAISearch)}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  AI 搜索
                </Button>
              </div>
            </Tooltip>
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
          onDrop={handleFileDrop}
        >
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Plus className={`w-5 h-5 ${isDraggingOnInput ? 'text-primary' : 'text-gray-400'}`} />
                </div>
                <textarea
                  placeholder="粘贴链接或图片、拖拽文件，或输入 GitHub 仓库地址...（支持批量：每行一个链接，或用空格/逗号分隔）"
                  value={addInputValue}
                  onChange={e => {
                    setAddInputValue(e.target.value);
                    // 动态调整高度：根据换行数量
                    const lines = e.target.value.split('\n').length;
                    setTextareaRows(Math.min(Math.max(1, lines), 6)); // 最小1行，最多6行
                  }}
                  onKeyDown={e => {
                    // Ctrl+Enter 或 Cmd+Enter 提交
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  onPaste={handlePaste}
                  rows={textareaRows}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 focus:border-primary focus:bg-white focus:border-solid outline-none transition-all text-sm resize-none"
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
              <Button
                variant="ghost"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAdding}
                icon={<Upload className="w-4 h-4" />}
              >
                上传文件
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleAddLink}
                data-add-link-btn
                disabled={!addInputValue.trim() || isAdding}
                loading={isAdding}
              >
                添加
              </Button>
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
            const displayCount = count > 999 ? '999+' : count.toString();
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
                  <div className={`text-xl font-bold ${isActive ? 'text-primary' : 'text-gray-900'}`}>{displayCount}</div>
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
          {/* 新建文件夹按钮 */}
          <Tooltip content="创建新文件夹">
            <div>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  // 根据当前选中的类型设置默认类型
                  if (activeType !== 'all') {
                    setNewFolderType(activeType);
                  }
                  setShowCreateFolder(true);
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                新建文件夹
              </Button>
            </div>
          </Tooltip>
          {/* 一键分类文章按钮 - 仅在文章类型下显示 */}
          {activeType === 'article' && stats.article > 1 && (
            <Tooltip content="按公众号/订阅源自动分类文章到文件夹">
              <div>
                <Button
                  variant="gradientGreen"
                  size="md"
                  onClick={async () => {
                    if (!userId || isClassifying) return;
                    setIsClassifying(true);
                    try {
                      const result = await autoClassifyArticlesBySource(userId);
                      if (result.moved > 0) {
                        showToast(`已创建 ${result.created} 个文件夹，归类 ${result.moved} 篇文章`);
                        await loadData();
                      } else if (result.skipped > 0) {
                        showToast('所有文章已分类或来源文章数不足');
                      } else {
                        showToast('没有需要分类的文章');
                      }
                    } catch (err) {
                      console.error('分类失败:', err);
                      showToast('分类失败，请重试');
                    } finally {
                      setIsClassifying(false);
                    }
                  }}
                  disabled={isClassifying}
                  loading={isClassifying}
                  icon={<Folder className="w-4 h-4" />}
                >
                  一键分类
                </Button>
              </div>
            </Tooltip>
          )}
          <Tooltip content={showArchived ? '返回资源列表' : `查看归档 (${archivedCount})`}>
            <div className="relative">
              <Button
                variant={showArchived ? 'primary' : 'ghost'}
                size="md"
                onClick={() => setShowArchived(!showArchived)}
                icon={<Archive className="w-4 h-4" />}
              >
                {showArchived ? '已归档' : '归档'}
              </Button>
              {!showArchived && archivedCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full shadow-sm">
                  {archivedCount > 99 ? '99+' : archivedCount}
                </span>
              )}
            </div>
          </Tooltip>
          <Tooltip content={isSelectionMode ? '退出多选' : '批量选择'}>
            <div>
              <Button
                variant={isSelectionMode ? 'danger' : 'ghost'}
                size="md"
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                icon={<Check className="w-4 h-4" />}
              >
                {isSelectionMode ? '取消' : '多选'}
              </Button>
            </div>
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

        {/* 新建文件夹弹窗 */}
        <Modal
          isOpen={showCreateFolder}
          onClose={() => setShowCreateFolder(false)}
          title="新建文件夹"
        >
          <div className="space-y-4">
            {/* 文件夹名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文件夹名称
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="请输入文件夹名称..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                autoFocus
              />
            </div>

            {/* 资源类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                资源类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['link', 'github', 'article', 'document', 'image'] as ResourceType[]).map(type => {
                  const config = typeConfig[type];
                  const Icon = config.icon;
                  const isSelected = newFolderType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setNewFolderType(type)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'bg-primary/5 border-primary'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-primary/10' : config.bgColor
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          isSelected ? 'text-primary' : config.color
                        }`} />
                      </div>
                      <span className={`text-sm font-medium ${
                        isSelected ? 'text-primary' : 'text-gray-700'
                      }`}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                文件夹只能包含相同类型的资源
              </p>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowCreateFolder(false)}
                disabled={isCreatingFolder}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  if (!userId || !newFolderName.trim()) return;
                  setIsCreatingFolder(true);
                  try {
                    await createFolder(userId, newFolderType, newFolderName.trim(), null, newFolderColor);
                    showToast('文件夹创建成功');
                    setShowCreateFolder(false);
                    setNewFolderName('新建文件夹');
                    setNewFolderColor('#6366f1');
                    await loadData();
                  } catch (err) {
                    console.error('创建文件夹失败:', err);
                    showToast('创建失败，请重试');
                  } finally {
                    setIsCreatingFolder(false);
                  }
                }}
                disabled={!newFolderName.trim() || isCreatingFolder}
                loading={isCreatingFolder}
                className="flex-1"
              >
                创建
              </Button>
            </div>
          </div>
        </Modal>

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
            (() => {
              // 合并文件夹和资源，计算分页
              const allGridItems: Array<{ type: 'folder' | 'resource'; data: ResourceFolder | Resource }> = [
                ...(!currentFolderId ? filteredFolders.map(f => ({ type: 'folder' as const, data: f })) : []),
                ...filteredResources.map(r => ({ type: 'resource' as const, data: r }))
              ];
              const totalGridItems = allGridItems.length;
              const totalGridPages = Math.ceil(totalGridItems / pageSize);
              const gridStartIndex = (currentPage - 1) * pageSize;
              const gridEndIndex = gridStartIndex + pageSize;
              const pageGridItems = allGridItems.slice(gridStartIndex, gridEndIndex);

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
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                initial={false}
                animate={{ opacity: isTransitioning ? 0.3 : 1 }}
                transition={{ duration: 0.15 }}
              >
              {/* 分页后的项目 */}
              {pageGridItems.map((item) => item.type === 'folder' ? (
                <FolderCard
                  key={`folder-${item.data.id}`}
                  folder={item.data as ResourceFolder}
                  onClick={() => setOpenFolder(item.data as ResourceFolder)}
                  onUpdate={loadData}
                  onDelete={() => handleDeleteFolder(item.data.id)}
                  isDragOver={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === item.data.id}
                  canDrop={dragState.dropTarget.type === 'folder' && dragState.dropTarget.id === item.data.id ? dragState.canDrop : true}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(item.data.id)}
                  onToggleSelect={toggleSelect}
                  draggable={!isSelectionMode}
                  onDragStart={(e) => handleFolderDragStart(item.data as ResourceFolder, e)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  isDragging={dragState.draggedFolder?.id === item.data.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragState.draggedResource || (dragState.draggedFolder && dragState.draggedFolder.id !== item.data.id)) {
                      handleDragEnterFolder(item.data as ResourceFolder);
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
                  className={`relative ${
                    dragState.dropTarget.type === 'resource' && dragState.dropTarget.id === item.data.id
                      ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl'
                      : ''
                  } ${dragState.draggedResource?.id === item.data.id ? 'opacity-30' : ''}`}
                >
                  <ResourceCard 
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
            </motion.div>
            
            {/* 网格视图分页 */}
            {totalGridPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500">
                  共 {totalGridItems} 项，第 {currentPage}/{totalGridPages} 页
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalGridPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalGridPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalGridPages - 2) {
                      pageNum = totalGridPages - 4 + i;
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
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalGridPages, p + 1))}
                    disabled={currentPage === totalGridPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            {totalGridItems === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">暂无内容</div>
            )}
            </div>
              );
            })()
          )}
        </div>

        {/* 推荐资源区域 - 始终显示在资源列表下方 */}
        {/* 已移到头部按钮，点击弹出全屏页面 */}

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

      {/* 推荐资源弹窗 */}
      <AnimatePresence>
        {showRecommended && (
          <RecommendedResourcesModal
            isOpen={showRecommended}
            onClose={() => setShowRecommended(false)}
            userId={userId}
            onAddResource={async (url: string) => {
              if (!userId) return;
              try {
                await createLinkResource(userId, url);
                await loadData();
                showToast('已添加到资源库');
              } catch (err) {
                console.error('Failed to add resource:', err);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* GitHub 用户关注弹窗 */}
      <AnimatePresence>
        {showGitHubFollowing && (
          <GitHubFollowingModal
            isOpen={showGitHubFollowing}
            onClose={() => setShowGitHubFollowing(false)}
            userId={userId}
            onAddResource={async (url: string) => {
              if (!userId) return;
              try {
                await createLinkResource(userId, url);
                await loadData();
                showToast('已添加到资源库');
              } catch (err) {
                console.error('Failed to add resource:', err);
              }
            }}
          />
        )}
      </AnimatePresence>

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

  // 编辑弹窗 - 直接内联渲染，避免函数组件导致的重新挂载问题
  const editModal = isEditing && createPortal(
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
      {editModal}
      
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
                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded truncate max-w-[120px]">{resource.metadata.subscription_title}</span>
                    )}
                    {resource.metadata?.author && resource.metadata.author !== resource.metadata?.subscription_title && (
                      <span className="text-orange-600 font-medium truncate max-w-[80px]">{resource.metadata.author}</span>
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
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
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
  const [isPositioned, setIsPositioned] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const adjustPosition = () => {
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;
        
        let x = position.x;
        let y = position.y;
        
        // 水平方向：如果右边超出，向左调整
        if (x + rect.width > viewportWidth - padding) {
          x = Math.max(padding, viewportWidth - rect.width - padding);
        }
        
        // 垂直方向：如果下方超出，向上弹出
        if (y + rect.height > viewportHeight - padding) {
          y = position.y - rect.height;
          // 如果向上也超出，则贴近底部
          if (y < padding) {
            y = viewportHeight - rect.height - padding;
          }
        }
        
        // 确保不超出边界
        x = Math.max(padding, x);
        y = Math.max(padding, y);
        
        setAdjustedPosition({ x, y });
        setIsPositioned(true);
        requestAnimationFrame(() => setIsVisible(true));
      }
    };
    
    requestAnimationFrame(adjustPosition);
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
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      style={{ 
        position: 'fixed', 
        top: adjustedPosition.y, 
        left: adjustedPosition.x,
        visibility: isPositioned ? 'visible' : 'hidden'
      }}
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
  const [contextMenuAdjusted, setContextMenuAdjusted] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder?.name || '');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // 智能调整右键菜单位置
  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const adjustPosition = () => {
        const rect = contextMenuRef.current!.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;
        
        let x = contextMenu.x;
        let y = contextMenu.y;
        
        // 水平方向调整
        if (x + rect.width > viewportWidth - padding) {
          x = Math.max(padding, viewportWidth - rect.width - padding);
        }
        
        // 垂直方向：如果下方超出，向上弹出
        if (y + rect.height > viewportHeight - padding) {
          y = contextMenu.y - rect.height;
          if (y < padding) {
            y = viewportHeight - rect.height - padding;
          }
        }
        
        x = Math.max(padding, x);
        y = Math.max(padding, y);
        
        setContextMenuAdjusted({ x, y });
        requestAnimationFrame(() => setContextMenuVisible(true));
      };
      
      requestAnimationFrame(adjustPosition);
    } else {
      setContextMenuAdjusted(null);
      setContextMenuVisible(false);
    }
  }, [contextMenu]);

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
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
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
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
            />
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: contextMenuVisible ? 1 : 0, scale: contextMenuVisible ? 1 : 0.95 }}
              style={{ 
                position: 'fixed', 
                top: contextMenuAdjusted?.y ?? contextMenu.y, 
                left: contextMenuAdjusted?.x ?? contextMenu.x,
                visibility: contextMenuAdjusted ? 'visible' : 'hidden'
              }}
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
    const [isEditingResource, setIsEditingResource] = useState(false);
    const [editTitle, setEditTitle] = useState(resource.title);
    const [editDescription, setEditDescription] = useState(resource.description || '');
    const [isSavingResource, setIsSavingResource] = useState(false);

    const handleSaveResource = async () => {
      if (!editTitle.trim()) return;
      setIsSavingResource(true);
      try {
        await updateResource(resource.id, {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        });
        setIsEditingResource(false);
        onUpdate?.();
      } catch (err) {
        console.error('Failed to update resource:', err);
      } finally {
        setIsSavingResource(false);
      }
    };

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

    // 编辑弹窗 - 直接内联渲染，避免函数组件导致的重新挂载问题
    const editModal = isEditingResource && createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsEditingResource(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">编辑资源</h3>
            <button onClick={() => setIsEditingResource(false)} className="p-1 rounded-lg hover:bg-gray-100">
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
              onClick={() => setIsEditingResource(false)}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSaveResource}
              disabled={!editTitle.trim() || isSavingResource}
              className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingResource ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    );

    return (
      <>
      {editModal}
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
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleOpen(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); setIsEditingResource(true); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" /> 编辑
              </button>
              {resource.storage_path && (
                <button 
                  onClick={async (e) => { 
                    e.stopPropagation();
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
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleArchive(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                {resource.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {resource.archived_at ? '取消归档' : '归档'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleDelete(); }}
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
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
            />
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: contextMenuVisible ? 1 : 0, scale: contextMenuVisible ? 1 : 0.95 }}
              style={{ 
                position: 'fixed', 
                top: contextMenuAdjusted?.y ?? contextMenu.y, 
                left: contextMenuAdjusted?.x ?? contextMenu.x,
                visibility: contextMenuAdjusted ? 'visible' : 'hidden'
              }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleOpen(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 打开
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); setIsEditingResource(true); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" /> 编辑
              </button>
              {resource.storage_path && (
                <button 
                  onClick={async (e) => { 
                    e.stopPropagation();
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
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleArchive(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                {resource.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {resource.archived_at ? '取消归档' : '归档'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button 
                onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleDelete(); }}
                className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
            </motion.div>
          </>,
          document.body
        )}
      </div>
      </>
    );
  }

  return null;
}

// 推荐资源全屏弹窗组件 - 实时从 GitHubDaily 获取数据
function RecommendedResourcesModal({ 
  isOpen,
  onClose,
  userId, 
  onAddResource 
}: { 
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onAddResource: (url: string) => Promise<void>;
}) {
  const [resources, setResources] = useState<RecommendedResource[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<RecommendedResource[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategory[]>([]);
  const [selectedFeaturedCategory, setSelectedFeaturedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatured, setShowFeatured] = useState(false); // 显示精选复盘
  
  // 分页状态
  const PAGE_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [featuredDisplayCount, setFeaturedDisplayCount] = useState(PAGE_SIZE); // 精选分页
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingFeaturedDetails, setLoadingFeaturedDetails] = useState(false); // 精选详情加载
  const detailsAbortRef = useRef<AbortController | null>(null);
  const featuredDetailsAbortRef = useRef<AbortController | null>(null);
  
  // AI 搜索状态
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<RecommendedResource[]>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [showAiMode, setShowAiMode] = useState(false);
  
  // AI 对话历史（用于记忆和持久化）
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [recommendedUrls, setRecommendedUrls] = useState<Set<string>>(new Set()); // 已推荐过的项目 URL
  
  // localStorage key
  const AI_CHAT_STORAGE_KEY = 'recommended_ai_chat_history';
  const AI_RECOMMENDED_URLS_KEY = 'recommended_ai_urls';
  
  // 从 localStorage 恢复对话历史
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedHistory = localStorage.getItem(AI_CHAT_STORAGE_KEY);
      const savedUrls = localStorage.getItem(AI_RECOMMENDED_URLS_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setAiChatHistory(parsed);
        // 恢复最后一次的 AI 回复
        const lastAssistant = parsed.filter((m: any) => m.role === 'assistant').pop();
        if (lastAssistant) {
          setAiResponse(lastAssistant.content);
        }
      }
      if (savedUrls) {
        setRecommendedUrls(new Set(JSON.parse(savedUrls)));
      }
    } catch (e) {
      console.error('Failed to restore AI chat history:', e);
    }
  }, [isOpen]);
  
  // 保存对话历史到 localStorage
  const saveAiHistory = (history: Array<{ role: 'user' | 'assistant'; content: string }>, urls: Set<string>) => {
    try {
      localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(history));
      localStorage.setItem(AI_RECOMMENDED_URLS_KEY, JSON.stringify(Array.from(urls)));
    } catch (e) {
      console.error('Failed to save AI chat history:', e);
    }
  };
  
  // 清除 AI 对话历史
  const clearAiHistory = () => {
    setAiChatHistory([]);
    setRecommendedUrls(new Set());
    setAiResponse('');
    setAiResults([]);
    setAiQuery('');
    localStorage.removeItem(AI_CHAT_STORAGE_KEY);
    localStorage.removeItem(AI_RECOMMENDED_URLS_KEY);
  };

  // 加载数据
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    setError(null);
    
    // 先获取 GitHub Token 并设置
    const loadWithToken = async () => {
      try {
        if (userId) {
          const token = await getGithubToken(userId);
          setGithubToken(token);
        }
      } catch (e) {
        console.warn('获取 GitHub Token 失败:', e);
      }
      
      // 并行加载资源和精选项目
      return Promise.all([
        fetchRecommendedResources(),
        fetchFeaturedProjects()
      ]);
    };
    
    loadWithToken().then(([resourcesData, featuredData]) => {
      setResources(resourcesData);
      setFeaturedProjects(featuredData.projects);
      setFeaturedCategories(featuredData.categories);
      // 默认选中最新年份
      const years = Object.keys(groupByYear(resourcesData)).sort().reverse();
      if (years.length > 0 && !selectedCategory) {
        setSelectedCategory(years[0]);
      }
    })
      .catch(err => {
        console.error('Failed to fetch resources:', err);
        setError('加载失败，请稍后重试');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, userId]);
  
  // 渐进式加载详情 - 当显示的资源变化时触发
  useEffect(() => {
    if (loading || showAiMode || searchQuery) return;
    
    // 取消之前的请求
    if (detailsAbortRef.current) {
      detailsAbortRef.current.abort();
    }
    
    // 获取当前年份的资源
    const resourcesByYear = groupByYear(resources);
    const currentYearResources = selectedCategory && resourcesByYear[selectedCategory] 
      ? resourcesByYear[selectedCategory] 
      : [];
    
    // 只获取当前显示的资源的详情
    const displayedResources = currentYearResources.slice(0, displayCount);
    const needDetails = displayedResources.filter(r => !r.detailsLoaded);
    
    if (needDetails.length === 0) return;
    
    const abortController = new AbortController();
    detailsAbortRef.current = abortController;
    setLoadingDetails(true);
    
    fetchDetailsForResources(
      displayedResources,
      (updated) => {
        // 更新资源列表中对应的项
        setResources(prev => {
          const newResources = [...prev];
          for (const u of updated) {
            const idx = newResources.findIndex(r => r.url === u.url);
            if (idx !== -1) {
              newResources[idx] = u;
            }
          }
          return newResources;
        });
      },
      abortController.signal
    ).finally(() => {
      if (!abortController.signal.aborted) {
        setLoadingDetails(false);
      }
    });
    
    return () => {
      abortController.abort();
    };
  }, [loading, selectedCategory, displayCount, showAiMode, searchQuery]);
  
  // 切换年份时重置分页
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [selectedCategory]);
  
  // 精选项目渐进式加载详情
  useEffect(() => {
    if (loading || !showFeatured) return;
    
    // 取消之前的请求
    if (featuredDetailsAbortRef.current) {
      featuredDetailsAbortRef.current.abort();
    }
    
    // 根据选中的分类过滤
    const filteredFeatured = selectedFeaturedCategory
      ? featuredProjects.filter(p => p.category === selectedFeaturedCategory)
      : featuredProjects;
    
    // 只获取当前显示的资源的详情
    const displayedFeatured = filteredFeatured.slice(0, featuredDisplayCount);
    const needDetails = displayedFeatured.filter(r => !r.detailsLoaded);
    
    if (needDetails.length === 0) return;
    
    const abortController = new AbortController();
    featuredDetailsAbortRef.current = abortController;
    setLoadingFeaturedDetails(true);
    
    fetchDetailsForResources(
      displayedFeatured,
      (updated) => {
        // 更新精选项目列表中对应的项
        setFeaturedProjects(prev => {
          const newProjects = [...prev];
          for (const u of updated) {
            const idx = newProjects.findIndex(r => r.url === u.url);
            if (idx !== -1) {
              newProjects[idx] = { ...newProjects[idx], ...u };
            }
          }
          return newProjects;
        });
      },
      abortController.signal
    ).finally(() => {
      if (!abortController.signal.aborted) {
        setLoadingFeaturedDetails(false);
      }
    });
    
    return () => {
      abortController.abort();
    };
  }, [loading, showFeatured, selectedFeaturedCategory, featuredDisplayCount, featuredProjects.length]);
  
  // 切换精选分类时重置分页
  useEffect(() => {
    setFeaturedDisplayCount(PAGE_SIZE);
  }, [selectedFeaturedCategory]);
  
  // 项目 AI 分析状态
  const [analyzeTarget, setAnalyzeTarget] = useState<RecommendedResource | null>(null);
  const [analyzePosition, setAnalyzePosition] = useState<{ x: number; y: number; placement: 'right' | 'left' | 'bottom' } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState('');
  const analyzeAbortRef = useRef<AbortController | null>(null);
  
  // 打开 AI 分析弹窗 - 智能位置计算
  const handleOpenAnalyze = (resource: RecommendedResource, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 340;
    const popupHeight = 420;
    const padding = 12;
    
    // 计算最佳位置
    let x: number, y: number;
    let placement: 'right' | 'left' | 'bottom' = 'right';
    
    // 优先右侧
    if (rect.right + padding + popupWidth < window.innerWidth) {
      x = rect.right + padding;
      y = rect.top;
      placement = 'right';
    }
    // 其次左侧
    else if (rect.left - padding - popupWidth > 0) {
      x = rect.left - padding - popupWidth;
      y = rect.top;
      placement = 'left';
    }
    // 最后底部
    else {
      x = Math.max(padding, Math.min(rect.left, window.innerWidth - popupWidth - padding));
      y = rect.bottom + padding;
      placement = 'bottom';
    }
    
    // 垂直方向调整：如果底部溢出，向上移动
    if (y + popupHeight > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - popupHeight - padding);
    }
    
    setAnalyzeTarget(resource);
    setAnalyzePosition({ x, y, placement });
    setAnalyzeResult('');
    setAnalyzing(false);
  };
  
  // 关闭 AI 分析弹窗
  const handleCloseAnalyze = () => {
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    setAnalyzeTarget(null);
    setAnalyzePosition(null);
    setAnalyzeResult('');
    setAnalyzing(false);
  };
  
  // 快速 AI 分析
  const handleQuickAnalyze = async () => {
    if (!analyzeTarget || !userId) return;
    
    // 取消之前的请求
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    
    const abortController = new AbortController();
    analyzeAbortRef.current = abortController;
    
    setAnalyzing(true);
    setAnalyzeResult('');
    
    try {
      const provider = await getDefaultProvider(userId);
      if (!provider) {
        setAnalyzeResult('请先在设置中配置 AI 提供商');
        setAnalyzing(false);
        return;
      }
      
      const systemPrompt = `你是一个 GitHub 项目分析专家。请用简洁的中文分析这个开源项目，包括：
1. 项目简介（一句话说明是什么）
2. 核心功能（3-5 个要点）
3. 适用场景
4. 技术栈
5. 上手难度（简单/中等/困难）

请保持简洁，总字数控制在 300 字以内。`;

      const userPrompt = `请分析这个 GitHub 项目：
- 名称：${analyzeTarget.title}
- 地址：${analyzeTarget.url}
- 描述：${analyzeTarget.description || '无'}
- 语言：${analyzeTarget.language || '未知'}
- Stars：${analyzeTarget.stars || '未知'}
- Topics：${analyzeTarget.topics?.join(', ') || '无'}`;

      let fullResponse = '';
      
      for await (const chunk of streamAIResponse(provider, systemPrompt, userPrompt)) {
        if (abortController.signal.aborted) break;
        fullResponse += chunk;
        setAnalyzeResult(fullResponse);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('AI analyze failed:', err);
        setAnalyzeResult('分析失败，请稍后重试');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setAnalyzing(false);
      }
    }
  };
  
  // 打开 DeepWiki
  const handleOpenDeepWiki = () => {
    if (!analyzeTarget) return;
    const deepWikiUrl = `https://deepwiki.com/${analyzeTarget.owner}/${analyzeTarget.repo}`;
    window.open(deepWikiUrl, '_blank');
  };

  // AI 搜索功能 - 流式友好输出，带记忆
  const handleAiSearch = async () => {
    if (!aiQuery.trim() || !userId) return;
    
    setAiSearching(true);
    setAiResponse('');
    setShowAiMode(true);
    
    // 保存用户问题到历史
    const userMessage = { role: 'user' as const, content: aiQuery };
    const newHistory = [...aiChatHistory, userMessage];
    
    try {
      // 获取默认 AI 提供商
      const provider = await getDefaultProvider(userId);
      if (!provider) {
        setAiResponse('请先在设置中配置 AI 提供商');
        setAiSearching(false);
        return;
      }
      
      // 基于当前选择的年份分类搜索
      const currentResources = selectedCategory 
        ? resources.filter(r => r.year === selectedCategory)
        : resources;
      
      // 过滤掉已推荐过的项目（用于追问场景）
      const availableResources = currentResources.filter(r => !recommendedUrls.has(r.url));
      
      // 如果没有可用资源了，提示用户
      if (availableResources.length === 0 && recommendedUrls.size > 0) {
        const response = `当前${selectedCategory ? ` ${selectedCategory} 年` : ''}分类下的项目已全部推荐完毕！

你可以：
1. 切换到其他年份查看更多项目
2. 点击\"清除对话\"重新开始
3. 使用搜索功能查找特定项目`;
        setAiResponse(response);
        const assistantMessage = { role: 'assistant' as const, content: response };
        const finalHistory = [...newHistory, assistantMessage];
        setAiChatHistory(finalHistory);
        saveAiHistory(finalHistory, recommendedUrls);
        setAiSearching(false);
        return;
      }
      
      // 构建资源列表（增加到 200 个以提供更多选择）
      const resourceList = availableResources.slice(0, 200).map(r => 
        `- ${r.title}: ${r.description || '无描述'} (${r.url})`
      ).join('\n');
      
      // 构建对话历史上下文
      const historyContext = aiChatHistory.length > 0 
        ? '\n\n之前的对话：\n' + aiChatHistory.slice(-6).map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n')
        : '';
      
      // 已推荐项目提示
      const excludeHint = recommendedUrls.size > 0 
        ? '\n\n重要：以下项目已经推荐过，请不要重复推荐：\n' + Array.from(recommendedUrls).slice(-20).join('\n')
        : '';
      
      const systemPrompt = `你是一个专业的 GitHub 开源项目推荐助手。你的任务是根据用户的具体需求，从提供的项目列表中精准匹配最相关的项目。

## 搜索范围
- 当前年份：${selectedCategory || '全部年份'}
- 可用项目：${availableResources.length} 个

## 推荐原则
1. **精准匹配**：仔细分析用户需求的关键词和意图，只推荐真正相关的项目
2. **多样性**：不要只推荐某一类项目（如 AI 类），要根据用户需求覆盖不同类型
3. **相关性优先**：按相关程度排序，最相关的放前面
4. **诚实推荐**：如果列表中没有完全匹配的项目，推荐最接近的，并说明差异

## 用户需求分析
- 如果用户问"前端"相关，优先推荐 React/Vue/CSS/UI 组件等项目
- 如果用户问"后端"相关，优先推荐 Node/Python/Go/数据库等项目
- 如果用户问"工具"相关，优先推荐效率工具、CLI 工具、开发工具等
- 如果用户问"学习"相关，优先推荐教程、文档、示例项目等
- 如果用户问"AI"相关，才推荐 AI/ML/LLM 相关项目

## 回复格式
根据你的需求"${aiQuery}"，我为你找到了以下项目：

1. **项目名称**
   - 链接：https://github.com/owner/repo
   - 推荐理由：（说明为什么这个项目符合用户需求）

## 注意事项
- 只推荐列表中存在的项目，绝对不要编造
- 推荐 6-10 个最相关的项目
- 如果用户说"还有吗"、"更多"、"继续"，推荐新项目不要重复
- 没有相关项目时，诚实告知并建议修改关键词或切换年份
- 链接格式必须是 https://github.com/owner/repo${historyContext}${excludeHint}`;

      const userPrompt = `用户问题：${aiQuery}

可选项目列表（${selectedCategory ? `${selectedCategory}年` : '全部'}）：
${resourceList}

请根据用户问题，从上述列表中推荐最相关的项目。`;

      let fullResponse = '';
      const foundUrls = new Set<string>();
      const newRecommendedUrls = new Set(recommendedUrls);
      
      for await (const chunk of streamAIResponse(provider, systemPrompt, userPrompt)) {
        fullResponse += chunk;
        setAiResponse(fullResponse);
        
        // 实时解析已提到的项目 URL，边输出边显示卡片
        const urlMatches = fullResponse.matchAll(/https:\/\/github\.com\/[^\s\)，。,.\]）]+/g);
        for (const match of urlMatches) {
          const url = match[0].replace(/[,，。.、\]）)]+$/, ''); // 去掉末尾标点
          if (!foundUrls.has(url)) {
            foundUrls.add(url);
            newRecommendedUrls.add(url); // 记录已推荐
            const found = resources.find(r => r.url.toLowerCase() === url.toLowerCase());
            if (found) {
              setAiResults(prev => {
                if (prev.some(p => p.url === found.url)) return prev;
                return [...prev, found];
              });
            }
          }
        }
      }
      
      // 保存 AI 回复到历史
      const assistantMessage = { role: 'assistant' as const, content: fullResponse };
      const finalHistory = [...newHistory, assistantMessage];
      setAiChatHistory(finalHistory);
      setRecommendedUrls(newRecommendedUrls);
      saveAiHistory(finalHistory, newRecommendedUrls);
      
      // 清空输入框
      setAiQuery('');
    } catch (err) {
      console.error('AI search failed:', err);
      setAiResponse('AI 搜索失败，请稍后重试');
    } finally {
      setAiSearching(false);
    }
  };

  const handleAdd = async (url: string) => {
    if (!userId) return;
    setAddingUrl(url);
    try {
      await onAddResource(url);
    } finally {
      setAddingUrl(null);
    }
  };

  // 按年份分组
  const resourcesByYear = groupByYear(resources);
  const years = Object.keys(resourcesByYear).sort().reverse(); // 最新年份优先

  // 过滤资源（带分页）
  const allFilteredResources = searchQuery
    ? resources.filter(r => 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedCategory && resourcesByYear[selectedCategory] 
      ? resourcesByYear[selectedCategory] 
      : [];
  
  // 当前显示的资源（分页）
  const filteredResources = searchQuery 
    ? allFilteredResources // 搜索时显示全部结果
    : allFilteredResources.slice(0, displayCount);
  
  // 是否还有更多
  const hasMore = !searchQuery && allFilteredResources.length > displayCount;
  
  // 加载更多
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + PAGE_SIZE);
  };

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">推荐资源</h2>
              <p className="text-sm text-gray-500">
                实时同步自 GitHubDaily · {loading ? '加载中...' : `${resources.length} 个项目`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setLoading(true);
                // 确保 Token 已设置
                if (userId) {
                  const token = await getGithubToken(userId);
                  setGithubToken(token);
                }
                fetchRecommendedResources(true)
                  .then(setResources)
                  .finally(() => setLoading(false));
              }}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <a 
              href="https://github.com/GitHubDaily/GitHubDaily" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-4 h-4" />
              源仓库
            </a>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 搜索和年份分类 */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 普通搜索框 */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索项目..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowAiMode(false); }}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
              />
            </div>
            {/* AI 搜索框 */}
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
              <input
                type="text"
                placeholder={selectedCategory ? `在 ${selectedCategory} 年项目中搜索...` : 'AI 智能推荐：描述你想要的项目...'}
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                className="w-full pl-9 pr-20 py-2 rounded-xl border border-purple-200 bg-purple-50/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none text-sm"
              />
              <button
                onClick={handleAiSearch}
                disabled={aiSearching || !aiQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {aiSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                问 AI
              </button>
            </div>
            {/* 精选按钮 + 年份标签 */}
            <div className="flex flex-wrap gap-2">
              {/* 精选复盘按钮 */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setShowFeatured(true); setSearchQuery(''); setShowAiMode(false); }}
                icon={<Star className="w-3.5 h-3.5" />}
              >
                精选 ({featuredProjects.length})
              </Button>
              {/* AI 推荐入口 - 有历史记录时显示 */}
              {aiResults.length > 0 && (
                <Button
                  variant="purple"
                  size="sm"
                  onClick={() => { setShowAiMode(true); setSearchQuery(''); setShowFeatured(false); }}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  AI 推荐 ({aiResults.length})
                </Button>
              )}
              {years.map(year => (
                <Button
                  key={year}
                  variant={selectedCategory === year && !searchQuery && !showAiMode && !showFeatured ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setSelectedCategory(year); setSearchQuery(''); setShowAiMode(false); setShowFeatured(false); }}
                >
                  {year} ({resourcesByYear[year].length})
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 资源列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 精选复盘 */}
          {showFeatured && !showAiMode && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">2025 年复盘</h3>
                <span className="text-sm text-gray-500">来自 GitHubDaily README · {featuredProjects.length} 个项目</span>
                <button
                  onClick={() => setShowFeatured(false)}
                  className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                >
                  返回列表
                </button>
              </div>
              
              {/* 分类标签 */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={!selectedFeaturedCategory ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFeaturedCategory(null)}
                >
                  全部 ({featuredProjects.length})
                </Button>
                {featuredCategories.map(cat => (
                  <Button
                    key={cat.name}
                    variant={selectedFeaturedCategory === cat.name ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedFeaturedCategory(cat.name)}
                  >
                    {cat.name} ({cat.count})
                  </Button>
                ))}
              </div>
              
              {/* 项目卡片 - 复用年份列表的样式 */}
              {(() => {
                const filteredFeatured = selectedFeaturedCategory
                  ? featuredProjects.filter(p => p.category === selectedFeaturedCategory)
                  : featuredProjects;
                const displayedFeatured = filteredFeatured.slice(0, featuredDisplayCount);
                const hasMoreFeatured = filteredFeatured.length > featuredDisplayCount;
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayedFeatured.map((resource) => (
                        <motion.div
                          key={resource.url}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative group p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-lg transition-all"
                        >
                          {/* AI 分析按钮 - 右上角 */}
                          <Tooltip content="AI 分析">
                            <button
                              onClick={(e) => handleOpenAnalyze(resource, e)}
                              className="absolute top-3 right-3 p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          </Tooltip>
                          <div className="flex items-start gap-3">
                            {/* 头像 */}
                            {resource.avatar ? (
                              <img 
                                src={resource.avatar} 
                                alt={resource.title}
                                className="w-12 h-12 rounded-xl flex-shrink-0 object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                                <Github className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2 mb-1">
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-gray-900 hover:text-primary truncate"
                                >
                                  {resource.title}
                                </a>
                                {/* Star 数 */}
                                {resource.stars && resource.stars > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs text-amber-600 flex-shrink-0">
                                    <Star className="w-3 h-3 fill-current" />
                                    {formatStars(resource.stars)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 line-clamp-2">{resource.description || '暂无描述'}</p>
                              {/* 标签 */}
                              {resource.topics && resource.topics.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {resource.topics.slice(0, 3).map(topic => (
                                    <span key={topic} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      {topic}
                                    </span>
                                  ))}
                                  {resource.topics.length > 3 && (
                                    <span className="text-xs text-gray-400">+{resource.topics.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              {resource.category && (
                                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                  {resource.category}
                                </span>
                              )}
                              {resource.language && (
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                  {resource.language}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleAdd(resource.url)}
                              disabled={addingUrl === resource.url}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {addingUrl === resource.url ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              添加
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    
                    {displayedFeatured.length === 0 && !loading && (
                      <div className="text-center py-12 text-gray-500">
                        暂无精选项目
                      </div>
                    )}
                    
                    {/* 加载更多按钮 */}
                    {hasMoreFeatured && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={() => setFeaturedDisplayCount(prev => prev + PAGE_SIZE)}
                          disabled={loadingFeaturedDetails}
                          className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {loadingFeaturedDetails ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              加载详情中...
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              加载更多 ({featuredDisplayCount}/{filteredFeatured.length})
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* 加载详情进度提示 */}
                    {loadingFeaturedDetails && !hasMoreFeatured && (
                      <div className="flex justify-center mt-4">
                        <span className="text-sm text-gray-500 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在获取项目详情...
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
              
              {loading && featuredProjects.length === 0 && (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在加载精选项目...</span>
                </div>
              )}
            </div>
          )}
          
          {/* AI 搜索结果 */}
          {showAiMode && !showFeatured && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900">AI 推荐结果</h3>
                {selectedCategory && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">
                    {selectedCategory} 年
                  </span>
                )}
                {recommendedUrls.size > 0 && (
                  <span className="text-xs text-gray-400">
                    已推荐 {recommendedUrls.size} 个
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {aiChatHistory.length > 0 && (
                    <button
                      onClick={clearAiHistory}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      清除对话
                    </button>
                  )}
                  <button
                    onClick={() => { setShowAiMode(false); }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    返回列表
                  </button>
                </div>
              </div>
              
              {/* AI 回复文本 */}
              {aiResponse && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    {aiSearching && <Loader2 className="w-5 h-5 animate-spin text-purple-500 mt-0.5 flex-shrink-0" />}
                    {!aiSearching && <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 prose prose-sm prose-purple max-w-none">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {aiResponse}
                        {aiSearching && <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 追问提示 */}
              {!aiSearching && aiResponse && aiResults.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-600">
                    💡 提示：你可以继续输入"还有吗"、"更多推荐"等来获取更多项目，AI 会记住已推荐的内容避免重复。
                  </p>
                </div>
              )}
              
              {/* 匹配到的项目卡片 */}
              {aiResults.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">找到 {aiResults.length} 个相关项目</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aiResults.map((resource: any) => (
                      <motion.div
                        key={resource.url}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative p-4 bg-white border-2 border-purple-200 rounded-xl hover:shadow-lg transition-all group"
                      >
                        {/* AI 分析按钮 - 右上角 */}
                        <Tooltip content="AI 分析">
                          <button
                            onClick={(e) => handleOpenAnalyze(resource, e)}
                            className="absolute top-3 right-3 p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <div className="flex items-start gap-3">
                          {resource.avatar ? (
                            <img src={resource.avatar} alt={resource.title} className="w-12 h-12 rounded-xl flex-shrink-0 object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                              <Github className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-2 mb-1">
                              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 hover:text-primary truncate">
                                {resource.title}
                              </a>
                              {resource.stars && resource.stars > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-600 flex-shrink-0">
                                  <Star className="w-3 h-3 fill-current" />{formatStars(resource.stars)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2">{resource.description || '暂无描述'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100 gap-2">
                          <button
                            onClick={() => handleAdd(resource.url)}
                            disabled={addingUrl === resource.url}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {addingUrl === resource.url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            添加
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              
              {!aiSearching && !aiResponse && (
                <div className="text-center py-8 text-gray-500">
                  输入问题后点击「问 AI」开始搜索
                </div>
              )}
            </div>
          )}
          
          {/* 普通列表 */}
          {!showAiMode && !showFeatured && (loading ? (
            <div className="space-y-4">
              {/* 骨架屏加载动画 */}
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 bg-gray-100 rounded-xl animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 bg-gray-200 rounded w-32" />
                        <div className="h-4 bg-gray-200 rounded w-12" />
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-full" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div className="flex gap-2">
                      <div className="h-5 bg-gray-200 rounded w-12" />
                      <div className="h-5 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  // 确保 Token 已设置
                  if (userId) {
                    const token = await getGithubToken(userId);
                    setGithubToken(token);
                  }
                  fetchRecommendedResources(true)
                    .then(setResources)
                    .catch(() => setError('加载失败'))
                    .finally(() => setLoading(false));
                }}
                className="px-4 py-2 rounded-xl bg-primary text-white"
              >
                重试
              </button>
            </div>
          ) : (
            <>
              {searchQuery && (
                <p className="text-sm text-gray-500 mb-4">
                  搜索 "{searchQuery}" 找到 {filteredResources.length} 个结果
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <motion.div
                    key={resource.url}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-lg transition-all"
                  >
                    {/* AI 分析按钮 - 右上角 */}
                    <Tooltip content="AI 分析">
                      <button
                        onClick={(e) => handleOpenAnalyze(resource, e)}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <div className="flex items-start gap-3">
                      {/* 头像 */}
                      {resource.avatar ? (
                        <img 
                          src={resource.avatar} 
                          alt={resource.title}
                          className="w-12 h-12 rounded-xl flex-shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                          <Github className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-900 hover:text-primary truncate"
                          >
                            {resource.title}
                          </a>
                          {/* Star 数 */}
                          {resource.stars && resource.stars > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 flex-shrink-0">
                              <Star className="w-3 h-3 fill-current" />
                              {formatStars(resource.stars)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{resource.description || '暂无描述'}</p>
                        {/* 标签 */}
                        {resource.topics && resource.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {resource.topics.slice(0, 3).map(topic => (
                              <span key={topic} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {topic}
                              </span>
                            ))}
                            {resource.topics.length > 3 && (
                              <span className="text-xs text-gray-400">+{resource.topics.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {resource.year && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {resource.year}
                          </span>
                        )}
                        {resource.language && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            {resource.language}
                          </span>
                        )}
                        {resource.category && resource.category !== '其他' && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{resource.category}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(resource.url)}
                        disabled={addingUrl === resource.url}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {addingUrl === resource.url ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        添加
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
              {filteredResources.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery ? '没有找到匹配的项目' : '该年份暂无项目'}
                </div>
              )}
              
              {/* 加载更多按钮 */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingDetails}
                    className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingDetails ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        加载详情中...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        加载更多 ({displayCount}/{allFilteredResources.length})
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* 加载详情进度提示 */}
              {loadingDetails && !hasMore && (
                <div className="flex justify-center mt-4">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在获取项目详情...
                  </span>
                </div>
              )}
            </>
          ))}
        </div>
        
        {/* AI 分析悬浮窗口 */}
        <AnimatePresence>
          {analyzeTarget && analyzePosition && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                left: analyzePosition.x,
                top: analyzePosition.y,
                zIndex: 60
              }}
              className="w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-gray-900">AI 项目分析</span>
                </div>
                <button
                  onClick={handleCloseAnalyze}
                  className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              {/* 项目信息 */}
              <div className="px-4 py-3 bg-gray-50/50">
                <div className="flex items-start gap-3">
                  {analyzeTarget.avatar ? (
                    <img src={analyzeTarget.avatar} alt={analyzeTarget.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <Github className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900 truncate">{analyzeTarget.title}</div>
                      {analyzeTarget.stars && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                          <Star className="w-3 h-3 fill-current" />
                          {formatStars(analyzeTarget.stars)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{analyzeTarget.owner}/{analyzeTarget.repo}</div>
                    {analyzeTarget.description && (
                      <div className="text-xs text-gray-600 mt-1.5 line-clamp-2">{analyzeTarget.description}</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 */}
              {!analyzeResult && !analyzing && (
                <div className="p-4 space-y-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleQuickAnalyze}
                    icon={<Zap className="w-4 h-4" />}
                    className="w-full justify-center"
                  >
                    快速了解
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleOpenDeepWiki}
                    icon={<BookOpen className="w-4 h-4" />}
                    className="w-full justify-center"
                  >
                    详细了解 (DeepWiki)
                  </Button>
                  <p className="text-xs text-gray-400 text-center pt-1">
                    DeepWiki 提供完整的项目文档和交互式问答
                  </p>
                </div>
              )}
              
              {/* AI 分析结果 */}
              {(analyzing || analyzeResult) && (
                <div className="p-4">
                  <div className="max-h-[260px] overflow-y-auto">
                    {analyzing && !analyzeResult && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">正在分析项目...</span>
                      </div>
                    )}
                    {analyzeResult && (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {analyzeResult}
                        {analyzing && <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5" />}
                      </div>
                    )}
                  </div>
                  
                  {/* 底部操作 */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setAnalyzeResult(''); setAnalyzing(false); }}
                      className="flex-1"
                    >
                      重新选择
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenDeepWiki}
                      icon={<BookOpen className="w-3.5 h-3.5" />}
                      className="flex-1"
                    >
                      DeepWiki
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// GitHub 用户关注弹窗组件
function GitHubFollowingModal({
  isOpen,
  onClose,
  userId,
  onAddResource
}: {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onAddResource: (url: string) => Promise<void>;
}) {
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  const [usersData, setUsersData] = useState<Map<string, GitHubUser>>(new Map());
  const [inputUsername, setInputUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stars' | 'activity'>('stars');
  
  // Stars 分页
  const [stars, setStars] = useState<GitHubRepo[]>([]);
  const [starsPage, setStarsPage] = useState(1);
  const [starsHasMore, setStarsHasMore] = useState(true);
  const [loadingStars, setLoadingStars] = useState(false);
  
  // Activity
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // 添加资源状态
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  // 初始化
  useEffect(() => {
    if (!isOpen) return;
    
    const initData = async () => {
      // 设置 GitHub Token
      if (userId) {
        try {
          const token = await getGithubToken(userId);
          setFollowingGithubToken(token);
        } catch (e) {
          console.warn('获取 GitHub Token 失败:', e);
        }
      }
      
      // 加载关注列表
      const users = getFollowingUsers();
      setFollowingUsers(users);
      
      // 加载用户数据
      const dataMap = new Map<string, GitHubUser>();
      for (const username of users) {
        try {
          const user = await fetchGitHubUser(username);
          if (user) dataMap.set(username, user);
        } catch (e) {
          console.warn(`加载用户 ${username} 失败:`, e);
        }
      }
      setUsersData(dataMap);
    };
    
    initData();
  }, [isOpen, userId]);

  // 添加关注
  const handleFollow = async () => {
    if (!inputUsername.trim()) return;
    
    const username = inputUsername.trim();
    if (followingUsers.includes(username)) {
      setError('已关注该用户');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const user = await fetchGitHubUser(username);
      if (!user) {
        setError('用户不存在');
        return;
      }
      
      addFollowingUser(username);
      setFollowingUsers(prev => [...prev, username]);
      setUsersData(prev => new Map(prev).set(username, user));
      setInputUsername('');
    } catch (e) {
      setError('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消关注
  const handleUnfollow = (username: string) => {
    removeFollowingUser(username);
    setFollowingUsers(prev => prev.filter(u => u !== username));
    setUsersData(prev => {
      const newMap = new Map(prev);
      newMap.delete(username);
      return newMap;
    });
    if (selectedUser === username) {
      setSelectedUser(null);
      setStars([]);
      setEvents([]);
    }
  };

  // 查看用户详情
  const handleViewUser = async (username: string) => {
    setSelectedUser(username);
    setStars([]);
    setEvents([]);
    setStarsPage(1);
    setStarsHasMore(true);
    setActiveTab('stars');
    
    // 加载 Stars
    await loadStars(username, 1);
    // 加载 Activity
    await loadEvents(username);
  };

  // 加载 Stars
  const loadStars = async (username: string, page: number) => {
    setLoadingStars(true);
    try {
      const result = await fetchUserStars(username, page, 20);
      if (page === 1) {
        setStars(result.repos);
      } else {
        setStars(prev => [...prev, ...result.repos]);
      }
      setStarsHasMore(result.hasMore);
      setStarsPage(page);
    } catch (e) {
      console.error('加载 Stars 失败:', e);
    } finally {
      setLoadingStars(false);
    }
  };

  // 加载 Activity
  const loadEvents = async (username: string) => {
    setLoadingEvents(true);
    try {
      const result = await fetchUserEvents(username, 1, 30);
      setEvents(result);
    } catch (e) {
      console.error('加载 Activity 失败:', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  // 添加到资源库
  const handleAddToResources = async (url: string) => {
    setAddingUrl(url);
    try {
      await onAddResource(url);
    } finally {
      setAddingUrl(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">GitHub 用户关注</h2>
              <p className="text-xs text-gray-500">追踪开发者动态，发现优质项目</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：关注列表 */}
          <div className="w-72 border-r border-gray-100 flex flex-col">
            {/* 添加用户 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入 GitHub 用户名..."
                  value={inputUsername}
                  onChange={e => setInputUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFollow()}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                <Button
                  variant="purple"
                  size="sm"
                  onClick={handleFollow}
                  disabled={loading || !inputUsername.trim()}
                  loading={loading}
                  icon={<UserPlus className="w-4 h-4" />}
                />
              </div>
              {error && (
                <p className="text-xs text-red-500 mt-2">{error}</p>
              )}
            </div>

            {/* 用户列表 */}
            <div className="flex-1 overflow-y-auto p-2">
              {followingUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>还没有关注任何用户</p>
                  <p className="text-xs mt-1">输入用户名开始关注</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {followingUsers.map(username => {
                    const user = usersData.get(username);
                    const isSelected = selectedUser === username;
                    
                    return (
                      <div
                        key={username}
                        className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-purple-50 border border-purple-200' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={() => handleViewUser(username)}
                      >
                        {user ? (
                          <img
                            src={user.avatar_url}
                            alt={username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Github className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {user?.name || username}
                          </div>
                          <div className="text-xs text-gray-500 truncate">@{username}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip content="查看详情">
                            <button
                              onClick={e => { e.stopPropagation(); handleViewUser(username); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-purple-100 text-gray-400 hover:text-purple-600 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content="取消关注">
                            <button
                              onClick={e => { e.stopPropagation(); handleUnfollow(username); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：用户详情 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedUser ? (
              <>
                {/* 用户信息卡片 */}
                {usersData.get(selectedUser) && (
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
                    <div className="flex items-start gap-4">
                      <img
                        src={usersData.get(selectedUser)!.avatar_url}
                        alt={selectedUser}
                        className="w-16 h-16 rounded-2xl shadow-md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {usersData.get(selectedUser)!.name || selectedUser}
                          </h3>
                          <a
                            href={usersData.get(selectedUser)!.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-purple-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <p className="text-sm text-gray-500">@{selectedUser}</p>
                        {usersData.get(selectedUser)!.bio && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {usersData.get(selectedUser)!.bio}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {formatGitHubNumber(usersData.get(selectedUser)!.public_repos)} 仓库
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {formatGitHubNumber(usersData.get(selectedUser)!.followers)} 粉丝
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 切换 */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100">
                  <button
                    onClick={() => setActiveTab('stars')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'stars'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                    Stars
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'activity'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    动态
                  </button>
                </div>

                {/* 内容区 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === 'stars' && (
                    <div className="space-y-2">
                      {loadingStars && stars.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        </div>
                      ) : stars.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>该用户还没有 Star 任何项目</p>
                        </div>
                      ) : (
                        <>
                          {stars.map(repo => (
                            <div
                              key={repo.id}
                              className="group p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all"
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={repo.owner.avatar_url}
                                  alt={repo.owner.login}
                                  className="w-8 h-8 rounded-lg"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={repo.html_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-gray-900 hover:text-purple-600 transition-colors truncate"
                                    >
                                      {repo.full_name}
                                    </a>
                                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                      <Star className="w-3 h-3 fill-current" />
                                      {formatGitHubNumber(repo.stargazers_count)}
                                    </span>
                                  </div>
                                  {repo.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {repo.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    {repo.language && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                                        {repo.language}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <GitFork className="w-3 h-3" />
                                      {formatGitHubNumber(repo.forks_count)}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddToResources(repo.html_url)}
                                  disabled={addingUrl === repo.html_url}
                                  className="opacity-0 group-hover:opacity-100 px-2.5 py-1.5 rounded-lg bg-purple-100 text-purple-600 text-xs font-medium hover:bg-purple-200 transition-all disabled:opacity-50"
                                >
                                  {addingUrl === repo.html_url ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          {/* 加载更多 */}
                          {starsHasMore && (
                            <div className="flex justify-center pt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => loadStars(selectedUser, starsPage + 1)}
                                loading={loadingStars}
                              >
                                加载更多
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="space-y-2">
                      {loadingEvents ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        </div>
                      ) : events.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>暂无最近动态</p>
                        </div>
                      ) : (
                        events.map(event => {
                          const { action, icon, color } = getEventDescription(event);
                          const repoUrl = `https://github.com/${event.repo.name}`;
                          
                          return (
                            <div
                              key={event.id}
                              className="group flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all"
                            >
                              <span className="text-lg">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${color}`}>{action}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {formatRelativeTime(event.created_at)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleAddToResources(repoUrl)}
                                disabled={addingUrl === repoUrl}
                                className="opacity-0 group-hover:opacity-100 px-2.5 py-1.5 rounded-lg bg-purple-100 text-purple-600 text-xs font-medium hover:bg-purple-200 transition-all disabled:opacity-50"
                              >
                                {addingUrl === repoUrl ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">选择一个用户查看详情</p>
                  <p className="text-xs mt-1">或添加新的关注用户</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
