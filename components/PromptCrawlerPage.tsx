// 提示词爬虫管理页面
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw,
  Database,
  Clock,
  CheckCircle2,
  Download,
  Settings,
  ExternalLink,
  Trash2,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Globe,
  Github,
  AlertCircle,
  FileText,
  Star,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  FolderOpen,
  Zap,
  TrendingUp,
  Archive
} from 'lucide-react';
import {
  triggerCrawl,
  getCrawlJobs,
  getPendingPrompts,
  getApprovedPrompts,
  approvePrompt,
  approvePrompts,
  rejectPrompt,
  importPromptToLibrary,
  importPromptsToLibrary,
  getCrawlStats,
  getCrawlConfig,
  updateCrawlConfig,
  type ExtractedPrompt,
  type CrawlJob,
  type CrawlStats
} from '../lib/prompt-crawler';
import { getCategories, type PromptCategory } from '../lib/prompts';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { Modal } from '../shared/Modal';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';

interface Props {
  userId: string;
}

export default function PromptCrawlerPage({ userId }: Props) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'jobs' | 'config'>('pending');
  const [pendingPrompts, setPendingPrompts] = useState<ExtractedPrompt[]>([]);
  const [approvedPromptsList, setApprovedPromptsList] = useState<ExtractedPrompt[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, approved, jobList, statsData, cats, cfg] = await Promise.all([
        getPendingPrompts(),
        getApprovedPrompts(),
        getCrawlJobs(),
        getCrawlStats(),
        getCategories(userId),
        getCrawlConfig()
      ]);
      setPendingPrompts(pending);
      setApprovedPromptsList(approved);
      setJobs(jobList);
      setStats(statsData);
      setCategories(cats);
      setConfig(cfg);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    }
    setLoading(false);
  };

  const handleCrawl = async (type: 'reddit' | 'github' | 'all') => {
    setCrawling(true);
    try {
      const result = await triggerCrawl(type);
      toast.success(`爬取完成！新增 ${result.stats.itemsNew} 个来源，提取 ${result.stats.promptsExtracted} 个提示词`);
      loadData();
    } catch (error: any) {
      toast.error('爬取失败: ' + error.message);
    }
    setCrawling(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await approvePrompt(id, userId);
      toast.success('已通过审核');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectPrompt(id);
      toast.info('已删除');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleImport = async (id: string, categoryId?: string) => {
    try {
      await importPromptToLibrary(id, userId, categoryId);
      toast.success('导入成功！');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '导入失败');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      await approvePrompts(Array.from(selectedIds), userId);
      toast.success(`已通过 ${selectedIds.size} 个提示词`);
      setSelectedIds(new Set());
      loadData();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleBatchImport = async (categoryId?: string) => {
    if (selectedIds.size === 0) return;
    try {
      await importPromptsToLibrary(Array.from(selectedIds), userId, categoryId);
      toast.success(`成功导入 ${selectedIds.size} 个提示词！`);
      setSelectedIds(new Set());
      loadData();
    } catch (error: any) {
      toast.error(error.message || '导入失败');
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = (prompts: ExtractedPrompt[]) => {
    if (selectedIds.size === prompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prompts.map(p => p.id)));
    }
  };

  const tabs = [
    { key: 'pending', label: '待审核', icon: Clock, count: pendingPrompts.length },
    { key: 'approved', label: '已审核', icon: CheckCircle2, count: approvedPromptsList.length },
    { key: 'jobs', label: '爬取历史', icon: Archive },
    { key: 'config', label: '配置', icon: Settings }
  ];

  if (loading) return <LoadingSpinner text="正在加载采集数据..." />;

  return (
    <div className="w-full h-full p-6 md:p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 48 48" fill="none">
              <path fill="#8fbffa" d="M42.451 25.678q-.302-.267-.626-.51A4 4 0 0 0 35 21.352a4.001 4.001 0 0 0-6.825 3.816a10.14 10.14 0 0 0-2.96 3.536a4.001 4.001 0 0 0-3.562 6.186A4 4 0 0 0 20.5 37.7c0 1.09.436 2.078 1.144 2.8c-6.208-.008-10.665-.221-13.588-.435c-3.287-.24-5.852-2.756-6.114-6.057c-.224-2.83-.442-7.1-.442-13.008s.218-10.177.442-13.008c.262-3.301 2.827-5.816 6.114-6.057C11.034 1.717 15.606 1.5 22 1.5s10.966.217 13.944.435c3.287.24 5.852 2.756 6.113 6.057c.225 2.83.443 7.1.443 13.008q-.001 2.537-.049 4.678"/>
              <path fill="#2859c5" d="M42.282 11.5H1.72q.104-2.025.224-3.508c.262-3.301 2.827-5.816 6.113-6.057C11.035 1.717 15.606 1.5 22 1.5s10.966.217 13.945.435c3.286.24 5.851 2.756 6.113 6.057c.078.99.156 2.157.224 3.508M10 18a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4zm0 9a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4z"/>
              <path fill="#8fbffa" fillRule="evenodd" d="M7.5 7A1.5 1.5 0 0 1 9 5.5h2a1.5 1.5 0 0 1 0 3H9A1.5 1.5 0 0 1 7.5 7M16 5.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 0 0-3z" clipRule="evenodd"/>
              <path fill="#2859c5" d="M31.526 22.577a1.5 1.5 0 0 1 1.897.95l.671 2.013a10.4 10.4 0 0 1 1.812 0l.671-2.014a1.5 1.5 0 0 1 2.846.949l-.603 1.808a7.8 7.8 0 0 1 2.183 1.46c1.164 1.107 1.964 2.572 2.298 4.288l.867-.579a1.5 1.5 0 0 1 1.664 2.496l-2.333 1.556l.001.496v.2h2a1.5 1.5 0 1 1 0 3h-2.083q-.033.298-.083.587l2.498 1.665a1.5 1.5 0 1 1-1.664 2.496l-1.899-1.266a7.6 7.6 0 0 1-1.266 1.576C39.493 45.694 37.401 46.5 35 46.5s-4.493-.806-6.003-2.242a7.6 7.6 0 0 1-1.266-1.576l-1.899 1.266a1.5 1.5 0 1 1-1.664-2.496l2.498-1.665a9 9 0 0 1-.083-.587H24.5a1.5 1.5 0 0 1 0-3h2l.001-.696l-2.333-1.556a1.5 1.5 0 0 1 1.664-2.496l.867.579c.334-1.716 1.133-3.18 2.298-4.288a7.8 7.8 0 0 1 2.183-1.46l-.603-1.808a1.5 1.5 0 0 1 .949-1.898"/>
              <path fill="#8fbffa" d="m26.7 32.03l.538.36c.322.162.71.338 1.165.511C29.883 33.465 32.063 34 35 34c2.936 0 5.117-.535 6.596-1.099c.457-.173.844-.35 1.165-.512l.54-.36a8.2 8.2 0 0 0-1.09-2.805q-.07.043-.136.095h-.001a4 4 0 0 1-.308.198a8.3 8.3 0 0 1-1.238.581C39.383 30.534 37.563 31 35 31c-2.564 0-4.383-.466-5.529-.902a8.3 8.3 0 0 1-1.237-.58a4 4 0 0 1-.308-.198l-.001-.001a2 2 0 0 0-.136-.095a8.2 8.2 0 0 0-1.09 2.806Z"/>
            </svg>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">提示词采集</h2>
              <p className="text-gray-500">自动从 Reddit、GitHub 采集优质提示词</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleCrawl('reddit')}
              disabled={crawling}
              className="px-4 py-2.5 rounded-xl bg-[#FF4500] text-white font-medium hover:bg-[#FF5722] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Globe className="w-4 h-4" />
              Reddit
            </button>
            <button
              onClick={() => handleCrawl('github')}
              disabled={crawling}
              className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Github className="w-4 h-4" />
              GitHub
            </button>
            <button
              onClick={() => handleCrawl('all')}
              disabled={crawling}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {crawling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {crawling ? '采集中...' : '立即采集'}
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Database className="w-5 h-5" />}
              label="来源总数"
              value={stats.totalSources}
              sub={`Reddit ${stats.redditSources} · GitHub ${stats.githubSources}`}
              color="blue"
            />
            <StatCard
              icon={<FileText className="w-5 h-5" />}
              label="提取的提示词"
              value={stats.totalExtracted}
              color="purple"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="待审核"
              value={stats.pendingReview}
              color="amber"
              highlight
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="已导入"
              value={stats.imported}
              color="green"
            />
          </div>
        )}

        {/* 标签页 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            
            // 根据 tab 类型设置不同的激活颜色
            const getActiveStyle = () => {
              switch (tab.key) {
                case 'pending':
                  return 'bg-amber-500 text-white';
                case 'approved':
                  return 'bg-green-500 text-white';
                case 'jobs':
                  return 'bg-blue-500 text-white';
                case 'config':
                  return 'bg-gray-900 text-white';
                default:
                  return 'bg-gray-900 text-white';
              }
            };
            
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? getActiveStyle()
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 内容区 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'pending' && (
              <PromptList
                prompts={pendingPrompts}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={() => selectAll(pendingPrompts)}
                onApprove={handleApprove}
                onReject={handleReject}
                onImport={handleImport}
                onBatchApprove={handleBatchApprove}
                onBatchImport={handleBatchImport}
                categories={categories}
                showActions
                emptyText="暂无待审核的提示词"
                emptySubText="点击上方按钮开始采集"
              />
            )}

            {activeTab === 'approved' && (
              <PromptList
                prompts={approvedPromptsList}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={() => selectAll(approvedPromptsList)}
                onImport={handleImport}
                onBatchImport={handleBatchImport}
                categories={categories}
                emptyText="暂无已审核的提示词"
                emptySubText="审核通过的提示词会显示在这里"
              />
            )}

            {activeTab === 'jobs' && <JobList jobs={jobs} />}

            {activeTab === 'config' && (
              <ConfigPanel
                config={config}
                onUpdate={async (key, value) => {
                  try {
                    await updateCrawlConfig(key, value);
                    toast.success('配置已更新');
                    loadData();
                  } catch (error: any) {
                    toast.error(error.message || '更新失败');
                  }
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

// 统计卡片组件
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  color: 'blue' | 'purple' | 'amber' | 'green';
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600'
  };

  return (
    <div className={`bg-white rounded-2xl p-5 border transition-all ${
      highlight ? 'border-amber-200 ring-2 ring-amber-100' : 'border-gray-100'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// 提示词列表组件
function PromptList({
  prompts,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onApprove,
  onReject,
  onImport,
  onBatchApprove,
  onBatchImport,
  categories,
  showActions,
  emptyText,
  emptySubText
}: {
  prompts: ExtractedPrompt[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onImport: (id: string, categoryId?: string) => void;
  onBatchApprove?: () => void;
  onBatchImport: (categoryId?: string) => void;
  categories: PromptCategory[];
  showActions?: boolean;
  emptyText?: string;
  emptySubText?: string;
}) {
  const [importCategory, setImportCategory] = useState<string>('');

  if (prompts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-2">{emptyText || '暂无数据'}</p>
        <p className="text-gray-400 text-sm">{emptySubText}</p>
      </div>
    );
  }

  const allSelected = selectedIds.size === prompts.length && prompts.length > 0;

  return (
    <div>
      {/* 批量操作栏 */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-2xl border border-gray-100">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {allSelected ? '取消全选' : '全选'}
        </button>
        
        <div className="w-px h-5 bg-gray-200" />
        
        <span className="text-sm text-gray-500">
          已选 <span className="font-medium text-gray-900">{selectedIds.size}</span> 项
        </span>

        <div className="flex-1" />

        {showActions && onBatchApprove && (
          <button
            onClick={onBatchApprove}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            批量通过
          </button>
        )}

        <select
          value={importCategory}
          onChange={e => setImportCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 ring-primary/20"
        >
          <option value="">选择分类</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => onBatchImport(importCategory || undefined)}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          批量导入
        </button>
      </div>

      {/* 列表 */}
      <div className="grid gap-4">
        {prompts.map(prompt => {
          const isSelected = selectedIds.has(prompt.id);
          const isReddit = prompt.source?.source_type === 'reddit';
          
          return (
            <motion.div
              key={prompt.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-lg ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* 选择框 */}
                <button
                  onClick={() => onToggleSelect(prompt.id)}
                  className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  {/* 标签行 */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${
                      isReddit
                        ? 'bg-orange-50 text-orange-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isReddit ? <Globe className="w-3 h-3" /> : <Github className="w-3 h-3" />}
                      {isReddit ? 'Reddit' : 'GitHub'}
                    </span>
                    
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600">
                      <Sparkles className="w-3 h-3" />
                      {prompt.suggested_category}
                    </span>
                    
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
                      <Star className="w-3 h-3" />
                      {prompt.quality_score.toFixed(1)}
                    </span>

                    {prompt.imported_to_prompt_id && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-50 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        已导入
                      </span>
                    )}
                  </div>

                  {/* 标题 */}
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                    {prompt.prompt_title}
                  </h3>

                  {/* 内容预览 */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {prompt.prompt_content}
                  </p>

                  {/* 来源链接 */}
                  {prompt.source && (
                    <a
                      href={prompt.source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      查看来源
                    </a>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {showActions && onApprove && !prompt.is_approved && (
                    <button
                      onClick={() => onApprove(prompt.id)}
                      className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      title="通过"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {showActions && onReject && (
                    <button
                      onClick={() => onReject(prompt.id)}
                      className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {!prompt.imported_to_prompt_id && (
                    <button
                      onClick={() => onImport(prompt.id)}
                      className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="导入"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// 任务历史列表
function JobList({ jobs }: { jobs: CrawlJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Archive className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-2">暂无爬取记录</p>
        <p className="text-gray-400 text-sm">开始采集后会显示历史记录</p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-600';
      case 'running':
        return 'bg-blue-50 text-blue-600';
      case 'failed':
        return 'bg-red-50 text-red-500';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">时间</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">发现</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">新增</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">提取</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map(job => (
            <tr key={job.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(job.created_at).toLocaleString('zh-CN')}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${
                  job.job_type === 'reddit' ? 'bg-orange-50 text-orange-600' :
                  job.job_type === 'github' ? 'bg-gray-100 text-gray-600' :
                  'bg-purple-50 text-purple-600'
                }`}>
                  {job.job_type === 'reddit' ? <Globe className="w-3 h-3" /> :
                   job.job_type === 'github' ? <Github className="w-3 h-3" /> :
                   <Zap className="w-3 h-3" />}
                  {job.job_type}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${getStatusStyle(job.status)}`}>
                  {getStatusIcon(job.status)}
                  {job.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{job.items_found}</td>
              <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{job.items_new}</td>
              <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{job.prompts_extracted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 配置面板
function ConfigPanel({
  config,
  onUpdate
}: {
  config: Record<string, any>;
  onUpdate: (key: string, value: any) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const value = key.includes('subreddits') || key.includes('queries')
        ? JSON.parse(editValue)
        : editValue;
      await onUpdate(key, value);
      setEditing(null);
    } catch (error) {
      alert('保存失败，请检查格式');
    }
    setSaving(false);
  };

  const configItems = [
    { key: 'reddit_subreddits', label: 'Reddit 子版块', type: 'array', icon: Globe },
    { key: 'github_search_queries', label: 'GitHub 搜索关键词', type: 'array', icon: Github },
    { key: 'min_reddit_score', label: 'Reddit 最低分数', type: 'number', icon: TrendingUp },
    { key: 'min_github_stars', label: 'GitHub 最低 Stars', type: 'number', icon: Star },
    { key: 'ai_quality_threshold', label: 'AI 质量阈值 (1-10)', type: 'number', icon: Sparkles },
    { key: 'crawl_interval_hours', label: '爬取间隔 (小时)', type: 'number', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      {/* API 密钥提示 */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800 mb-2">API 密钥配置</h3>
            <p className="text-sm text-amber-700 mb-3">
              请在 Supabase Edge Function 的环境变量中配置以下密钥：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { key: 'REDDIT_CLIENT_ID', desc: 'Reddit API Client ID' },
                { key: 'REDDIT_CLIENT_SECRET', desc: 'Reddit API Client Secret' },
                { key: 'GITHUB_TOKEN', desc: 'GitHub Personal Access Token' },
                { key: 'OPENAI_API_KEY', desc: 'OpenAI API Key (用于 AI 分析)' }
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2 text-sm">
                  <code className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-mono">
                    {item.key}
                  </code>
                  <span className="text-amber-600 text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 配置项 */}
      <div className="grid gap-4">
        {configItems.map(item => {
          const Icon = item.icon;
          const isEditing = editing === item.key;

          return (
            <div key={item.key} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">{item.label}</span>
                </div>
                
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(item.key)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(item.key);
                      setEditValue(
                        item.type === 'array'
                          ? JSON.stringify(config[item.key] || [], null, 2)
                          : String(config[item.key] || '')
                      );
                    }}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-primary hover:bg-primary/10 transition-colors"
                  >
                    编辑
                  </button>
                )}
              </div>

              {isEditing ? (
                item.type === 'array' ? (
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:ring-2 ring-primary/20 resize-none"
                    placeholder="输入 JSON 数组..."
                  />
                ) : (
                  <input
                    type={item.type === 'number' ? 'number' : 'text'}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-primary/20"
                  />
                )
              ) : (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                  {item.type === 'array'
                    ? (config[item.key] || []).join(', ') || '未配置'
                    : config[item.key] || '未配置'
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
