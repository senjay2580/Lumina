// AI 角色库浏览器 - 复用浏览器弹窗样式
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getRoleCategories,
  getRoleTemplates,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate,
  createRoleCategory,
  updateRoleCategory,
  deleteRoleCategory,
  AIRoleCategory,
  AIRoleTemplate,
} from '../lib/ai-roles';
import { getStoredUser } from '../lib/auth';
import { useToast } from './useToast';
import { Confirm } from './Confirm';

interface RoleLibraryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

const getCategoryColors = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  };
  return colors[color] || colors.gray;
};

// 默认 AI Bot SVG 图标
const DEFAULT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/></svg>`;

// 获取分类颜色样式
const getCategoryColorStyle = (color: string) => {
  const colorMap: Record<string, { bg: string; text: string; border: string; hex: string }> = {
    blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', hex: '#3b82f6' },
    green: { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', hex: '#22c55e' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', hex: '#a855f7' },
    orange: { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', hex: '#06b6d4' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', hex: '#eab308' },
    pink: { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', hex: '#ec4899' },
    red: { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444' },
    gray: { bg: 'bg-gray-500', text: 'text-gray-500', border: 'border-gray-500', hex: '#6b7280' },
  };
  // 支持自定义 hex 颜色
  if (color.startsWith('#')) {
    return { bg: '', text: '', border: '', hex: color };
  }
  return colorMap[color] || colorMap.gray;
};

// 内嵌版本 - 用于浏览器窗口标签页
export const RoleLibraryContent: React.FC = () => {
  const user = getStoredUser();
  const userId = user?.id || '';
  const toast = useToast();

  const [categories, setCategories] = useState<AIRoleCategory[]>([]);
  const [templates, setTemplates] = useState<AIRoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<AIRoleTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // 新建模式
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState(''); // 角色图标
  const [isCopied, setIsCopied] = useState(false);
  const [showIconInput, setShowIconInput] = useState(false); // 显示 SVG 代码输入框
  const roleIconInputRef = useRef<HTMLInputElement>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false); // 新建下拉菜单
  
  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'role' | 'category'; target: AIRoleTemplate | AIRoleCategory | null }>({ open: false, type: 'role', target: null });
  
  // 分类管理状态
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AIRoleCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState(''); // 空字符串表示使用默认图标
  const [categoryColor, setCategoryColor] = useState('#3b82f6'); // 默认蓝色
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // 预设颜色
  const presetColors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#eab308', '#ec4899', '#ef4444', '#6b7280'];

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [cats, temps] = await Promise.all([
        getRoleCategories(userId),
        getRoleTemplates(userId),
      ]);
      setCategories(cats);
      setTemplates(temps);
    } catch (err) {
      console.error('加载角色库失败:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTemplates = templates.filter(
    t => selectedCategoryId === 'ALL' || t.categoryId === selectedCategoryId
  );

  const handleSelectTemplate = (template: AIRoleTemplate) => {
    // 如果正在新建模式，先退出
    if (isCreating) {
      setIsCreating(false);
    }
    setSelectedTemplate(template);
    setEditContent(template.content);
    setEditName(template.name);
    setEditDescription(template.description);
    setEditIcon(template.icon || '');
    setShowIconInput(false);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    if (!selectedTemplate && !isCreating) return;
    await navigator.clipboard.writeText(editContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success('已复制到剪贴板');
  };

  const handleSave = async () => {
    // 新建模式 - 插入数据库
    if (isCreating) {
      const newTemplate = await createRoleTemplate(userId, {
        categoryId: createCategoryId || undefined,
        name: editName,
        description: editDescription,
        content: editContent,
        icon: editIcon || undefined,
      });
      if (newTemplate) {
        toast.success('创建成功');
        setIsCreating(false);
        setIsEditing(false);
        setCreateCategoryId(null);
        setShowIconInput(false);
        loadData();
        setSelectedTemplate(newTemplate);
      } else {
        toast.error('创建失败');
      }
      return;
    }
    
    // 编辑模式 - 更新数据库
    if (!selectedTemplate || selectedTemplate.isSystem) return;
    const success = await updateRoleTemplate(selectedTemplate.id, {
      name: editName,
      description: editDescription,
      content: editContent,
      icon: editIcon || undefined,
    });
    if (success) {
      toast.success('保存成功');
      setIsEditing(false);
      setShowIconInput(false);
      loadData();
    } else {
      toast.error('保存失败');
    }
  };

  // 新建角色 - 只在本地创建临时数据，不插入数据库
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  
  const handleCreate = (categoryId?: string) => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setIsEditing(true);
    setEditName('新角色');
    setEditDescription('角色描述');
    setEditContent('你是一个...');
    setEditIcon('');
    setShowIconInput(false);
    setCreateCategoryId(categoryId || null);
  };

  // 取消新建或编辑
  const handleCancel = () => {
    if (isCreating) {
      // 取消新建 - 清空状态
      setIsCreating(false);
      setIsEditing(false);
      setSelectedTemplate(null);
      setEditName('');
      setEditDescription('');
      setEditContent('');
      setEditIcon('');
      setShowIconInput(false);
    } else {
      // 取消编辑 - 恢复原始数据
      setIsEditing(false);
      setShowIconInput(false);
      if (selectedTemplate) {
        setEditName(selectedTemplate.name);
        setEditDescription(selectedTemplate.description);
        setEditContent(selectedTemplate.content);
        setEditIcon(selectedTemplate.icon || '');
      }
    }
  };

  const handleDelete = () => {
    if (!selectedTemplate || selectedTemplate.isSystem) return;
    setDeleteConfirm({ open: true, type: 'role', target: selectedTemplate });
  };

  const confirmDeleteRole = async () => {
    if (deleteConfirm.type !== 'role' || !deleteConfirm.target) return;
    const template = deleteConfirm.target as AIRoleTemplate;
    const success = await deleteRoleTemplate(template.id, userId);
    if (success) {
      toast.success('删除成功');
      setSelectedTemplate(null);
      setIsCreating(false);
      setIsEditing(false);
      loadData();
    }
    setDeleteConfirm({ open: false, type: 'role', target: null });
  };

  // ============ 分类管理 ============
  
  // 打开新建分类弹窗
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryIcon(''); // 空表示使用默认图标
    setCategoryColor('#3b82f6'); // 默认蓝色
    setShowCategoryModal(true);
  };

  // 打开编辑分类弹窗
  const handleOpenEditCategory = (cat: AIRoleCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryIcon(cat.icon || '');
    setCategoryColor(cat.color.startsWith('#') ? cat.color : getCategoryColorStyle(cat.color).hex);
    setShowCategoryModal(true);
    setCategoryMenuId(null);
  };

  // 处理分类 SVG 图标上传
  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.includes('svg')) {
      toast.error('请上传 SVG 格式的图标');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target?.result as string;
      setCategoryIcon(svgContent);
    };
    reader.readAsText(file);
  };

  // 处理角色 SVG 图标上传
  const handleRoleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.includes('svg')) {
      toast.error('请上传 SVG 格式的图标');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target?.result as string;
      setEditIcon(svgContent);
    };
    reader.readAsText(file);
  };

  // 保存分类
  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    if (editingCategory) {
      // 更新分类
      const success = await updateRoleCategory(editingCategory.id, {
        name: categoryName.trim(),
        icon: categoryIcon || DEFAULT_ICON_SVG,
        color: categoryColor,
      });
      if (success) {
        toast.success('分类已更新');
        loadData();
      } else {
        toast.error('更新失败');
      }
    } else {
      // 新建分类
      const newCat = await createRoleCategory(userId, {
        name: categoryName.trim(),
        icon: categoryIcon || DEFAULT_ICON_SVG,
        color: categoryColor,
      });
      if (newCat) {
        toast.success('分类已创建');
        loadData();
      } else {
        toast.error('创建失败');
      }
    }
    setShowCategoryModal(false);
  };

  // 删除分类
  const handleDeleteCategory = (cat: AIRoleCategory) => {
    if (cat.isSystem) {
      toast.error('系统分类不能删除');
      return;
    }
    // 检查该分类下是否有角色
    const roleCount = templates.filter(t => t.categoryId === cat.id).length;
    if (roleCount > 0) {
      toast.error(`该分类下有 ${roleCount} 个角色，请先移动或删除这些角色`);
      setCategoryMenuId(null);
      return;
    }
    setDeleteConfirm({ open: true, type: 'category', target: cat });
    setCategoryMenuId(null);
  };

  const confirmDeleteCategory = async () => {
    if (deleteConfirm.type !== 'category' || !deleteConfirm.target) return;
    const cat = deleteConfirm.target as AIRoleCategory;
    const success = await deleteRoleCategory(cat.id);
    if (success) {
      toast.success('分类已删除');
      if (selectedCategoryId === cat.id) {
        setSelectedCategoryId('ALL');
      }
      loadData();
    } else {
      toast.error('删除失败');
    }
    setDeleteConfirm({ open: false, type: 'role', target: null });
  };

  return (
    <div className="h-full flex">
      {/* 左侧分类 */}
      <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200 relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            新建分类
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {/* 全部角色 - 不显示加号 */}
          <button
            onClick={() => setSelectedCategoryId('ALL')}
            className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors mb-1 ${
              selectedCategoryId === 'ALL' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="mr-2">📚</span>全部角色
            <span className="ml-1 text-xs opacity-70">({templates.length})</span>
          </button>
          {categories.map(cat => {
            const count = templates.filter(t => t.categoryId === cat.id).length;
            const isMenuOpen = categoryMenuId === cat.id;
            return (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => setSelectedCategoryId(cat.id)}
                  onContextMenu={(e) => {
                    if (!cat.isSystem) {
                      e.preventDefault();
                      setCategoryMenuId(cat.id);
                    }
                  }}
                  style={selectedCategoryId === cat.id ? { backgroundColor: getCategoryColorStyle(cat.color).hex } : {}}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors mb-1 flex items-center ${
                    selectedCategoryId === cat.id ? 'text-white' : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {/* 图标 - 支持 SVG 或 emoji */}
                  <span 
                    className="mr-2 w-5 h-5 flex items-center justify-center shrink-0"
                    style={{ color: selectedCategoryId === cat.id ? 'white' : getCategoryColorStyle(cat.color).hex }}
                  >
                    {cat.icon.startsWith('<svg') ? (
                      <span className="w-4 h-4" dangerouslySetInnerHTML={{ __html: cat.icon }} />
                    ) : (
                      <span className="text-base">{cat.icon}</span>
                    )}
                  </span>
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className="text-xs opacity-70 mr-1">({count})</span>
                  {/* 新建角色按钮 - hover 时显示 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreate(cat.id);
                    }}
                    className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      selectedCategoryId === cat.id ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-300 text-gray-500'
                    }`}
                    title={`在"${cat.name}"中新建角色`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  {/* 更多操作按钮 - 仅用户分类显示 */}
                  {!cat.isSystem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryMenuId(isMenuOpen ? null : cat.id);
                      }}
                      className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                        selectedCategoryId === cat.id ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-300 text-gray-500'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                    </button>
                  )}
                </button>
                {/* 分类操作菜单 */}
                {isMenuOpen && !cat.isSystem && (
                  <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[100px]">
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      删除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 中间列表 */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-200 text-sm font-medium text-gray-700">
          {selectedCategoryId === 'ALL' ? '全部角色' : categories.find(c => c.id === selectedCategoryId)?.name || '角色列表'}
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">暂无角色模板</div>
          ) : (
            filteredTemplates.map(template => {
              const isSelected = selectedTemplate?.id === template.id;
              return (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`p-3 rounded-lg cursor-pointer transition-all mb-2 ${
                    isSelected ? 'bg-gray-900/10 border border-gray-900/30' : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{template.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{template.description}</div>
                      {template.isSystem && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded">系统</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 flex flex-col bg-white">
        {isCreating ? (
          /* 新建模式 */
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* 可编辑图标 */}
                <div className="relative group">
                  <div 
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => setShowIconInput(!showIconInput)}
                    title="点击编辑图标"
                  >
                    {editIcon ? (
                      <span className="w-6 h-6 text-gray-700" dangerouslySetInnerHTML={{ __html: editIcon }} />
                    ) : (
                      <span className="text-2xl">🎭</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="角色名称"
                  className="text-lg font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded outline-none focus:ring-2 ring-gray-900/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">保存</button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
              <div className="space-y-4">
                {/* 图标编辑区域 */}
                {showIconInput && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">自定义图标 (SVG)</label>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <textarea
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          placeholder="粘贴 SVG 代码..."
                          className="w-full h-20 px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20 resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          ref={roleIconInputRef}
                          type="file"
                          accept=".svg"
                          onChange={handleRoleIconUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => roleIconInputRef.current?.click()}
                          className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          上传 SVG
                        </button>
                        {editIcon && (
                          <button
                            onClick={() => setEditIcon('')}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                          >
                            使用默认
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="角色描述"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色提示词</label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="你是一个..."
                    className="w-full h-64 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20 resize-none font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </>
        ) : selectedTemplate ? (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isEditing ? (
                  /* 编辑模式 - 可编辑图标 */
                  <div className="relative group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => setShowIconInput(!showIconInput)}
                      title="点击编辑图标"
                    >
                      {editIcon ? (
                        <span className="w-6 h-6 text-gray-700" dangerouslySetInnerHTML={{ __html: editIcon }} />
                      ) : (
                        <span className="text-2xl">{selectedTemplate.icon || '🎭'}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  /* 查看模式 - 显示图标 */
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    {selectedTemplate.icon?.startsWith('<svg') ? (
                      <span className="w-6 h-6 text-gray-700" dangerouslySetInnerHTML={{ __html: selectedTemplate.icon }} />
                    ) : (
                      <span className="text-2xl">{selectedTemplate.icon || '🎭'}</span>
                    )}
                  </div>
                )}
                {isEditing ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-lg font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded outline-none focus:ring-2 ring-gray-900/20"
                  />
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                      {/* 分类胶囊 */}
                      {selectedTemplate.categoryId && (() => {
                        const cat = categories.find(c => c.id === selectedTemplate.categoryId);
                        if (!cat) return null;
                        const colorStyle = getCategoryColorStyle(cat.color);
                        return (
                          <span 
                            className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                            style={{ backgroundColor: colorStyle.hex }}
                          >
                            {cat.name}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplate.isSystem ? (
                  /* 系统模板只显示分类信息，不显示操作按钮 */
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">系统预设</span>
                ) : (
                  isEditing ? (
                    <>
                      <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                      <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">保存</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">编辑</button>
                      <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg">删除</button>
                    </>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
              {isEditing ? (
                <div className="space-y-4">
                  {/* 图标编辑区域 */}
                  {showIconInput && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">自定义图标 (SVG)</label>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <textarea
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            placeholder="粘贴 SVG 代码..."
                            className="w-full h-20 px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20 resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            ref={roleIconInputRef}
                            type="file"
                            accept=".svg"
                            onChange={handleRoleIconUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => roleIconInputRef.current?.click()}
                            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            上传 SVG
                          </button>
                          {editIcon && (
                            <button
                              onClick={() => setEditIcon('')}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                              使用默认
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">角色提示词</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-64 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20 resize-none font-mono text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{editContent}</pre>
                </div>
              )}
            </div>
            {!isEditing && (
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    isCopied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isCopied ? (
                    <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>已复制</>
                  ) : (
                    <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>复制</>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl mb-4 block">🎭</span>
              <p className="text-gray-500">选择一个角色查看详情</p>
            </div>
          </div>
        )}
      </div>
      
      {/* 分类编辑弹窗 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[380px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingCategory ? '编辑分类' : '新建分类'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类名称</label>
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="输入分类名称"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20"
                />
              </div>
              
              {/* 颜色选择 - 分类的主题色 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分类颜色</label>
                <div className="flex items-center gap-3">
                  {/* 预设颜色 */}
                  <div className="flex flex-wrap gap-2">
                    {presetColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setCategoryColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-7 h-7 rounded-full transition-all ${
                          categoryColor === color ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* 自定义颜色选择器 */}
                  <div className="relative">
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={categoryColor}
                      onChange={(e) => setCategoryColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div 
                      className="w-7 h-7 rounded-full border-2 border-gray-300 cursor-pointer flex items-center justify-center"
                      style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }}
                      title="自定义颜色"
                    >
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 图标选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">图标 (可选)</label>
                <div className="flex items-start gap-3">
                  {/* 当前图标预览 */}
                  <div 
                    className="w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: categoryColor + '20', borderColor: categoryColor }}
                  >
                    {categoryIcon ? (
                      categoryIcon.startsWith('<svg') ? (
                        <span className="w-6 h-6 text-gray-700" dangerouslySetInnerHTML={{ __html: categoryIcon }} />
                      ) : (
                        <span className="text-2xl">{categoryIcon}</span>
                      )
                    ) : (
                      <span className="w-6 h-6 text-gray-700" dangerouslySetInnerHTML={{ __html: DEFAULT_ICON_SVG }} />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {/* SVG 代码输入 */}
                    <textarea
                      value={categoryIcon}
                      onChange={(e) => setCategoryIcon(e.target.value)}
                      placeholder="粘贴 SVG 代码，如: <svg>...</svg>"
                      className="w-full h-16 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:ring-2 ring-gray-900/20 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      {/* 上传 SVG 按钮 */}
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept=".svg"
                        onChange={handleIconUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => iconInputRef.current?.click()}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        上传
                      </button>
                      
                      {/* 使用默认图标 */}
                      {categoryIcon && (
                        <button
                          onClick={() => setCategoryIcon('')}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          使用默认
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSaveCategory} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭分类菜单 */}
      {categoryMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setCategoryMenuId(null)} />
      )}
      
      {/* 删除确认弹窗 */}
      <Confirm
        isOpen={deleteConfirm.open}
        title={deleteConfirm.type === 'role' ? '删除角色' : '删除分类'}
        message={deleteConfirm.type === 'role' 
          ? '确定要删除这个角色吗？此操作不可撤销。'
          : `确定要删除分类"${(deleteConfirm.target as AIRoleCategory)?.name || ''}"吗？该分类下的角色不会被删除。`
        }
        confirmText="删除"
        danger
        onConfirm={() => {
          if (deleteConfirm.type === 'role') {
            confirmDeleteRole();
          } else {
            confirmDeleteCategory();
          }
        }}
        onCancel={() => setDeleteConfirm({ open: false, type: 'role', target: null })}
      />
      
      {/* 隐藏滚动条样式 */}
      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
      `}</style>
    </div>
  );
};

export const RoleLibraryBrowser: React.FC<RoleLibraryBrowserProps> = ({
  isOpen,
  onClose,
}) => {
  const user = getStoredUser();
  const userId = user?.id || '';
  const toast = useToast();

  // 数据状态
  const [categories, setCategories] = useState<AIRoleCategory[]>([]);
  const [templates, setTemplates] = useState<AIRoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // UI 状态
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<AIRoleTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // 窗口状态
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1000, height: 650 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting'>('entering');

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 初始化位置
  useEffect(() => {
    if (isOpen) {
      const x = Math.max(20, (window.innerWidth - size.width) / 2);
      const y = Math.max(20, (window.innerHeight - size.height) / 2 - 20);
      setPosition({ x, y });
      setAnimationState('entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimationState('visible'));
      });
    }
  }, [isOpen]);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [cats, temps] = await Promise.all([
        getRoleCategories(userId),
        getRoleTemplates(userId),
      ]);
      setCategories(cats);
      setTemplates(temps);
    } catch (err) {
      console.error('加载角色库失败:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  // 过滤模板
  const filteredTemplates = templates.filter(
    t => selectedCategoryId === 'ALL' || t.categoryId === selectedCategoryId
  );

  // 选择模板
  const handleSelectTemplate = (template: AIRoleTemplate) => {
    setSelectedTemplate(template);
    setEditContent(template.content);
    setEditName(template.name);
    setEditDescription(template.description);
    setIsEditing(false);
  };

  // 复制内容
  const handleCopy = async () => {
    if (!selectedTemplate) return;
    await navigator.clipboard.writeText(editContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success('已复制到剪贴板');
  };

  // 保存编辑
  const handleSave = async () => {
    if (!selectedTemplate || selectedTemplate.isSystem) return;
    
    const success = await updateRoleTemplate(selectedTemplate.id, {
      name: editName,
      description: editDescription,
      content: editContent,
    });

    if (success) {
      toast.success('保存成功');
      setIsEditing(false);
      loadData();
    } else {
      toast.error('保存失败');
    }
  };

  // 创建新角色
  const handleCreate = async () => {
    const newTemplate = await createRoleTemplate(userId, {
      categoryId: selectedCategoryId === 'ALL' ? undefined : selectedCategoryId,
      name: '新角色',
      description: '角色描述',
      content: '你是一个...',
    });

    if (newTemplate) {
      toast.success('创建成功');
      loadData();
      setSelectedTemplate(newTemplate);
      setEditContent(newTemplate.content);
      setEditName(newTemplate.name);
      setEditDescription(newTemplate.description);
      setIsEditing(true);
    }
  };

  // 删除角色
  const handleDelete = () => {
    if (!selectedTemplate || selectedTemplate.isSystem) return;
    setDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplate) return;
    const success = await deleteRoleTemplate(selectedTemplate.id);
    if (success) {
      toast.success('删除成功');
      setSelectedTemplate(null);
      loadData();
    }
    setDeleteConfirm(false);
  };

  // 拖拽
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 关闭动画
  const handleClose = () => {
    setAnimationState('exiting');
    setTimeout(onClose, 300);
  };

  if (!isOpen) return null;

  const getAnimationStyles = () => {
    if (animationState === 'entering') {
      return { opacity: 0, transform: 'translateY(30px) scale(0.98)' };
    }
    if (animationState === 'exiting') {
      return { opacity: 0, transform: 'translateY(30px) scale(0.98)' };
    }
    return { opacity: 1, transform: 'translateY(0) scale(1)' };
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity duration-300"
        style={{ opacity: animationState === 'visible' ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* 浏览器窗口 */}
      <div
        ref={windowRef}
        style={{
          position: 'fixed',
          width: isFullscreen ? '100%' : size.width,
          height: isFullscreen ? '100%' : size.height,
          left: isFullscreen ? 0 : position.x,
          top: isFullscreen ? 0 : position.y,
          borderRadius: isFullscreen ? 0 : 12,
          ...getAnimationStyles(),
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
        className="bg-white shadow-2xl overflow-hidden flex flex-col"
      >
        {/* 标题栏 */}
        <div
          onMouseDown={!isFullscreen ? handleTitleMouseDown : undefined}
          className={`bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 select-none shrink-0 ${
            isFullscreen ? '' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          <div className="h-11 flex items-center px-3">
            <div className="flex items-center gap-2 window-controls">
              <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors" />
              <button className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors" />
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors" 
              />
            </div>
            <div className="flex-1 text-center">
              <span className="text-sm text-gray-600 font-medium">🎭 AI 角色库</span>
            </div>
            <div className="w-16" />
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧分类列表 */}
          <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={handleCreate}
                className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                新建角色
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {/* 全部 */}
              <button
                onClick={() => setSelectedCategoryId('ALL')}
                className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors mb-1 ${
                  selectedCategoryId === 'ALL'
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">📚</span>
                全部角色
                <span className="ml-auto text-xs opacity-70">({templates.length})</span>
              </button>

              {/* 分类列表 */}
              {categories.map(cat => {
                const count = templates.filter(t => t.categoryId === cat.id).length;
                const colors = getCategoryColors(cat.color);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors mb-1 ${
                      selectedCategoryId === cat.id
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-2">{cat.icon}</span>
                    {cat.name}
                    <span className="ml-auto text-xs opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 中间模板列表 */}
          <div className="w-72 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700">
                {selectedCategoryId === 'ALL' 
                  ? '全部角色' 
                  : categories.find(c => c.id === selectedCategoryId)?.name || '角色列表'
                }
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  暂无角色模板
                </div>
              ) : (
                filteredTemplates.map(template => {
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`p-3 rounded-lg cursor-pointer transition-all mb-2 ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{template.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                            {template.description}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {template.isSystem && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded">系统</span>
                            )}
                            {template.copyCount > 0 && (
                              <span className="text-[10px] text-gray-400">
                                {template.copyCount} 次使用
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧详情/编辑区 */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedTemplate ? (
              <>
                {/* 头部 */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedTemplate.icon}</span>
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-lg font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded outline-none focus:ring-2 ring-primary/20"
                      />
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                        <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedTemplate.isSystem && (
                      <>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => setIsEditing(false)}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleSave}
                              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                            >
                              保存
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setIsEditing(true)}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              编辑
                            </button>
                            <button
                              onClick={handleDelete}
                              className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 内容区 */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20"
                          placeholder="角色描述..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">角色提示词</label>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-64 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20 resize-none font-mono text-sm"
                          placeholder="输入角色提示词..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                        {editContent}
                      </pre>
                    </div>
                  )}
                </div>

                {/* 底部操作栏 */}
                {!isEditing && (
                  <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                      onClick={handleCopy}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        isCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          复制
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-6xl mb-4 block">🎭</span>
                  <p className="text-gray-500">选择一个角色查看详情</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 删除确认弹窗 */}
      <Confirm
        isOpen={deleteConfirm}
        title="删除角色"
        message="确定要删除这个角色吗？此操作不可撤销。"
        confirmText="删除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
};

export default RoleLibraryBrowser;
