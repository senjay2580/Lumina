import React, { useState, useEffect, useCallback } from 'react';
import { ContextMenu, useContextMenu, ContextMenuItem } from '../shared/ContextMenu';
import { Modal } from '../shared/Modal';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { getStoredUser } from '../lib/auth';
import * as api from '../lib/prompts';

type PromptCategory = api.PromptCategory;
type Prompt = api.Prompt;

const getCategoryColors = (color: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  return colors[color] || colors.gray;
};

export const PromptManager: React.FC = () => {
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
  
  // 多标签页状态 - 单个浏览器窗口内的标签页
  const [browserTabs, setBrowserTabs] = useState<Prompt[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isBrowserMinimized, setIsBrowserMinimized] = useState(false);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const [newPromptIds, setNewPromptIds] = useState<Set<string>>(new Set()); // 跟踪未保存的新提示词
  const [editedPromptIds, setEditedPromptIds] = useState<Set<string>>(new Set()); // 跟踪已编辑但未保存的提示词
  const [unsavedConfirm, setUnsavedConfirm] = useState<{ open: boolean; promptId: string | null; action: 'close' | 'closeAll' }>({ open: false, promptId: null, action: 'close' });

  const promptMenu = useContextMenu();
  const categoryMenu = useContextMenu();
  const toast = useToast();

  // 打开提示词详情（添加到标签页）
  const openPromptDetail = (prompt: Prompt) => {
    const existingTab = browserTabs.find(t => t.id === prompt.id);
    if (existingTab) {
      // 已存在，激活该标签
      setActiveTabId(prompt.id);
      setIsBrowserMinimized(false);
    } else {
      // 新建标签页
      setBrowserTabs(prev => [...prev, prompt]);
      setActiveTabId(prompt.id);
      setIsBrowserMinimized(false);
    }
  };

  // 关闭标签页
  const closeTab = (promptId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 检查是否是未保存的新提示词或已编辑的提示词
    if (newPromptIds.has(promptId) || editedPromptIds.has(promptId)) {
      setUnsavedConfirm({ open: true, promptId, action: 'close' });
      return;
    }
    doCloseTab(promptId);
  };

  // 实际关闭标签页
  const doCloseTab = (promptId: string) => {
    const newTabs = browserTabs.filter(t => t.id !== promptId);
    setBrowserTabs(newTabs);
    // 如果是新提示词，从跟踪列表中移除
    if (newPromptIds.has(promptId)) {
      setNewPromptIds(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
    // 如果是已编辑的提示词，从跟踪列表中移除
    if (editedPromptIds.has(promptId)) {
      setEditedPromptIds(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
    if (activeTabId === promptId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  // 放弃未保存的提示词（新建或已编辑）
  const discardNewPrompt = () => {
    if (unsavedConfirm.promptId) {
      doCloseTab(unsavedConfirm.promptId);
    }
    setUnsavedConfirm({ open: false, promptId: null, action: 'close' });
  };

  // 获取当前激活的提示词
  const activePrompt = browserTabs.find(t => t.id === activeTabId);

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

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPrompts = prompts.filter(p => 
    (selectedCategoryId === 'ALL' || p.category_id === selectedCategoryId) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  const getCategoryName = (categoryId: string | null) => categoryId ? categories.find(c => c.id === categoryId)?.name || '未分类' : '未分类';
  const getCategoryColor = (categoryId: string | null) => categoryId ? categories.find(c => c.id === categoryId)?.color || 'gray' : 'gray';

  // 创建新提示词（本地临时创建，不插入数据库）
  const handleCreatePrompt = () => {
    const tempId = `temp_${Date.now()}`;
    const newPrompt: Prompt = {
      id: tempId,
      title: '新提示词',
      content: '',
      category_id: categories[0]?.id || null,
      tags: [],
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // 添加到标签页并标记为新提示词
    setBrowserTabs(prev => [...prev, newPrompt]);
    setActiveTabId(tempId);
    setAutoEditId(tempId);
    setNewPromptIds(prev => new Set(prev).add(tempId));
    setIsBrowserMinimized(false);
  };

  const handleDeletePrompt = async () => {
    try {
      await api.deletePrompt(deleteConfirm.id);
      setPrompts(prev => prev.filter(p => p.id !== deleteConfirm.id));
      toast.info('提示词已删除');
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

  const getPromptMenuItems = (prompt: Prompt): ContextMenuItem[] => [
    { label: '复制', icon: <CopyIcon />, onClick: () => handleDuplicatePrompt(prompt) },
    { label: '', divider: true, onClick: () => {} },
    { label: '删除', icon: <TrashIcon />, danger: true, onClick: () => setDeleteConfirm({ open: true, type: 'prompt', id: prompt.id }) }
  ];

  const getCategoryMenuItems = (category: PromptCategory): ContextMenuItem[] => [
    { label: '编辑', icon: <EditIcon />, onClick: () => setCategoryModal({ open: true, category }) },
    { label: '', divider: true, onClick: () => {} },
    { label: '删除', icon: <TrashIcon />, danger: true, onClick: () => setDeleteConfirm({ open: true, type: 'category', id: category.id }) }
  ];

  if (loading) return <div className="w-full h-full flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-gray-500 text-sm">加载中...</p></div></div>;
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
            <button onClick={() => setCategoryModal({ open: true })} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all flex items-center gap-2"><FolderIcon className="w-4 h-4" />管理分类</button>
            <button onClick={handleCreatePrompt} className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"><PlusIcon className="w-4 h-4" />新建提示词</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="搜索提示词..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 outline-none focus:ring-2 ring-primary/20 placeholder-gray-400 transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setSelectedCategoryId('ALL')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategoryId === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>全部</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} onContextMenu={(e) => categoryMenu.open(e, cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategoryId === cat.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{cat.name}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(prompt => {
            const colors = getCategoryColors(getCategoryColor(prompt.category_id));
            return (
              <div key={prompt.id} className="group bg-white rounded-2xl p-6 border border-gray-100 cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all duration-300"
                onClick={() => openPromptDetail(prompt)} onContextMenu={(e) => promptMenu.open(e, prompt)}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${colors.bg} ${colors.text}`}>{getCategoryName(prompt.category_id)}</span>
                  <button onClick={(e) => { e.stopPropagation(); promptMenu.open(e, prompt); }} className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><MoreIcon className="w-4 h-4 text-gray-400" /></button>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">{prompt.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-3 mb-4">{prompt.content}</p>
                <div className="flex flex-wrap gap-2">{prompt.tags?.map(tag => <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">#{tag}</span>)}</div>
              </div>
            );
          })}
          <div onClick={handleCreatePrompt} className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all cursor-pointer min-h-[200px]">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"><PlusIcon className="w-6 h-6" /></div>
            <span className="font-medium">新建提示词</span>
          </div>
        </div>

        {filteredPrompts.length === 0 && <div className="text-center py-16"><p className="text-gray-500 mb-2">暂无提示词</p><p className="text-gray-400 text-sm">点击上方按钮创建</p></div>}
      </div>

      {promptMenu.isOpen && <ContextMenu x={promptMenu.x} y={promptMenu.y} items={getPromptMenuItems(promptMenu.data)} onClose={promptMenu.close} />}
      {categoryMenu.isOpen && <ContextMenu x={categoryMenu.x} y={categoryMenu.y} items={getCategoryMenuItems(categoryMenu.data)} onClose={categoryMenu.close} />}

      <CategoryEditModal open={categoryModal.open} category={categoryModal.category} onClose={() => setCategoryModal({ open: false })} onSave={handleSaveCategory} />
      
      <Modal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: 'prompt', id: '' })} title={`删除${deleteConfirm.type === 'prompt' ? '提示词' : '分类'}`}>
        <p className="text-gray-600 mb-6">确定要删除吗？此操作无法撤销。</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm({ open: false, type: 'prompt', id: '' })} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">取消</button>
          <button onClick={deleteConfirm.type === 'prompt' ? handleDeletePrompt : handleDeleteCategory} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">删除</button>
        </div>
      </Modal>

      {/* 底部任务栏 - 显示最小化的浏览器 */}
      {isBrowserMinimized && browserTabs.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 h-12 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex items-center px-4 gap-2 z-40">
          <button
            onClick={() => setIsBrowserMinimized(false)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <span className="text-sm text-gray-300">Prompts</span>
            <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{browserTabs.length}</span>
          </button>
        </div>
      )}

      {/* 浏览器窗口 - 包含多个标签页 */}
      {browserTabs.length > 0 && !isBrowserMinimized && (
        <PromptBrowserWindow
          tabs={browserTabs}
          activeTabId={activeTabId}
          categories={categories}
          autoEditId={autoEditId}
          onTabChange={setActiveTabId}
          onTabClose={closeTab}
          onMinimize={() => setIsBrowserMinimized(true)}
          onClose={() => {
            // 检查是否有未保存的新提示词或已编辑的提示词
            const hasUnsaved = browserTabs.some(t => newPromptIds.has(t.id) || editedPromptIds.has(t.id));
            if (hasUnsaved) {
              setUnsavedConfirm({ open: true, promptId: null, action: 'closeAll' });
              return;
            }
            setBrowserTabs([]);
            setActiveTabId(null);
            setAutoEditId(null);
          }}
          onSave={async (prompt, data) => {
            try {
              // 检查是否是新提示词（临时ID）
              if (newPromptIds.has(prompt.id)) {
                // 创建新提示词
                const created = await api.createPrompt(userId, data);
                setPrompts(prev => [created, ...prev]);
                // 更新标签页中的提示词（替换临时ID）
                setBrowserTabs(prev => prev.map(t => t.id === prompt.id ? created : t));
                setActiveTabId(created.id);
                // 从新提示词跟踪列表中移除
                setNewPromptIds(prev => {
                  const next = new Set(prev);
                  next.delete(prompt.id);
                  return next;
                });
                toast.success('提示词已创建');
              } else {
                // 更新已有提示词
                const updated = await api.updatePrompt(prompt.id, data);
                setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p));
                setBrowserTabs(prev => prev.map(t => t.id === updated.id ? updated : t));
                toast.success('提示词已更新');
              }
            } catch (err: any) {
              toast.error(err.message || '保存失败');
            }
          }}
          onCopy={async (content) => {
            try {
              await navigator.clipboard.writeText(content);
              toast.success('已复制到剪贴板');
            } catch {
              toast.error('复制失败');
            }
          }}
          onClearAutoEdit={() => setAutoEditId(null)}
          onEditStateChange={(promptId, hasChanges) => {
            setEditedPromptIds(prev => {
              const next = new Set(prev);
              if (hasChanges) {
                next.add(promptId);
              } else {
                next.delete(promptId);
              }
              return next;
            });
          }}
          getCategoryName={getCategoryName}
          getCategoryColor={getCategoryColor}
        />
      )}

      {/* 未保存确认对话框 */}
      <Modal isOpen={unsavedConfirm.open} onClose={() => setUnsavedConfirm({ open: false, promptId: null, action: 'close' })} title="未保存的更改">
        <p className="text-gray-600 mb-6">你有未保存的更改，确定要放弃吗？</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setUnsavedConfirm({ open: false, promptId: null, action: 'close' })} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">取消</button>
          <button onClick={() => {
            if (unsavedConfirm.action === 'closeAll') {
              // 关闭所有标签页，清除未保存的新提示词和已编辑的提示词
              setBrowserTabs([]);
              setActiveTabId(null);
              setAutoEditId(null);
              setNewPromptIds(new Set());
              setEditedPromptIds(new Set());
            } else {
              discardNewPrompt();
            }
            setUnsavedConfirm({ open: false, promptId: null, action: 'close' });
          }} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">放弃</button>
        </div>
      </Modal>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
};

// Modals
const CategoryEditModal: React.FC<{ open: boolean; category?: PromptCategory; onClose: () => void; onSave: (data: any) => void }> = ({ open, category, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('gray');
  const colors = ['orange', 'blue', 'green', 'purple', 'red', 'pink', 'yellow', 'gray'];
  useEffect(() => { if (open) { setName(category?.name || ''); setColor(category?.color || 'gray'); } }, [open, category]);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; onSave({ name: name.trim(), color }); };
  return (
    <Modal isOpen={open} onClose={onClose} title={category ? '编辑分类' : '新建分类'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">名称</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="分类名称..." required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-2">颜色</label><div className="flex gap-2">{colors.map(c => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-lg ${getCategoryColors(c).bg} ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} />)}</div></div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">取消</button><button type="submit" className="px-6 py-2 rounded-lg bg-primary text-white">{category ? '保存' : '创建'}</button></div>
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

// 浏览器窗口组件 - 包含多个标签页，支持边缘拖拽缩放和内联编辑
const PromptBrowserWindow: React.FC<{
  tabs: Prompt[];
  activeTabId: string | null;
  categories: PromptCategory[];
  autoEditId?: string | null;
  onTabChange: (id: string) => void;
  onTabClose: (id: string, e?: React.MouseEvent) => void;
  onMinimize: () => void;
  onClose: () => void;
  onSave: (prompt: Prompt, data: { title: string; content: string; category_id: string | null; tags: string[] }) => Promise<void>;
  onCopy: (content: string) => void;
  onClearAutoEdit: () => void;
  onEditStateChange: (promptId: string, hasChanges: boolean) => void;
  getCategoryName: (id: string | null) => string;
  getCategoryColor: (id: string | null) => string;
}> = ({ tabs, activeTabId, categories, autoEditId, onTabChange, onTabClose, onMinimize, onClose, onSave, onCopy, onClearAutoEdit, onEditStateChange, getCategoryName, getCategoryColor }) => {
  const windowRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1100, height: 750 });
  const isDragging = React.useRef(false);
  const isResizing = React.useRef<string | null>(null);
  const dragOffset = React.useRef({ x: 0, y: 0 });
  const resizeStart = React.useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  // 内联编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activePrompt = tabs.find(t => t.id === activeTabId);
  const activeColors = activePrompt ? getCategoryColors(getCategoryColor(activePrompt.category_id)) : { bg: 'bg-gray-100', text: 'text-gray-600' };

  // 检查是否有未保存的更改
  const checkHasChanges = useCallback(() => {
    if (!activePrompt || !isEditing) return false;
    // 新提示词不在这里检查（由 newPromptIds 跟踪）
    if (activePrompt.id.startsWith('temp_')) return false;
    const tagsChanged = editTags.split(',').map(t => t.trim()).filter(Boolean).join(',') !== (activePrompt.tags || []).join(',');
    return editTitle !== activePrompt.title || 
           editContent !== activePrompt.content || 
           editCategoryId !== (activePrompt.category_id || '') ||
           tagsChanged;
  }, [activePrompt, isEditing, editTitle, editContent, editCategoryId, editTags]);

  // 当编辑状态变化时通知父组件
  useEffect(() => {
    if (activePrompt && !activePrompt.id.startsWith('temp_')) {
      const hasChanges = checkHasChanges();
      onEditStateChange(activePrompt.id, hasChanges);
    }
  }, [editTitle, editContent, editCategoryId, editTags, isEditing, activePrompt]);

  // 自动进入编辑模式
  useEffect(() => {
    if (autoEditId && activePrompt && activePrompt.id === autoEditId && !isEditing) {
      setEditTitle(activePrompt.title);
      setEditContent(activePrompt.content);
      setEditCategoryId(activePrompt.category_id || categories[0]?.id || '');
      setEditTags(activePrompt.tags?.join(', ') || '');
      setIsEditing(true);
      onClearAutoEdit();
    }
  }, [autoEditId, activePrompt, isEditing]);

  // 进入编辑模式
  const enterEditMode = () => {
    if (activePrompt) {
      setEditTitle(activePrompt.title);
      setEditContent(activePrompt.content);
      setEditCategoryId(activePrompt.category_id || categories[0]?.id || '');
      setEditTags(activePrompt.tags?.join(', ') || '');
      setIsEditing(true);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    if (activePrompt && !activePrompt.id.startsWith('temp_')) {
      onEditStateChange(activePrompt.id, false);
    }
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
    setEditCategoryId('');
    setEditTags('');
  };

  // 保存编辑
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
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [activePrompt, editTitle, editContent, editCategoryId, editTags, onSave, onEditStateChange]);

  // 切换标签页时退出编辑模式
  useEffect(() => {
    if (isEditing) {
      cancelEdit();
    }
  }, [activeTabId]);

  // Ctrl+S 保存快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditing && !isSaving && editTitle.trim() && editContent.trim()) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isSaving, editTitle, editContent, handleSave]);

  // 初始化居中位置
  useEffect(() => {
    const x = Math.max(20, (window.innerWidth - size.width) / 2);
    const y = Math.max(20, (window.innerHeight - size.height) / 2 - 20);
    setPosition({ x, y });
  }, []);

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

        if (dir.includes('e')) newWidth = Math.max(minW, resizeStart.current.width + dx);
        if (dir.includes('w')) {
          newWidth = Math.max(minW, resizeStart.current.width - dx);
          if (newWidth > minW) newX = resizeStart.current.posX + dx;
        }
        if (dir.includes('s')) newHeight = Math.max(minH, resizeStart.current.height + dy);
        if (dir.includes('n')) {
          newHeight = Math.max(minH, resizeStart.current.height - dy);
          if (newHeight > minH) newY = resizeStart.current.posY + dy;
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
    };
  }, [position, size]);

  const resizeHandleClass = "absolute bg-transparent z-10";

  return (
    <div 
      ref={windowRef}
      style={{ 
        width: size.width, 
        height: size.height, 
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: 'transform, width, height',
        animation: 'fadeInScale 0.2s ease-out'
      }}
      className="fixed top-0 left-0 bg-white rounded-xl shadow-2xl overflow-visible flex flex-col z-50"
    >
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: translate(${position.x}px, ${position.y}px) scale(0.95); }
          to { opacity: 1; transform: translate(${position.x}px, ${position.y}px) scale(1); }
        }
      `}</style>
      {/* 缩放手柄 */}
      <div className={`${resizeHandleClass} -top-1 -left-1 w-3 h-3 cursor-nw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
      <div className={`${resizeHandleClass} -top-1 -right-1 w-3 h-3 cursor-ne-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
      <div className={`${resizeHandleClass} -bottom-1 -left-1 w-3 h-3 cursor-sw-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
      <div className={`${resizeHandleClass} -bottom-1 -right-1 w-3 h-3 cursor-se-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
      <div className={`${resizeHandleClass} -top-1 left-2 right-2 h-2 cursor-n-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
      <div className={`${resizeHandleClass} -bottom-1 left-2 right-2 h-2 cursor-s-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
      <div className={`${resizeHandleClass} -left-1 top-2 bottom-2 w-2 cursor-w-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
      <div className={`${resizeHandleClass} -right-1 top-2 bottom-2 w-2 cursor-e-resize`} onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
      {/* 标题栏 + 标签页 */}
      <div 
        onMouseDown={handleTitleMouseDown}
        className="bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-xl"
      >
        {/* 顶部控制栏 */}
        <div className="h-11 flex items-center px-3">
          <div className="flex items-center gap-2 window-controls">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors group flex items-center justify-center">
              <svg className="w-2 h-2 text-[#990000] opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <button onClick={onMinimize} className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors group flex items-center justify-center">
              <svg className="w-2 h-2 text-[#995700] opacity-0 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
            </button>
            <button className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-gray-500 font-medium">Prompts</span>
          </div>
          <div className="w-16" />
        </div>

        {/* 标签页栏 */}
        <div className="h-9 flex items-end px-2 gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const colors = getCategoryColors(getCategoryColor(tab.category_id));
            return (
              <div
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`tab-item flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-all group max-w-[200px] ${
                  isActive ? 'bg-white border-t border-l border-r border-gray-200' : 'bg-gray-200/50 hover:bg-gray-200'
                }`}
              >
                <div className={`w-4 h-4 rounded shrink-0 ${colors.bg} flex items-center justify-center`}>
                  <svg className={`w-2.5 h-2.5 ${colors.text}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <span className={`text-xs truncate ${isActive ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>{tab.title}</span>
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
              lumina://prompts/<span className="text-gray-700">{getCategoryName(activePrompt.category_id)}</span>/<span className="text-primary font-medium">{isEditing ? editTitle : activePrompt.title}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">选择一个标签页</span>
          )}
        </div>
        {/* 编辑/保存/取消按钮 */}
        {activePrompt && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editTitle.trim() || !editContent.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
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
              </>
            ) : (
              <button
                onClick={enterEditMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                编辑
              </button>
            )}
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        {activePrompt ? (
          <div className="h-full flex flex-col p-6">
            {isEditing ? (
              /* 编辑模式 - 紧凑布局，内容占大头 */
              <div className="h-full flex flex-col gap-4">
                {/* 顶部信息栏 - 紧凑 */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">分类</span>
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
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
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-xl font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-primary/20"
                      placeholder="输入标题..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">标签</span>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-48 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 ring-primary/20"
                      placeholder="逗号分隔..."
                    />
                  </div>
                </div>

                {/* 内容编辑 - 占满剩余空间 */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full text-gray-700 leading-relaxed text-sm p-5 outline-none resize-none"
                    placeholder="输入提示词内容..."
                  />
                </div>
              </div>
            ) : (
              /* 查看模式 - 内容占大头 */
              <div className="h-full flex flex-col">
                {/* 头部信息 - 紧凑 */}
                <div className="flex items-center gap-4 mb-4 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider uppercase ${activeColors.bg} ${activeColors.text}`}>
                    {getCategoryName(activePrompt.category_id)}
                  </span>
                  <h1 className="text-2xl font-bold text-gray-900 flex-1">{activePrompt.title}</h1>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{new Date(activePrompt.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>{activePrompt.content.length} 字符</span>
                  </div>
                </div>

                {/* 内容卡片 - 占满剩余空间 */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">提示词内容</span>
                    <button onClick={() => onCopy(activePrompt.content)} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      复制
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">{activePrompt.content}</p>
                  </div>
                </div>

                {/* 标签 - 底部紧凑 */}
                {activePrompt.tags && activePrompt.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 shrink-0">
                    <span className="text-xs text-gray-400">标签:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activePrompt.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
    </div>
  );
};
