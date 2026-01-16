import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { BarChart3, Sparkles, Pin } from 'lucide-react';
import { PromptStatsPanel } from './PromptStatsPanel';
import { SearchOverlay, SearchMatch } from '../shared/SearchOverlay';
import { AIEditorToolbar } from '../shared/AIEditorToolbar';
import { AIEditorSidebar } from '../shared/AIEditorSidebar';
import { RoleLibraryContent } from '../shared/RoleLibraryBrowser';
import { generateTags } from '../lib/ai-prompt-assistant';
import { hasEnabledProvider } from '../lib/ai-providers';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});
import { ContextMenu, useContextMenu, ContextMenuItem } from '../shared/ContextMenu';
import { Modal } from '../shared/Modal';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { getStoredUser } from '../lib/auth';
import * as api from '../lib/prompts';
import type { PromptBrowserHook } from '../lib/usePromptBrowser';

const lowlight = createLowlight(common);

type PromptCategory = api.PromptCategory;
type Prompt = api.Prompt;

// 从 HTML 中提取纯文本（用于预览）
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const getCategoryColors = (color: string): { bg: string; text: string; hex: string } => {
  // 支持 hex 颜色
  if (color.startsWith('#')) {
    return { 
      bg: '', 
      text: '',
      hex: color
    };
  }
  
  const colors: Record<string, { bg: string; text: string; hex: string }> = {
    // 暖色系
    red: { bg: 'bg-red-100', text: 'text-red-600', hex: '#ef4444' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', hex: '#f97316' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', hex: '#f59e0b' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', hex: '#eab308' },
    // 绿色系
    lime: { bg: 'bg-lime-100', text: 'text-lime-600', hex: '#84cc16' },
    green: { bg: 'bg-green-100', text: 'text-green-600', hex: '#22c55e' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', hex: '#10b981' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600', hex: '#14b8a6' },
    // 蓝色系
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', hex: '#06b6d4' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-600', hex: '#0ea5e9' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', hex: '#3b82f6' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', hex: '#6366f1' },
    // 紫粉系
    violet: { bg: 'bg-violet-100', text: 'text-violet-600', hex: '#8b5cf6' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', hex: '#a855f7' },
    fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-600', hex: '#d946ef' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600', hex: '#ec4899' },
    // 中性色
    rose: { bg: 'bg-rose-100', text: 'text-rose-600', hex: '#f43f5e' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#64748b' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-600', hex: '#6b7280' },
    zinc: { bg: 'bg-zinc-100', text: 'text-zinc-600', hex: '#71717a' },
  };
  return colors[color] || colors.gray;
};

// 获取分类标签的样式（支持自定义颜色）
const getCategoryTagStyle = (color: string): { className: string; style?: React.CSSProperties } => {
  const colors = getCategoryColors(color);
  if (color.startsWith('#')) {
    // 自定义颜色使用 inline style
    return {
      className: 'px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase',
      style: { backgroundColor: color + '20', color: color }
    };
  }
  // 预设颜色使用 Tailwind class
  return {
    className: `px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${colors.bg} ${colors.text}`
  };
};

interface PromptManagerProps {
  promptBrowser: PromptBrowserHook;
  onPromptsChange?: (prompts: Prompt[]) => void;
}

export const PromptManager: React.FC<PromptManagerProps> = ({ promptBrowser }) => {
  const user = getStoredUser();
  const userId = user?.id || '';

  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: PromptCategory }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'prompt' | 'category'; id: string }>({ open: false, type: 'prompt', id: '' });

  // 批量选择模式
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Tab 切换：提示词 / 数据
  const [activeTab, setActiveTab] = useState<'prompts' | 'stats'>('prompts');

  // 排序方式
  const [sortBy, setSortBy] = useState<'updated' | 'copies'>('updated');

  // 更多菜单
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  
  // 新建下拉菜单
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showMoreMenu || showCreateMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  const promptMenu = useContextMenu();
  const categoryMenu = useContextMenu();
  const toast = useToast();

  // 同步 categories 到 promptBrowser
  useEffect(() => {
    promptBrowser.setCategories(categories);
  }, [categories, promptBrowser]);

  // 打开提示词详情（添加到标签页）
  const openPromptDetail = (prompt: Prompt) => {
    promptBrowser.openPrompt(prompt);
  };

  // 获取当前激活的提示词
  const activePrompt = promptBrowser.browserTabs.find(t => t.id === promptBrowser.activeTabId);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!userId) { setError('请先登录'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [cats, proms] = await Promise.all([
        api.getCategories(userId),
        api.getPrompts(userId)
      ]);
      setCategories(cats);
      setPrompts(proms);
    } catch (err: any) {
      console.error('加载失败:', err);
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 监听保存事件，直接更新本地列表（不重新加载）
  useEffect(() => {
    if (promptBrowser.lastSavedPrompt) {
      const { type, prompt } = promptBrowser.lastSavedPrompt;
      if (type === 'create') {
        setPrompts(prev => [prompt, ...prev]);
      } else {
        setPrompts(prev => prev.map(p => p.id === prompt.id ? prompt : p));
      }
      promptBrowser.clearLastSavedPrompt();
    }
  }, [promptBrowser.lastSavedPrompt]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPrompts = prompts
    .filter(p => 
      (selectedCategoryId === 'ALL' || p.category_id === selectedCategoryId) &&
      (p.title.toLowerCase().includes(search.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())))
    )
    .sort((a, b) => {
      if (sortBy === 'copies') {
        return (b.copy_count ?? 0) - (a.copy_count ?? 0);
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const getCategoryName = (categoryId: string | null) => categoryId ? categories.find(c => c.id === categoryId)?.name || '未分类' : '未分类';
  const getCategoryColor = (categoryId: string | null) => categoryId ? categories.find(c => c.id === categoryId)?.color || 'gray' : 'gray';

  // 创建新提示词（本地临时创建，不插入数据库）
  const handleCreatePrompt = () => {
    const tempId = `temp_${Date.now()}`;
    // 如果当前选中了具体分类，则使用该分类；否则使用第一个分类或 null
    const defaultCategoryId = selectedCategoryId !== 'ALL' 
      ? selectedCategoryId 
      : (categories[0]?.id || null);
    const newPrompt: Prompt = {
      id: tempId,
      title: '新提示词',
      content: '',
      category_id: defaultCategoryId,
      tags: [],
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    };
    // 添加到标签页并标记为新提示词
    promptBrowser.setBrowserTabs(prev => [...prev, newPrompt]);
    promptBrowser.setActiveTabId(tempId);
    promptBrowser.setAutoEditId(tempId);
    promptBrowser.addNewPromptId(tempId);
    promptBrowser.setIsBrowserMinimized(false);
  };

  const handleDeletePrompt = async (permanent: boolean = false) => {
    try {
      if (permanent) {
        await api.permanentDeletePrompt(deleteConfirm.id);
        toast.info('提示词已永久删除');
      } else {
        await api.deletePrompt(deleteConfirm.id);
        toast.info('提示词已移到回收站');
      }
      setPrompts(prev => prev.filter(p => p.id !== deleteConfirm.id));
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
    setDeleteConfirm({ open: false, type: 'prompt', id: '' });
  };

  const handleDuplicatePrompt = async (prompt: Prompt) => {
    try {
      const created = await api.createPrompt(userId, { title: prompt.title + ' (副本)', content: prompt.content, category_id: prompt.category_id, tags: prompt.tags });
      setPrompts(prev => [created, ...prev]);
      toast.success('已复制');
    } catch (err: any) {
      toast.error(err.message || '复制失败');
    }
  };

  const handleSaveCategory = async (data: { name: string; color: string }) => {
    try {
      if (categoryModal.category) {
        const updated = await api.updateCategory(categoryModal.category.id, data);
        setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success('分类已更新');
      } else {
        const created = await api.createCategory(userId, data.name, data.color);
        setCategories(prev => [...prev, created]);
        toast.success('分类已创建');
      }
      setCategoryModal({ open: false });
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    }
  };

  const handleDeleteCategory = async () => {
    try {
      await api.deleteCategory(deleteConfirm.id);
      setCategories(prev => prev.filter(c => c.id !== deleteConfirm.id));
      if (selectedCategoryId === deleteConfirm.id) setSelectedCategoryId('ALL');
      toast.info('分类已删除');
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
    setDeleteConfirm({ open: false, type: 'category', id: '' });
  };

  // 置顶/取消置顶提示词
  const handleTogglePin = async (prompt: Prompt) => {
    try {
      const updated = await api.togglePinPrompt(prompt.id, !prompt.is_pinned);
      setPrompts(prev => prev.map(p => p.id === prompt.id ? updated : p));
      toast.success(updated.is_pinned ? '已置顶' : '已取消置顶');
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    }
  };

  // 导出单个提示词为 Markdown 文件
  const handleExportPrompt = (prompt: Prompt) => {
    // 从 HTML 中提取纯文本
    const plainContent = stripHtml(prompt.content);
    const md = `# ${prompt.title}\n\n${plainContent}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${prompt.title.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // 切换选择模式
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedPromptIds(new Set());
    }
    setIsSelectMode(!isSelectMode);
  };

  // 切换选中状态
  const togglePromptSelection = (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPromptIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
  };

  // 批量导出为 MD
  const handleBatchExportMD = () => {
    if (selectedPromptIds.size === 0) {
      toast.error('请先选择要导出的提示词');
      return;
    }
    const selectedPrompts = prompts.filter(p => selectedPromptIds.has(p.id));
    const md = selectedPrompts.map(p => `# ${p.title}\n\n${stripHtml(p.content)}`).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prompts-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`已导出 ${selectedPromptIds.size} 个提示词`);
    setIsSelectMode(false);
    setSelectedPromptIds(new Set());
  };

  // 批量导出为 PDF（支持中文）
  const handleBatchExportPDF = async () => {
    if (selectedPromptIds.size === 0) {
      toast.error('请先选择要导出的提示词');
      return;
    }
    const selectedPrompts = prompts.filter(p => selectedPromptIds.has(p.id));
    
    try {
      toast.info('正在生成 PDF...');
      
      // 创建临时容器
      const container = document.createElement('div');
      container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; background: white;';
      document.body.appendChild(container);

      // 生成 HTML 内容
      container.innerHTML = selectedPrompts.map((prompt, index) => `
        <div style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; ${index > 0 ? 'page-break-before: always;' : ''}">
          <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0 0 16px 0;">${prompt.title}</h1>
          <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px; color: #888;">
            <span>分类: ${getCategoryName(prompt.category_id)}</span>
            ${prompt.tags?.length ? `<span>标签: ${prompt.tags.join(', ')}</span>` : ''}
            <span>创建于: ${new Date(prompt.created_at).toLocaleDateString('zh-CN')}</span>
          </div>
          <div style="height: 1px; background: #eee; margin: 16px 0;"></div>
          <div style="font-size: 14px; line-height: 1.8; color: #333; word-break: break-word;">${prompt.content}</div>
        </div>
      `).join('<div style="height: 40px;"></div>');

      // 使用 html2canvas 渲染
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // 创建 PDF
      const imgWidth = 210; // A4 宽度 mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // 分页处理
      const pageHeight = 297; // A4 高度 mm
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 清理
      document.body.removeChild(container);

      pdf.save(`prompts-export-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`已导出 ${selectedPromptIds.size} 个提示词为 PDF`);
    } catch (err) {
      console.error('PDF 导出失败:', err);
      toast.error('PDF 导出失败');
    }
    
    setIsSelectMode(false);
    setSelectedPromptIds(new Set());
  };

  // 导入 MD 文件 - 直接将整个文件作为一个提示词
  const handleImportMD = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content?.trim()) {
        toast.error('文件内容为空');
        setIsImporting(false);
        return;
      }

      // 用文件名（去掉扩展名）作为标题
      const title = file.name.replace(/\.md$/i, '');
      
      // 将 Markdown 转换为 HTML
      const htmlContent = await marked.parse(content.trim());

      try {
        const created = await api.createPrompt(userId, {
          title,
          content: htmlContent,
          category_id: categories[0]?.id || null,
          tags: []
        });
        setPrompts(prev => [created, ...prev]);
        toast.success('导入成功');
      } catch (err: any) {
        console.error('导入失败:', err);
        toast.error(err.message || '导入失败');
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      toast.error('读取文件失败');
      setIsImporting(false);
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPromptMenuItems = (prompt: Prompt): ContextMenuItem[] => [
    { label: prompt.is_pinned ? '取消置顶' : '置顶', icon: <Pin className={`w-4 h-4 ${prompt.is_pinned ? 'fill-amber-400 text-amber-400' : ''}`} />, onClick: () => handleTogglePin(prompt) },
    { label: '复制', icon: <CopyIcon />, onClick: () => handleDuplicatePrompt(prompt) },
    { label: '导出', icon: <ExportIcon />, onClick: () => handleExportPrompt(prompt) },
    { label: '', divider: true, onClick: () => {} },
    { label: '删除', icon: <TrashIcon />, danger: true, onClick: () => setDeleteConfirm({ open: true, type: 'prompt', id: prompt.id }) }
  ];

  const getCategoryMenuItems = (category: PromptCategory): ContextMenuItem[] => [
    { label: '编辑', icon: <EditIcon />, onClick: () => setCategoryModal({ open: true, category }) },
    { label: '', divider: true, onClick: () => {} },
    { label: '删除', icon: <TrashIcon />, danger: true, onClick: () => {
      // 检查该分类下是否有提示词
      const promptCount = prompts.filter(p => p.category_id === category.id).length;
      if (promptCount > 0) {
        toast.error(`该分类下有 ${promptCount} 个提示词，请先移动或删除这些提示词`);
        return;
      }
      setDeleteConfirm({ open: true, type: 'category', id: category.id });
    }}
  ];

  if (loading) return <LoadingSpinner text="正在加载提示词..." />;
  if (error) return <div className="w-full h-full flex items-center justify-center"><div className="text-center"><p className="text-red-500 mb-4">{error}</p><button onClick={loadData} className="px-4 py-2 bg-primary text-white rounded-lg">重试</button></div></div>;

  return (
    <div className="w-full h-full p-6 md:p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-3">
            <svg className="w-10 h-10" viewBox="0 0 14 14">
              <g fill="none" fillRule="evenodd" clipRule="evenodd">
                <path fill="#8fbffa" d="M6.035 2.507c-.653 1.073-.204 2.73 1.344 3c.545.095.978.51 1.096 1.05l.02.092c.454 2.073 3.407 2.086 3.878.017l.025-.108a1 1 0 0 1 .04-.139v5.791c0 .941-.764 1.704-1.705 1.704H1.734A1.704 1.704 0 0 1 .03 12.21V4.211c0-.941.763-1.704 1.704-1.704h4.3Z"/>
                <path fill="#2859c5" d="M3.08 7.797a.625.625 0 1 0-.883.884L3.255 9.74l-1.058 1.058a.625.625 0 0 0 .884.884l1.5-1.5a.625.625 0 0 0 0-.884l-1.5-1.5Zm2.559 2.817a.625.625 0 1 0 0 1.25h1.5a.625.625 0 0 0 0-1.25zm.396-8.107c-.653 1.073-.204 2.73 1.344 3c.318.055.598.22.8.454H.028V4.21c0-.941.764-1.704 1.705-1.704h4.3ZM11.233.721C11.04-.13 9.825-.125 9.638.728l-.007.035l-.015.068A2.53 2.53 0 0 1 7.58 2.772c-.887.154-.887 1.428 0 1.582a2.53 2.53 0 0 1 2.038 1.952l.02.093c.187.852 1.401.858 1.595.007l.025-.108a2.55 2.55 0 0 1 2.046-1.942c.889-.155.889-1.43 0-1.585A2.55 2.55 0 0 1 11.26.844l-.018-.082l-.01-.041Z"/>
              </g>
            </svg>
            <div><h2 className="text-3xl font-bold text-gray-900 mb-1">提示词库</h2><p className="text-gray-500">管理和组织你的 AI 提示词模板</p></div>
          </div>
          <div className="flex gap-3">
            {/* Tab 切换 */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('prompts')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'prompts' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                提示词
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'stats' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                数据
              </button>
            </div>
            <div className="w-px bg-gray-200" />
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-role-library'))} 
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center"
              title="AI 角色库 (Beta)"
            >
              <svg className="w-8 h-6" viewBox="0 0 256 192" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="#2D4552" d="M84.38 108.352c-9.556 2.712-15.826 7.467-19.956 12.218c3.956-3.461 9.255-6.639 16.402-8.665c7.311-2.072 13.548-2.057 18.702-1.062v-4.03c-4.397-.402-9.437-.082-15.148 1.539M63.987 74.475l-35.49 9.35s.646.914 1.844 2.133l30.092-7.93s-.427 5.495-4.13 10.41c7.005-5.299 7.684-13.963 7.684-13.963m29.709 83.41c-49.946 13.452-76.37-44.43-84.37-74.472c-3.696-13.868-5.31-24.37-5.74-31.148a11.5 11.5 0 0 1 .025-1.84C1.021 50.58-.22 51.927.032 55.82c.43 6.773 2.044 17.275 5.74 31.147c7.997 30.038 34.424 87.92 84.37 74.468c10.871-2.929 19.038-8.263 25.17-15.073c-5.652 5.104-12.724 9.123-21.616 11.523M103.08 39.05v3.555h19.59c-.401-1.259-.806-2.393-1.208-3.555z"/>
                <path fill="#2D4552" d="M127.05 68.325c8.81 2.503 13.47 8.68 15.933 14.146l9.824 2.79s-1.34-19.132-18.645-24.047c-16.189-4.6-26.151 8.995-27.363 10.754c4.71-3.355 11.586-6.102 20.251-3.643m78.197 14.234c-16.204-4.62-26.162 9.003-27.356 10.737c4.713-3.351 11.586-6.099 20.247-3.629c8.797 2.506 13.452 8.676 15.923 14.146l9.837 2.8s-1.361-19.135-18.651-24.054m-9.76 50.443l-81.718-22.845s.885 4.485 4.279 10.293l68.803 19.234c5.664-3.277 8.636-6.682 8.636-6.682m-56.655 49.174C74.127 164.828 81.949 82.386 92.419 43.32c4.311-16.1 8.743-28.066 12.419-36.088c-2.193-.451-4.01.704-5.804 4.354C95.13 19.5 90.14 32.387 85.312 50.427c-10.467 39.066-18.29 121.506 46.412 138.854c30.497 8.17 54.256-4.247 71.966-23.749c-16.81 15.226-38.274 23.763-64.858 16.644"/>
                <path fill="#E2574C" d="M103.081 138.565v-16.637l-46.223 13.108s3.415-19.846 27.522-26.684c7.311-2.072 13.549-2.058 18.701-1.063V39.05h23.145c-2.52-7.787-4.958-13.782-7.006-17.948c-3.387-6.895-6.859-2.324-14.741 4.269c-5.552 4.638-19.583 14.533-40.698 20.222c-21.114 5.694-38.185 4.184-45.307 2.95c-10.097-1.742-15.378-3.96-14.884 3.721c.43 6.774 2.043 17.277 5.74 31.148c7.996 30.039 34.424 87.92 84.37 74.468c13.046-3.515 22.254-10.464 28.637-19.32h-19.256zm-74.588-54.74l35.494-9.35s-1.034 13.654-14.34 17.162c-13.31 3.504-21.154-7.812-21.154-7.812"/>
                <path fill="#2EAD33" d="M236.664 39.84c-9.226 1.617-31.361 3.632-58.716-3.7c-27.363-7.328-45.517-20.144-52.71-26.168c-10.197-8.54-14.682-14.476-19.096-5.498c-3.902 7.918-8.893 20.805-13.723 38.846c-10.466 39.066-18.289 121.505 46.413 138.853c64.687 17.333 99.126-57.978 109.593-97.047c4.83-18.037 6.948-31.695 7.53-40.502c.665-9.976-6.187-7.08-19.29-4.784M106.668 72.161s10.196-15.859 27.49-10.943c17.305 4.915 18.645 24.046 18.645 24.046zm42.215 71.163c-30.419-8.91-35.11-33.167-35.11-33.167l81.714 22.846c0-.004-16.494 19.12-46.604 10.32m28.89-49.85s10.183-15.847 27.474-10.918c17.29 4.923 18.651 24.054 18.651 24.054z"/>
                <path fill="#D65348" d="m86.928 126.51l-30.07 8.522s3.266-18.609 25.418-25.983L65.25 45.147l-1.471.447c-21.115 5.694-38.185 4.184-45.307 2.95c-10.097-1.741-15.379-3.96-14.885 3.722c.43 6.774 2.044 17.276 5.74 31.147c7.997 30.039 34.425 87.92 84.37 74.468l1.471-.462zM28.493 83.825l35.494-9.351s-1.034 13.654-14.34 17.162c-13.31 3.504-21.154-7.811-21.154-7.811"/>
                <path fill="#1D8D22" d="m150.255 143.658l-1.376-.335c-30.419-8.91-35.11-33.166-35.11-33.166l42.137 11.778l22.308-85.724l-.27-.07c-27.362-7.329-45.516-20.145-52.71-26.17c-10.196-8.54-14.682-14.475-19.096-5.497c-3.898 7.918-8.889 20.805-13.719 38.846c-10.466 39.066-18.289 121.505 46.413 138.852l1.326.3zM106.668 72.16s10.196-15.859 27.49-10.943c17.305 4.915 18.645 24.046 18.645 24.046z"/>
                <path fill="#C04B41" d="m88.46 126.072l-8.064 2.289c1.906 10.74 5.264 21.047 10.534 30.152c.918-.202 1.828-.376 2.762-.632c2.449-.66 4.72-1.479 6.906-2.371c-5.89-8.74-9.785-18.804-12.137-29.438m-3.148-75.644c-4.144 15.467-7.852 37.73-6.831 60.06c1.826-.793 3.756-1.532 5.9-2.14l1.492-.334c-1.82-23.852 2.114-48.157 6.546-64.694a323 323 0 0 1 3.373-11.704a105 105 0 0 1-5.974 3.547a307 307 0 0 0-4.506 15.265"/>
              </svg>
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 text-[8px] bg-amber-500 text-white rounded-full font-medium shadow-[0_0_8px_rgba(251,191,36,0.5)]">Beta</span>
            </button>
            {/* 新建下拉菜单 */}
            <div className="relative" ref={createMenuRef}>
              <button 
                onClick={() => setShowCreateMenu(!showCreateMenu)} 
                className={`px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 ${showCreateMenu ? 'shadow-lg shadow-primary/20' : ''}`}
              >
                <PlusIcon className="w-4 h-4" />
                新建
                <svg className={`w-3 h-3 ml-0.5 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                  <button
                    onClick={() => { handleCreatePrompt(); setShowCreateMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    新建提示词
                  </button>
                  <button
                    onClick={() => { setCategoryModal({ open: true }); setShowCreateMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <FolderIcon className="w-4 h-4 text-gray-500" />
                    新建分类
                  </button>
                </div>
              )}
            </div>
            {/* 更多菜单 */}
            <div className="relative" ref={moreMenuRef}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                onChange={(e) => { handleImportMD(e); setShowMoreMenu(false); }}
                className="hidden"
                disabled={isImporting}
              />
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${showMoreMenu ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                <MoreIcon className="w-4 h-4" />
                更多
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                  <button
                    onClick={() => { fileInputRef.current?.click(); }}
                    disabled={isImporting}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <svg className="w-4 h-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <ImportIcon className="w-4 h-4" />
                    )}
                    导入
                  </button>
                  <button
                    onClick={() => { toggleSelectMode(); setShowMoreMenu(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 ${isSelectMode ? 'text-primary' : 'text-gray-700'}`}
                  >
                    <ExportIcon className="w-4 h-4" />
                    批量导出
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 根据 activeTab 显示不同内容 */}
        {activeTab === 'prompts' ? (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="搜索提示词..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 outline-none focus:ring-2 ring-primary/20 placeholder-gray-400 transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {/* 排序按钮 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">排序:</span>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setSortBy('updated')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sortBy === 'updated' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    最近更新
                  </button>
                  <button
                    onClick={() => setSortBy('copies')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sortBy === 'copies' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    复制次数
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <button onClick={() => setSelectedCategoryId('ALL')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategoryId === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>全部</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} onContextMenu={(e) => categoryMenu.open(e, cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategoryId === cat.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{cat.name}</button>
                ))}
              </div>
            </div>

            {/* 置顶提示词区域 */}
            {(() => {
              const pinnedPrompts = filteredPrompts.filter(p => p.is_pinned);
              const normalPrompts = filteredPrompts.filter(p => !p.is_pinned);
              
              return (
                <>
                  {pinnedPrompts.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium text-gray-600">置顶</span>
                        <span className="text-xs text-gray-400">({pinnedPrompts.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        {pinnedPrompts.map(prompt => {
                          const colors = getCategoryColors(getCategoryColor(prompt.category_id));
                          const isSelected = selectedPromptIds.has(prompt.id);
                          return (
                            <div key={prompt.id} 
                              className={`group relative bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-2xl p-6 border-2 cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-amber-200'}`}
                              onClick={(e) => isSelectMode ? togglePromptSelection(prompt.id, e) : openPromptDetail(prompt)} 
                              onContextMenu={(e) => promptMenu.open(e, prompt)}
                            >
                              {/* 置顶标识 */}
                              <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                                <Pin className="w-4 h-4 text-white fill-white" />
                              </div>
                              {/* 选择模式下的复选框 */}
                              {isSelectMode && (
                                <div className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
                                  onClick={(e) => togglePromptSelection(prompt.id, e)}>
                                  {isSelected && <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                                </div>
                              )}
                              <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${colors.bg} ${colors.text}`}>{getCategoryName(prompt.category_id)}</span>
                                {!isSelectMode && (
                                  <button onClick={(e) => { e.stopPropagation(); promptMenu.open(e, prompt); }} className="p-1 rounded-lg hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity"><MoreIcon className="w-4 h-4 text-gray-400" /></button>
                                )}
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors">{prompt.title}</h3>
                              <p className="text-sm text-gray-500 line-clamp-3 mb-4">{stripHtml(prompt.content)}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-2">{prompt.tags?.map(tag => <span key={tag} className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">#{tag}</span>)}</div>
                                {(prompt.copy_count ?? 0) > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-amber-500" title="复制次数">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                    {prompt.copy_count}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 分割线 */}
                      {normalPrompts.length > 0 && (
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span className="text-xs text-gray-400">其他提示词</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* 普通提示词 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {normalPrompts.map(prompt => {
                      const colors = getCategoryColors(getCategoryColor(prompt.category_id));
                      const tagStyle = getCategoryTagStyle(getCategoryColor(prompt.category_id));
                      const isSelected = selectedPromptIds.has(prompt.id);
                      return (
                        <div key={prompt.id} className={`group bg-white rounded-2xl p-6 border cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all duration-300 relative ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'}`}
                          onClick={(e) => isSelectMode ? togglePromptSelection(prompt.id, e) : openPromptDetail(prompt)} onContextMenu={(e) => promptMenu.open(e, prompt)}>
                          {/* 选择模式下的复选框 */}
                          {isSelectMode && (
                            <div 
                              className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
                              onClick={(e) => togglePromptSelection(prompt.id, e)}
                            >
                              {isSelected && (
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-4">
                            <span className={tagStyle.className} style={tagStyle.style}>{getCategoryName(prompt.category_id)}</span>
                            {!isSelectMode && (
                              <button onClick={(e) => { e.stopPropagation(); promptMenu.open(e, prompt); }} className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><MoreIcon className="w-4 h-4 text-gray-400" /></button>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">{prompt.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-3 mb-4">{stripHtml(prompt.content)}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-2">{prompt.tags?.map(tag => <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">#{tag}</span>)}</div>
                            {(prompt.copy_count ?? 0) > 0 && (
                              <div className="flex items-center gap-1 text-xs text-gray-400" title="复制次数">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                                {prompt.copy_count}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!isSelectMode && (
                      <div onClick={handleCreatePrompt} className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all cursor-pointer min-h-[200px]">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"><PlusIcon className="w-6 h-6" /></div>
                        <span className="font-medium">新建提示词</span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {filteredPrompts.length === 0 && <div className="text-center py-16"><p className="text-gray-500 mb-2">暂无提示词</p><p className="text-gray-400 text-sm">点击上方按钮创建</p></div>}
          </>
        ) : (
          <PromptStatsPanel userId={userId} />
        )}
      </div>

      {promptMenu.isOpen && <ContextMenu x={promptMenu.x} y={promptMenu.y} items={getPromptMenuItems(promptMenu.data)} onClose={promptMenu.close} />}
      {categoryMenu.isOpen && <ContextMenu x={categoryMenu.x} y={categoryMenu.y} items={getCategoryMenuItems(categoryMenu.data)} onClose={categoryMenu.close} />}

      <CategoryEditModal open={categoryModal.open} category={categoryModal.category} onClose={() => setCategoryModal({ open: false })} onSave={handleSaveCategory} />
      
      <Modal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: 'prompt', id: '' })} title={`删除${deleteConfirm.type === 'prompt' ? '提示词' : '分类'}`}>
        <p className="text-gray-600 mb-6">
          {deleteConfirm.type === 'prompt' ? '选择删除方式' : '确定要删除吗？此操作无法撤销。'}
        </p>
        <div className="flex flex-col gap-2">
          {deleteConfirm.type === 'prompt' ? (
            <>
              <button onClick={() => handleDeletePrompt(false)} className="w-full px-4 py-3 rounded-lg text-orange-500 hover:bg-orange-50 font-medium">移到回收站</button>
              <button onClick={() => handleDeletePrompt(true)} className="w-full px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 font-medium">永久删除</button>
              <button onClick={() => setDeleteConfirm({ open: false, type: 'prompt', id: '' })} className="w-full px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100">取消</button>
            </>
          ) : (
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm({ open: false, type: 'prompt', id: '' })} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">取消</button>
              <button onClick={handleDeleteCategory} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">删除</button>
            </div>
          )}
        </div>
      </Modal>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* 选择模式底部操作栏 */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 pointer-events-auto">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{selectedPromptIds.size}</span>
                </div>
                <span className="text-sm text-gray-300">已选择</span>
              </div>
              
              <button
                onClick={() => {
                  if (selectedPromptIds.size === filteredPrompts.length) {
                    setSelectedPromptIds(new Set());
                  } else {
                    setSelectedPromptIds(new Set(filteredPrompts.map(p => p.id)));
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                {selectedPromptIds.size === filteredPrompts.length ? '取消全选' : '全选'}
              </button>

              <div className="w-px h-6 bg-gray-700" />

              <button
                onClick={handleBatchExportMD}
                disabled={selectedPromptIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ExportIcon className="w-4 h-4" />
                导出 MD
              </button>

              <button
                onClick={handleBatchExportPDF}
                disabled={selectedPromptIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PdfIcon className="w-4 h-4" />
                导出 PDF
              </button>

              <div className="w-px h-6 bg-gray-700" />

              <button
                onClick={toggleSelectMode}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Modals
const CategoryEditModal: React.FC<{ open: boolean; category?: PromptCategory; onClose: () => void; onSave: (data: any) => void }> = ({ open, category, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('gray');
  const [showColorWheel, setShowColorWheel] = useState(false);
  const [customColor, setCustomColor] = useState('#6b7280');
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // 预设颜色 - 更丰富的调色板
  const presetColors = [
    // 暖色系
    { name: 'red', hex: '#ef4444', label: '红色' },
    { name: 'orange', hex: '#f97316', label: '橙色' },
    { name: 'amber', hex: '#f59e0b', label: '琥珀' },
    { name: 'yellow', hex: '#eab308', label: '黄色' },
    // 绿色系
    { name: 'lime', hex: '#84cc16', label: '青柠' },
    { name: 'green', hex: '#22c55e', label: '绿色' },
    { name: 'emerald', hex: '#10b981', label: '翡翠' },
    { name: 'teal', hex: '#14b8a6', label: '青色' },
    // 蓝色系
    { name: 'cyan', hex: '#06b6d4', label: '青蓝' },
    { name: 'sky', hex: '#0ea5e9', label: '天蓝' },
    { name: 'blue', hex: '#3b82f6', label: '蓝色' },
    { name: 'indigo', hex: '#6366f1', label: '靛蓝' },
    // 紫粉系
    { name: 'violet', hex: '#8b5cf6', label: '紫罗兰' },
    { name: 'purple', hex: '#a855f7', label: '紫色' },
    { name: 'fuchsia', hex: '#d946ef', label: '品红' },
    { name: 'pink', hex: '#ec4899', label: '粉色' },
    // 中性色
    { name: 'rose', hex: '#f43f5e', label: '玫瑰' },
    { name: 'slate', hex: '#64748b', label: '石板' },
    { name: 'gray', hex: '#6b7280', label: '灰色' },
    { name: 'zinc', hex: '#71717a', label: '锌灰' },
  ];
  
  useEffect(() => { 
    if (open) { 
      setName(category?.name || ''); 
      const existingColor = category?.color || 'gray';
      setColor(existingColor);
      // 如果是自定义颜色（hex格式），设置到customColor
      if (existingColor.startsWith('#')) {
        setCustomColor(existingColor);
      } else {
        const preset = presetColors.find(p => p.name === existingColor);
        setCustomColor(preset?.hex || '#6b7280');
      }
    } 
  }, [open, category]);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!name.trim()) return; 
    // 如果选择了自定义颜色，使用hex值
    const finalColor = color === 'custom' ? customColor : color;
    onSave({ name: name.trim(), color: finalColor }); 
  };
  
  const getColorDisplay = (colorName: string) => {
    if (colorName === 'custom') return customColor;
    const preset = presetColors.find(p => p.name === colorName);
    return preset?.hex || '#6b7280';
  };
  
  return (
    <Modal isOpen={open} onClose={onClose} title={category ? '编辑分类' : '新建分类'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 名称输入 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">名称</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
            placeholder="分类名称..." 
            required 
          />
        </div>
        
        {/* 颜色选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">颜色</label>
          
          {/* 预设颜色网格 */}
          <div className="grid grid-cols-10 gap-2 mb-4">
            {presetColors.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  setColor(c.name);
                  setCustomColor(c.hex);
                }}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                  color === c.name 
                    ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' 
                    : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300'
                }`}
              />
            ))}
          </div>
          
          {/* 自定义颜色区域 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="relative">
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setColor('custom');
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div 
                className={`w-10 h-10 rounded-xl border-2 cursor-pointer transition-all ${
                  color === 'custom' ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                }`}
                style={{ backgroundColor: customColor, borderColor: customColor }}
                onClick={() => colorInputRef.current?.click()}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">自定义颜色</p>
              <p className="text-xs text-gray-500">点击色块打开色轮选择器</p>
            </div>
            <input
              type="text"
              value={customColor.toUpperCase()}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  setCustomColor(val);
                  if (val.length === 7) setColor('custom');
                }
              }}
              className="w-24 px-3 py-2 text-sm font-mono bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="#000000"
            />
          </div>
          
          {/* 预览 */}
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl">
            <p className="text-xs text-gray-500 mb-2">预览效果</p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: getColorDisplay(color) + '20' }}
              >
                <svg 
                  className="w-5 h-5" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ color: getColorDisplay(color) }}
                >
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              </div>
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: getColorDisplay(color) + '20',
                  color: getColorDisplay(color)
                }}
              >
                {name || '分类名称'}
              </span>
            </div>
          </div>
        </div>
        
        {/* 按钮 */}
        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button 
            type="submit" 
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-orange-600 transition-colors"
          >
            {category ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Icons
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>;
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
const MoreIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>;
const EditIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const CopyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>;
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
const ImportIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
const PdfIcon: React.FC<{ className?: string }> = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>;

// 目录项类型
interface TocItem {
  id: string;
  level: number;
  text: string;
}

// 独立的目录按钮组件 - 固定在容器右上角
const TocButton: React.FC<{
  content: string;
  editorContainerSelector: string;
}> = ({ content, editorContainerSelector }) => {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [activeTocIndex, setActiveTocIndex] = useState<number | null>(null);
  const [maxHeight, setMaxHeight] = useState(400);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 从 HTML 内容中提取标题
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const items: TocItem[] = [];
    headings.forEach((heading, index) => {
      items.push({
        id: `toc-${index}`,
        level: parseInt(heading.tagName[1]),
        text: heading.textContent || '',
      });
    });
    setTocItems(items);
  }, [content]);

  // 计算可用高度
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const parent = containerRef.current.closest('.flex-1.relative');
        if (parent) {
          const rect = parent.getBoundingClientRect();
          setMaxHeight(Math.max(200, rect.height - 24));
        }
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [isTocOpen]);

  // 点击目录项跳转
  const scrollToHeading = useCallback((index: number) => {
    // 直接查找编辑器内容区域的滚动容器
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    if (!scrollContainer) {
      console.warn('未找到滚动容器');
      return;
    }
    
    const headings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const targetHeading = headings[index] as HTMLElement;
    
    if (targetHeading) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const headingRect = targetHeading.getBoundingClientRect();
      const scrollTop = scrollContainer.scrollTop + (headingRect.top - containerRect.top) - 20;
      
      scrollContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
      
      // 高亮效果
      targetHeading.style.transition = 'background-color 0.3s';
      targetHeading.style.backgroundColor = 'rgba(249, 115, 22, 0.25)';
      targetHeading.style.borderRadius = '4px';
      setTimeout(() => {
        targetHeading.style.backgroundColor = '';
        setTimeout(() => {
          targetHeading.style.transition = '';
          targetHeading.style.borderRadius = '';
        }, 300);
      }, 1500);
    }
    setActiveTocIndex(index);
  }, []);

  if (tocItems.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute top-3 right-3 z-30">
      <button
        onClick={() => setIsTocOpen(!isTocOpen)}
        className={`p-2 rounded-lg transition-all ${isTocOpen ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100 shadow-md border border-gray-200'}`}
        title={isTocOpen ? '关闭目录' : '打开目录'}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isTocOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 right-10 w-64 rounded-xl shadow-2xl border border-white/20"
            style={{ 
              maxHeight: maxHeight,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="px-3 py-2 border-b border-gray-200/50 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-gray-600">目录</span>
              <span className="text-xs text-gray-400">{tocItems.length} 项</span>
            </div>
            <div 
              className="overflow-y-auto p-2 scrollbar-hide" 
              style={{ maxHeight: maxHeight - 40 }}
            >
              {tocItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(index)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors truncate ${
                    activeTocIndex === index 
                      ? 'bg-primary/15 text-primary font-medium' 
                      : 'text-gray-700 hover:bg-white/60 hover:text-orange-600'
                  }`}
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                >
                  <span className={`${item.level === 1 ? 'font-medium' : ''}`}>
                    {item.text || '(空标题)'}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 隐藏滚动条样式 */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

// Tiptap 编辑器组件 - 完整 MD 功能
const TiptapEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onReady?: () => void;
  showToc?: boolean;
}> = ({ content, onChange, placeholder, onReady }) => {
  const isUpdatingFromProps = React.useRef(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false, // 用 CodeBlockLowlight 替代
      }),
      Placeholder.configure({
        placeholder: placeholder || '输入内容...',
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // 如果是从 props 更新的，不触发 onChange
      if (isUpdatingFromProps.current) {
        return;
      }
      // 使用 getHTML() 保留格式
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-full',
      },
      // 处理 Markdown 粘贴
      handlePaste: (view, event, slice) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        
        // 检测是否包含 Markdown 语法
        const hasMarkdown = /^#{1,6}\s|^\*\*|^__|\*\*$|__$|^```|^-\s|^\d+\.\s|^\[.*\]\(.*\)|^>\s/m.test(text);
        
        if (hasMarkdown) {
          event.preventDefault();
          // 同步解析 Markdown
          const html = marked.parse(text, { async: false }) as string;
          // 使用 insertContent 命令插入 HTML
          const editor = (view as any).editor;
          if (editor) {
            editor.commands.insertContent(html);
            return true;
          }
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        // 在空标题行按 Backspace 时转换为段落
        if (event.key === 'Backspace') {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          const node = $from.parent;
          
          // 如果是标题节点且内容为空，转换为段落
          if (node.type.name === 'heading' && node.textContent === '') {
            const tr = state.tr.setBlockType($from.before(), $from.after(), state.schema.nodes.paragraph);
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
    },
    onCreate: () => {
      onReady?.();
    },
  });

  // 当外部 content 变化时更新编辑器
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isUpdatingFromProps.current = true;
      editor.commands.setContent(content);
      // 使用 requestAnimationFrame 确保在下一帧重置标志
      requestAnimationFrame(() => {
        isUpdatingFromProps.current = false;
      });
    }
  }, [content, editor]);

  return (
    <div className="h-full">
      <EditorContent editor={editor} className="h-full" />
      
      <style>{`
        .ProseMirror { padding: 20px; min-height: 100%; font-size: 14px; line-height: 1.8; color: #374151; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror p { margin: 0.5em 0; }
        .ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 0.75em 0 0.5em; color: #111827; }
        .ProseMirror h2 { font-size: 1.4em; font-weight: 600; margin: 0.75em 0 0.5em; color: #111827; }
        .ProseMirror h3 { font-size: 1.15em; font-weight: 600; margin: 0.75em 0 0.5em; color: #111827; }
        .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 { font-size: 1em; font-weight: 600; margin: 0.75em 0 0.5em; color: #111827; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
        .ProseMirror li { margin: 0.25em 0; }
        .ProseMirror li p { margin: 0; }
        .ProseMirror code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, monospace; }
        .ProseMirror pre { background: #1f2937; color: #e5e7eb; padding: 1em; border-radius: 8px; overflow-x: auto; margin: 1em 0; font-family: ui-monospace, SFMono-Regular, monospace; }
        .ProseMirror pre code { background: none; padding: 0; color: inherit; font-size: 13px; }
        .ProseMirror blockquote { border-left: 3px solid #f97316; padding-left: 1em; margin: 1em 0; color: #6b7280; }
        .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
        .ProseMirror strong { font-weight: 600; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror a { color: #f97316; text-decoration: underline; cursor: pointer; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
        .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .ProseMirror th, .ProseMirror td { border: 1px solid #e5e7eb; padding: 0.5em 1em; text-align: left; }
        .ProseMirror th { background: #f9fafb; font-weight: 600; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
        .ProseMirror ul[data-type="taskList"] li > label { margin-top: 0.25em; }
        .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
        .ProseMirror mark { background: #fef08a; padding: 0.1em 0.2em; border-radius: 2px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ::selection { background: rgba(249, 115, 22, 0.5); }
        .ProseMirror *::selection { background: rgba(249, 115, 22, 0.5); }
        /* 代码高亮 */
        .ProseMirror .hljs-comment, .ProseMirror .hljs-quote { color: #6b7280; }
        .ProseMirror .hljs-keyword, .ProseMirror .hljs-selector-tag { color: #c084fc; }
        .ProseMirror .hljs-string, .ProseMirror .hljs-attr { color: #86efac; }
        .ProseMirror .hljs-number, .ProseMirror .hljs-literal { color: #fbbf24; }
        .ProseMirror .hljs-title, .ProseMirror .hljs-section { color: #60a5fa; }
        .ProseMirror .hljs-built_in { color: #f472b6; }
      `}</style>
    </div>
  );
};

// 浏览器窗口组件 - 包含多个标签页，支持边缘拖拽缩放和内联编辑
export const PromptBrowserWindow: React.FC<{
  tabs: Prompt[];
  activeTabId: string | null;
  categories: PromptCategory[];
  autoEditId?: string | null;
  unsavedIds?: Set<string>;
  showRoleLibrary?: boolean;
  isRoleLibraryActive?: boolean;
  onTabChange: (id: string) => void;
  onTabClose: (id: string, e?: React.MouseEvent) => void;
  onMinimize: () => void;
  isMinimizing?: boolean;
  onClose: () => void;
  onSave: (prompt: Prompt, data: { title: string; content: string; category_id: string | null; tags: string[] }) => Promise<void>;
  onCopy: (content: string, promptId: string) => void;
  onClearAutoEdit: () => void;
  onEditStateChange: (promptId: string, hasChanges: boolean) => void;
  onRoleLibraryTabClick?: () => void;
  onCloseRoleLibrary?: () => void;
  getCategoryName: (id: string | null) => string;
  getCategoryColor: (id: string | null) => string;
}> = ({ tabs, activeTabId, categories, autoEditId, unsavedIds = new Set(), showRoleLibrary = false, isRoleLibraryActive = false, isMinimizing: isMinimizingProp, onTabChange, onTabClose, onMinimize, onClose, onSave, onCopy, onClearAutoEdit, onEditStateChange, onRoleLibraryTabClick, onCloseRoleLibrary, getCategoryName, getCategoryColor }) => {
  const windowRef = React.useRef<HTMLDivElement>(null);
  
  // 使用 useState 存储位置和大小
  const [position, setPosition] = useState(() => {
    const width = 1100;
    const height = 750;
    const x = Math.max(20, (window.innerWidth - width) / 2);
    const y = Math.max(20, (window.innerHeight - height) / 2 - 20);
    return { x, y };
  });
  const [size, setSize] = useState({ width: 1100, height: 750 });
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [savedPosition, setSavedPosition] = useState(() => ({ ...position }));
  const [savedSize, setSavedSize] = useState(() => ({ ...size }));
  
  const isMinimizing = isMinimizingProp ?? false;
  const isDragging = React.useRef(false);
  const isResizing = React.useRef<string | null>(null);
  const dragOffset = React.useRef({ x: 0, y: 0 });
  const resizeStart = React.useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  const activePrompt = tabs.find(t => t.id === activeTabId);
  const activeColors = activePrompt ? getCategoryColors(getCategoryColor(activePrompt.category_id)) : { bg: 'bg-gray-100', text: 'text-gray-600' };

  // 编辑状态 - 始终可编辑
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // 文档内搜索
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  
  // AI 侧边栏状态
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [aiSidebarTab, setAiSidebarTab] = useState<'translate' | 'optimize' | 'summarize'>('translate');
  
  // AI 生成标签状态
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  
  // 获取用户信息用于 AI 功能
  const user = getStoredUser();
  const userId = user?.id || '';
  
  // 用于追踪原始值，判断是否有变化
  const originalValues = React.useRef<{ title: string; content: string; categoryId: string; tags: string } | null>(null);
  // 标记是否是用户主动编辑（而非从 props 同步）
  const isUserEditing = React.useRef(false);

  // 全屏切换
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(false);
  
  const toggleFullscreen = () => {
    // 先设置 transitioning 状态，让内容区域简化渲染
    setIsFullscreenTransitioning(true);
    
    // 使用 requestAnimationFrame 确保状态更新后再开始动画
    requestAnimationFrame(() => {
      if (isFullscreen) {
        setPosition(savedPosition);
        setSize(savedSize);
        setIsFullscreen(false);
      } else {
        setSavedPosition({ ...position });
        setSavedSize({ ...size });
        setPosition({ x: 0, y: 0 });
        setSize({ width: window.innerWidth, height: window.innerHeight });
        setIsFullscreen(true);
      }
      // 动画结束后重置状态
      setTimeout(() => setIsFullscreenTransitioning(false), 380);
    });
  };

  // 复制并显示反馈
  const handleCopy = () => {
    if (activePrompt) {
      onCopy(editContent, activePrompt.id);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 清除搜索高亮
  const clearSearchHighlights = useCallback(() => {
    // 高亮清除现在由 SearchOverlay 组件内部处理
  }, []);

  // 搜索结果处理
  const handleSearchResults = useCallback((matches: SearchMatch[], index: number) => {
    setSearchMatches(matches);
    setCurrentSearchIndex(index);
  }, []);

  // 跳转到匹配项 - 现在由 SearchOverlay 内部处理滚动
  const handleNavigateToMatch = useCallback((match: SearchMatch) => {
    // 滚动已由 SearchOverlay 内部处理
  }, []);

  // 检查是否有未保存的更改
  const checkHasChanges = useCallback(() => {
    if (!activePrompt || !originalValues.current) return false;
    if (activePrompt.id.startsWith('temp_')) return false;
    
    const orig = originalValues.current;
    const currentTags = editTags.split(',').map(t => t.trim()).filter(Boolean).join(',');
    const origTags = orig.tags;
    
    return editTitle !== orig.title || 
           editContent !== orig.content || 
           editCategoryId !== orig.categoryId ||
           currentTags !== origTags;
  }, [activePrompt, editTitle, editContent, editCategoryId, editTags]);

  // 当用户编辑时检查变化
  const handleUserEdit = useCallback((field: 'title' | 'content' | 'categoryId' | 'tags', value: string) => {
    isUserEditing.current = true;
    
    if (field === 'title') setEditTitle(value);
    else if (field === 'content') setEditContent(value);
    else if (field === 'categoryId') setEditCategoryId(value);
    else if (field === 'tags') setEditTags(value);
  }, []);

  // 当用户编辑后检查变化状态
  useEffect(() => {
    if (!isUserEditing.current) return;
    isUserEditing.current = false;
    
    if (activePrompt && !activePrompt.id.startsWith('temp_')) {
      const hasChanges = checkHasChanges();
      onEditStateChange(activePrompt.id, hasChanges);
    }
  }, [editTitle, editContent, editCategoryId, editTags, activePrompt, checkHasChanges, onEditStateChange]);

  // 切换标签页或 activePrompt 更新时同步数据
  useEffect(() => {
    if (activePrompt) {
      const title = activePrompt.title;
      const content = activePrompt.content;
      const categoryId = activePrompt.category_id || categories[0]?.id || '';
      const tags = activePrompt.tags?.join(', ') || '';
      
      // 保存原始值
      originalValues.current = {
        title,
        content,
        categoryId,
        tags: activePrompt.tags?.join(',') || ''
      };
      
      // 同步到编辑状态（不触发变化检测）
      setEditTitle(title);
      setEditContent(content);
      setEditCategoryId(categoryId);
      setEditTags(tags);
      
      if (autoEditId && activePrompt.id === autoEditId) {
        onClearAutoEdit();
      }
    }
  }, [activeTabId, activePrompt?.id, activePrompt?.title, activePrompt?.content, activePrompt?.category_id, JSON.stringify(activePrompt?.tags)]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!activePrompt || !editTitle.trim() || !editContent.trim()) return;
    setIsSaving(true);
    try {
      await onSave(activePrompt, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category_id: editCategoryId || null,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean)
      });
      // 清除编辑状态
      if (!activePrompt.id.startsWith('temp_')) {
        onEditStateChange(activePrompt.id, false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [activePrompt, editTitle, editContent, editCategoryId, editTags, onSave, onEditStateChange]);

  // AI 生成标签
  const handleGenerateTags = useCallback(async () => {
    if (!userId || !editContent.trim() || isGeneratingTags) return;
    
    // 检查是否配置了 AI 提供商
    const hasProvider = await hasEnabledProvider(userId);
    if (!hasProvider) {
      alert('请先在设置中配置 AI 提供商');
      return;
    }
    
    setIsGeneratingTags(true);
    try {
      // 从 HTML 中提取纯文本
      const tmp = document.createElement('div');
      tmp.innerHTML = editContent;
      const plainContent = tmp.textContent || tmp.innerText || '';
      
      const tags = await generateTags(userId, plainContent);
      if (tags.length > 0) {
        // 合并现有标签和新生成的标签
        const existingTags = editTags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        const allTags = [...new Set([...existingTags, ...tags])];
        handleUserEdit('tags', allTags.join(', '));
      }
    } catch (err: any) {
      console.error('生成标签失败:', err);
      alert(err.message || '生成标签失败');
    } finally {
      setIsGeneratingTags(false);
    }
  }, [userId, editContent, editTags, isGeneratingTags, handleUserEdit]);

  // Ctrl+S 保存快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && editTitle.trim() && editContent.trim()) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, editTitle, editContent, handleSave]);

  // 处理最小化动画
  const handleMinimize = () => {
    onMinimize();
  };

  // 拖拽标题栏移动窗口
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls') || (e.target as HTMLElement).closest('.tab-item')) return;
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  // 边缘缩放
  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    isResizing.current = direction;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      } else if (isResizing.current) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const dir = isResizing.current;
        const minW = 600, minH = 400;

        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.posX;
        let newY = resizeStart.current.posY;

        // 右侧边界
        if (dir.includes('e')) {
          newWidth = Math.max(minW, resizeStart.current.width + dx);
        }
        // 左侧边界 - 需要同时调整位置和宽度
        if (dir.includes('w')) {
          const potentialWidth = resizeStart.current.width - dx;
          if (potentialWidth >= minW) {
            newWidth = potentialWidth;
            newX = resizeStart.current.posX + dx;
          } else {
            // 达到最小宽度时，固定右边界位置
            newWidth = minW;
            newX = resizeStart.current.posX + resizeStart.current.width - minW;
          }
        }
        // 下侧边界
        if (dir.includes('s')) {
          newHeight = Math.max(minH, resizeStart.current.height + dy);
        }
        // 上侧边界 - 需要同时调整位置和高度
        if (dir.includes('n')) {
          const potentialHeight = resizeStart.current.height - dy;
          if (potentialHeight >= minH) {
            newHeight = potentialHeight;
            newY = resizeStart.current.posY + dy;
          } else {
            // 达到最小高度时，固定下边界位置
            newHeight = minH;
            newY = resizeStart.current.posY + resizeStart.current.height - minH;
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const resizeHandleClass = "absolute bg-transparent z-10";

  // 入场动画状态
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'minimizing'>('entering');
  
  useEffect(() => {
    // 入场动画 - 稍微延迟让浏览器准备好
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationState('visible');
      });
    });
  }, []);

  // 监听最小化状态
  useEffect(() => {
    if (isMinimizing) {
      setAnimationState('minimizing');
    }
  }, [isMinimizing]);

  // 计算最小化目标位置（底部中央按钮位置）
  const minimizeTargetX = window.innerWidth / 2;
  const minimizeTargetY = window.innerHeight - 50;

  // 根据动画状态计算 transform 和 opacity
  const getAnimationStyles = () => {
    if (animationState === 'entering') {
      return {
        opacity: 0,
        transform: 'translateY(50px) scale(0.96)',
      };
    }
    if (animationState === 'minimizing') {
      const centerX = position.x + size.width / 2;
      const centerY = position.y + size.height / 2;
      const dx = minimizeTargetX - centerX;
      const dy = minimizeTargetY - centerY;
      return {
        opacity: 0,
        transform: `translate(${dx}px, ${dy}px) scale(0.1)`,
      };
    }
    return {
      opacity: 1,
      transform: 'translateY(0) scale(1)',
    };
  };

  const animStyles = getAnimationStyles();

  // 计算 transition - 始终保持 opacity 和 transform 的 transition
  const getTransition = () => {
    const baseTransition = 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
    
    if (isFullscreenTransitioning) {
      return `${baseTransition}, width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), top 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.35s ease`;
    }
    return baseTransition;
  };

  return (
    <div 
      ref={windowRef}
      style={{ 
        position: 'fixed',
        width: size.width,
        height: size.height,
        left: position.x,
        top: position.y,
        borderRadius: isFullscreen ? 0 : 12,
        pointerEvents: isMinimizing ? 'none' : 'auto',
        zIndex: isMinimizing ? -1 : 50,
        opacity: animStyles.opacity,
        transform: animStyles.transform,
        transition: getTransition(),
        willChange: isFullscreenTransitioning ? 'width, height, left, top, transform, opacity' : 'auto',
      }}
      className="bg-white shadow-2xl overflow-visible flex flex-col"
    >
      {/* 缩放手柄 - 全屏时隐藏 */}
      {!isFullscreen && (
        <>
          <div className={`${resizeHandleClass} -top-1 -left-1 w-3 h-3 cursor-nw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
          <div className={`${resizeHandleClass} -top-1 -right-1 w-3 h-3 cursor-ne-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div className={`${resizeHandleClass} -bottom-1 -left-1 w-3 h-3 cursor-sw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div className={`${resizeHandleClass} -bottom-1 -right-1 w-3 h-3 cursor-se-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          <div className={`${resizeHandleClass} -top-1 left-2 right-2 h-2 cursor-n-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div className={`${resizeHandleClass} -bottom-1 left-2 right-2 h-2 cursor-s-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
          <div className={`${resizeHandleClass} -left-1 top-2 bottom-2 w-2 cursor-w-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div className={`${resizeHandleClass} -right-1 top-2 bottom-2 w-2 cursor-e-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
        </>
      )}
      {/* 标题栏 + 标签页 */}
      <div 
        onMouseDown={!isFullscreen ? handleTitleMouseDown : undefined}
        className={`bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 select-none shrink-0 ${isFullscreen ? 'rounded-t-none' : 'rounded-t-xl cursor-grab active:cursor-grabbing'}`}
      >
        {/* 顶部控制栏 */}
        <div className="h-11 flex items-center px-3">
          <div className="flex items-center gap-2 window-controls">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors group flex items-center justify-center">
              <svg className="w-2 h-2 text-[#990000] opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors group flex items-center justify-center">
              <svg className="w-2 h-2 text-[#995700] opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
            </button>
            <button onClick={toggleFullscreen} className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors group flex items-center justify-center">
              <svg className="w-2 h-2 text-[#006500] opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                ) : (
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                )}
              </svg>
            </button>
          </div>
          <div className="flex-1" />
          <div className="w-16" />
        </div>

        {/* 标签页栏 */}
        <div className="h-9 flex items-end px-2 gap-1 overflow-x-auto">
          {/* 角色库标签 - 只有打开时才显示 */}
          {showRoleLibrary && (
            <div
              onClick={() => onRoleLibraryTabClick?.()}
              className={`tab-item flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-all group max-w-[200px] ${
                isRoleLibraryActive ? 'bg-white border-t border-l border-r border-gray-200' : 'bg-gray-200/50 hover:bg-gray-200'
              }`}
            >
              <div className="w-4 h-4 rounded shrink-0 bg-gray-800 flex items-center justify-center">
                <span className="text-[10px]">🎭</span>
              </div>
              <span className={`text-xs truncate font-medium ${isRoleLibraryActive ? 'text-gray-800' : 'text-gray-600'}`}>
                角色库
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseRoleLibrary?.();
                }}
                className={`shrink-0 p-0.5 rounded hover:bg-gray-300 transition-opacity ${isRoleLibraryActive ? 'text-gray-400 hover:text-gray-600' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          
          {/* 提示词标签 */}
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId && !isRoleLibraryActive;
            const isUnsaved = unsavedIds.has(tab.id);
            const colors = getCategoryColors(getCategoryColor(tab.category_id));
            return (
              <div
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                }}
                className={`tab-item flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-all group max-w-[200px] ${
                  isActive ? 'bg-white border-t border-l border-r border-gray-200' : 'bg-gray-200/50 hover:bg-gray-200'
                }`}
              >
                <div className={`w-4 h-4 rounded shrink-0 ${colors.bg} flex items-center justify-center`}>
                  <svg className={`w-2.5 h-2.5 ${colors.text}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <span className={`text-xs truncate relative ${isActive ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                  {tab.title}
                  {isUnsaved && (
                    <span className="absolute -top-1 -right-2.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  )}
                </span>
                <button
                  onClick={(e) => onTabClose(tab.id, e)}
                  className={`shrink-0 p-0.5 rounded hover:bg-gray-300 transition-opacity ${isActive ? 'text-gray-400 hover:text-gray-600' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 地址栏 */}
      <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-gray-200 text-gray-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="p-1.5 rounded hover:bg-gray-200 text-gray-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <button className="p-1.5 rounded hover:bg-gray-200 text-gray-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
          </button>
        </div>
        <div className="flex-1 flex items-center bg-white rounded-lg border border-gray-200 px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {activePrompt ? (
            <span className="text-xs text-gray-500">
              lumina://prompts/<span className="text-gray-700">{getCategoryName(activePrompt.category_id)}</span>/<span className="text-primary font-medium">{editTitle || activePrompt.title}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">选择一个标签页</span>
          )}
        </div>
        {/* 保存按钮 */}
        {activePrompt && (
          <div className="flex items-center gap-2">
            {/* 未保存提示 */}
            {unsavedIds.has(activePrompt.id) && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                未保存
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !editTitle.trim() || !editContent.trim()}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                unsavedIds.has(activePrompt.id)
                  ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-200'
                  : 'bg-primary text-white hover:bg-primary/90'
              } disabled:opacity-50`}
            >
              {isSaving ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
              )}
              保存
            </button>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden bg-[#FAFAFA] flex">
        {/* 主内容 */}
        <div className="flex-1 overflow-hidden">
          {isRoleLibraryActive ? (
            <RoleLibraryContent />
          ) : activePrompt ? (
            <div className="h-full flex flex-col p-6 overflow-y-auto">
              {/* 始终可编辑 - 紧凑布局，内容占大头 */}
              <div className="h-full flex flex-col gap-4">
                {/* 顶部信息栏 - 紧凑 */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">分类</span>
                    <select
                      value={editCategoryId}
                      onChange={(e) => handleUserEdit('categoryId', e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 ring-primary/20"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => handleUserEdit('title', e.target.value)}
                    className="w-full text-xl font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20"
                    placeholder="输入标题..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">标签</span>
                  <div className="relative">
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => handleUserEdit('tags', e.target.value)}
                      className="w-48 pl-3 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 ring-primary/20"
                      placeholder="逗号分隔..."
                    />
                    <button
                      onClick={handleGenerateTags}
                      disabled={isGeneratingTags || !editContent.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="AI 生成标签"
                    >
                      {isGeneratingTags ? (
                        <svg className="w-4 h-4 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <Sparkles className="w-4 h-4 text-gray-400 hover:text-primary" />
                      )}
                    </button>
                  </div>
                </div>
                {/* 复制按钮 */}
                <button 
                  onClick={handleCopy} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isCopied 
                      ? 'bg-green-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                
                    </>
                  )}
                </button>
              </div>

              {/* 内容编辑 - Tiptap WYSIWYG */}
              <div className="flex-1 relative" style={{ overflow: 'visible' }}>
                {/* 目录按钮 - 固定在编辑器右上角，不随内容滚动 */}
                <TocButton content={editContent} editorContainerSelector=".ProseMirror" />
                
                {/* 文档内搜索 - Ctrl+F */}
                <SearchOverlay
                  content={editContent.replace(/<[^>]*>/g, '')}
                  onSearchResults={handleSearchResults}
                  onNavigateToMatch={handleNavigateToMatch}
                  onClose={clearSearchHighlights}
                  position="top"
                  editorSelector=".ProseMirror"
                />
                
                <div 
                  ref={editorContainerRef}
                  className="absolute inset-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
                  style={{
                    // 全屏切换时优化渲染性能
                    contain: isFullscreenTransitioning ? 'strict' : 'none',
                  }}
                >
                  {/* AI 工具栏 */}
                  <AIEditorToolbar
                    isOpen={showAISidebar}
                    onToggle={() => setShowAISidebar(!showAISidebar)}
                  />
                  
                  <div className="flex-1 overflow-y-auto">
                    <TiptapEditor
                      content={editContent}
                      onChange={(content) => handleUserEdit('content', content)}
                      placeholder="输入提示词内容，支持 Markdown 语法..."
                      showToc={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="text-gray-400">选择一个标签页查看内容</p>
            </div>
          </div>
        )}
        </div>
        
        {/* AI 侧边栏 */}
        {activePrompt && !isRoleLibraryActive && (
          <AIEditorSidebar
            promptId={activePrompt.id}
            content={editContent}
            isOpen={showAISidebar}
            onClose={() => setShowAISidebar(false)}
            onContentChange={(content) => handleUserEdit('content', content)}
            defaultTab={aiSidebarTab}
          />
        )}
      </div>
    </div>
  );
};
