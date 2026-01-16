import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw, Database, Settings, ExternalLink, Trash2, Check, X, Plus,
  Sparkles, Github, FileText, Star, Loader2, FolderOpen,
  TrendingUp, Eye, CheckSquare, Square, Clock, Zap, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Tag,
  GitFork, Flame, Copy, Play, GitMerge, Download, Wrench
} from 'lucide-react';

// 爬虫图标
const CrawlerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <path fill="#8fbffa" d="M42.451 25.678q-.302-.267-.626-.51A4 4 0 0 0 35 21.352a4.001 4.001 0 0 0-6.825 3.816a10.14 10.14 0 0 0-2.96 3.536a4.001 4.001 0 0 0-3.562 6.186A4 4 0 0 0 20.5 37.7c0 1.09.436 2.078 1.144 2.8c-6.208-.008-10.665-.221-13.588-.435c-3.287-.24-5.852-2.756-6.114-6.057c-.224-2.83-.442-7.1-.442-13.008s.218-10.177.442-13.008c.262-3.301 2.827-5.816 6.114-6.057C11.034 1.717 15.606 1.5 22 1.5s10.966.217 13.944.435c3.287.24 5.852 2.756 6.113 6.057c.225 2.83.443 7.1.443 13.008q-.001 2.537-.049 4.678"/>
    <path fill="#2859c5" d="M42.282 11.5H1.72q.104-2.025.224-3.508c.262-3.301 2.827-5.816 6.113-6.057C11.035 1.717 15.606 1.5 22 1.5s10.966.217 13.945.435c3.286.24 5.851 2.756 6.113 6.057c.078.99.156 2.157.224 3.508M10 18a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4zm0 9a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4z"/>
    <path fill="#8fbffa" fillRule="evenodd" d="M7.5 7A1.5 1.5 0 0 1 9 5.5h2a1.5 1.5 0 0 1 0 3H9A1.5 1.5 0 0 1 7.5 7M16 5.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 0 0-3z" clipRule="evenodd"/>
    <path fill="#2859c5" d="M31.526 22.577a1.5 1.5 0 0 1 1.897.95l.671 2.013a10.4 10.4 0 0 1 1.812 0l.671-2.014a1.5 1.5 0 0 1 2.846.949l-.603 1.808a7.8 7.8 0 0 1 2.183 1.46c1.164 1.107 1.964 2.572 2.298 4.288l.867-.579a1.5 1.5 0 0 1 1.664 2.496l-2.333 1.556l.001.496v.2h2a1.5 1.5 0 1 1 0 3h-2.083q-.033.298-.083.587l2.498 1.665a1.5 1.5 0 1 1-1.664 2.496l-1.899-1.266a7.6 7.6 0 0 1-1.266 1.576C39.493 45.694 37.401 46.5 35 46.5s-4.493-.806-6.003-2.242a7.6 7.6 0 0 1-1.266-1.576l-1.899 1.266a1.5 1.5 0 1 1-1.664-2.496l2.498-1.665a9 9 0 0 1-.083-.587H24.5a1.5 1.5 0 0 1 0-3h2l.001-.696l-2.333-1.556a1.5 1.5 0 0 1 1.664-2.496l.867.579c.334-1.716 1.133-3.18 2.298-4.288a7.8 7.8 0 0 1 2.183-1.46l-.603-1.808a1.5 1.5 0 0 1 .949-1.898"/>
    <path fill="#8fbffa" d="m26.7 32.03l.538.36c.322.162.71.338 1.165.511C29.883 33.465 32.063 34 35 34c2.936 0 5.117-.535 6.596-1.099c.457-.173.844-.35 1.165-.512l.54-.36a8.2 8.2 0 0 0-1.09-2.805q-.07.043-.136.095h-.001a4 4 0 0 1-.308.198a8.3 8.3 0 0 1-1.238.581C39.383 30.534 37.563 31 35 31c-2.564 0-4.383-.466-5.529-.902a8.3 8.3 0 0 1-1.237-.58a4 4 0 0 1-.308-.198l-.001-.001a2 2 0 0 0-.136-.095a8.2 8.2 0 0 0-1.09 2.806Z"/>
  </svg>
);

// 项目图标
const ProjectIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);

// Reddit 官方图标 (Snoo)
const RedditIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);
import {
  triggerCrawl, getCrawlJobs, getCrawledPrompts, deletePrompt, deletePrompts,
  getCrawlStats, getCrawlConfig, updateCrawlConfig, saveCrawlConfig, clearCrawlJobs, clearAllPrompts,
  getSelectedModel, setSelectedModel, exportConfigToJson, parseConfigFromJson, 
  SYSTEM_TEMPLATES, getUserTemplates, createUserTemplate, updateUserTemplate, deleteUserTemplate,
  DEFAULT_AI_ANALYSIS_PROMPT,
  type CrawledPrompt, type CrawlJob, type CrawlStats, type CrawlProgress, type CrawlConfig, type UserTemplate
} from '../lib/prompt-crawler';
import { getEnabledProviders, type AIProvider } from '../lib/ai-providers';
import { AIProviderIcon } from '../shared/AIProviderIcons';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { useDebounce } from '../lib/useDebounce';

interface Props {
  userId: string;
}

// 模型选项类型
interface ModelOption {
  providerId: string;
  providerKey: string;
  providerName: string;
  modelId: string;
  modelName: string;
}

export default function PromptCrawlerPage({ userId }: Props) {
  const [activeTab, setActiveTab] = useState<'prompts' | 'history' | 'config'>('prompts');
  const [prompts, setPrompts] = useState<CrawledPrompt[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // AI 模型选择
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null); // providerId:modelId
  
  // 独立的采集状态
  const [redditProgress, setRedditProgress] = useState<CrawlProgress | null>(null);
  const [githubProgress, setGithubProgress] = useState<CrawlProgress | null>(null);
  const [redditCrawling, setRedditCrawling] = useState(false);
  const [githubCrawling, setGithubCrawling] = useState(false);
  
  // 中断控制器
  const [redditAbort, setRedditAbort] = useState<AbortController | null>(null);
  const [githubAbort, setGithubAbort] = useState<AbortController | null>(null);
  
  const toast = useToast();

  useEffect(() => { loadData(); }, [userId]);
  useEffect(() => { setSelectedIds(new Set()); setSelectMode(false); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cfg = await getCrawlConfig(userId);
      setConfig(cfg);
      
      // 加载 AI 提供商并构建模型选项
      const providers = await getEnabledProviders(userId);
      const options: ModelOption[] = [];
      providers.forEach(provider => {
        // 只添加有模型的提供商
        if (provider.models && provider.models.length > 0) {
          provider.models.forEach(model => {
            options.push({
              providerId: provider.id,
              providerKey: provider.providerKey,
              providerName: provider.name,
              modelId: model.id,
              modelName: model.name
            });
          });
        }
      });
      setModelOptions(options);
      
      // 加载已选择的模型
      const savedModel = getSelectedModel();
      if (savedModel) {
        const key = `${savedModel.providerId}:${savedModel.modelId}`;
        if (options.some(o => `${o.providerId}:${o.modelId}` === key)) {
          setSelectedModelKey(key);
        } else if (options.length > 0) {
          // 默认选择第一个
          const first = options[0];
          const firstKey = `${first.providerId}:${first.modelId}`;
          setSelectedModelKey(firstKey);
          setSelectedModel(first.providerId, first.modelId);
        }
      } else if (options.length > 0) {
        // 默认选择第一个
        const first = options[0];
        const firstKey = `${first.providerId}:${first.modelId}`;
        setSelectedModelKey(firstKey);
        setSelectedModel(first.providerId, first.modelId);
      }
      
      const [promptList, jobList, statsData] = await Promise.all([
        getCrawledPrompts(userId),
        getCrawlJobs(userId),
        getCrawlStats(userId)
      ]);
      setPrompts(promptList);
      setJobs(jobList);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    }
    setLoading(false);
  };

  // 防抖的模型选择处理
  const handleModelChange = useDebounce((key: string) => {
    setSelectedModelKey(key);
    const [providerId, modelId] = key.split(':');
    setSelectedModel(providerId, modelId);
    toast.success('模型已更新');
  }, 300);

  const refreshData = async () => {
    try {
      const [promptList, jobList, statsData] = await Promise.all([
        getCrawledPrompts(userId), getCrawlJobs(userId), getCrawlStats(userId)
      ]);
      setPrompts(promptList);
      setJobs(jobList);
      setStats(statsData);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const handleCrawlReddit = async () => {
    if (redditCrawling) return;
    
    const abort = new AbortController();
    setRedditAbort(abort);
    setRedditCrawling(true);
    setRedditProgress({ phase: 'crawling', message: '正在启动...', itemsFound: 0, promptsExtracted: 0 });
    
    try {
      await triggerCrawl('reddit', userId, (progress) => {
        // 检查是否已中断
        if (abort.signal.aborted) return;
        setRedditProgress(progress);
        
        // 如果有新提示词，立即添加到列表
        if (progress.newPrompt) {
          setPrompts(prev => [progress.newPrompt!, ...prev]);
          // 更新统计
          setStats(prev => prev ? {
            ...prev,
            totalPrompts: prev.totalPrompts + 1,
            redditPrompts: prev.redditPrompts + 1
          } : prev);
        }
      }, abort.signal);
      
      // 只有未中断时才显示成功提示
      if (!abort.signal.aborted) {
        toast.success('Reddit 采集完成！');
      }
    } catch (error: any) {
      // 只有未中断时才显示错误
      if (!abort.signal.aborted) {
        const msg = error.message || '';
        if (msg.includes('AI') || msg.includes('模型')) {
          toast.error('请先配置 AI 模型');
        } else {
          toast.error('Reddit 采集失败: ' + msg);
        }
      }
    }
    setRedditCrawling(false);
    setRedditAbort(null);
  };

  const handleStopReddit = () => {
    if (redditAbort) {
      redditAbort.abort();
      setRedditProgress(prev => prev ? { ...prev, phase: 'cancelled', message: '已取消' } : null);
      setRedditCrawling(false);
      setRedditAbort(null);
      toast.info('Reddit 采集已取消');
    }
  };

  const handleCrawlGitHub = async () => {
    if (githubCrawling) return;
    
    const abort = new AbortController();
    setGithubAbort(abort);
    setGithubCrawling(true);
    setGithubProgress({ phase: 'crawling', message: '正在启动...', itemsFound: 0, promptsExtracted: 0 });
    
    try {
      await triggerCrawl('github', userId, (progress) => {
        // 检查是否已中断
        if (abort.signal.aborted) return;
        setGithubProgress(progress);
        
        // 如果有新提示词，立即添加到列表
        if (progress.newPrompt) {
          setPrompts(prev => [progress.newPrompt!, ...prev]);
          // 更新统计
          setStats(prev => prev ? {
            ...prev,
            totalPrompts: prev.totalPrompts + 1,
            githubPrompts: prev.githubPrompts + 1
          } : prev);
        }
      }, abort.signal);
      
      // 只有未中断时才显示成功提示
      if (!abort.signal.aborted) {
        toast.success('GitHub 采集完成！');
      }
    } catch (error: any) {
      // 只有未中断时才显示错误
      if (!abort.signal.aborted) {
        const msg = error.message || '';
        if (msg.includes('AI') || msg.includes('模型')) {
          toast.error('请先配置 AI 模型');
        } else {
          toast.error('GitHub 采集失败: ' + msg);
        }
      }
    }
    setGithubCrawling(false);
    setGithubAbort(null);
  };

  const handleStopGitHub = () => {
    if (githubAbort) {
      githubAbort.abort();
      setGithubProgress(prev => prev ? { ...prev, phase: 'cancelled', message: '已取消' } : null);
      setGithubCrawling(false);
      setGithubAbort(null);
      toast.info('GitHub 采集已取消');
    }
  };

  const handleCrawlAll = () => {
    // 并发启动两个采集
    if (!redditCrawling) handleCrawlReddit();
    if (!githubCrawling) handleCrawlGitHub();
  };

  const handleDelete = async (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    setPrompts(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    try {
      await deletePrompt(id);
      toast.info('已删除');
    } catch (error: any) {
      if (prompt) setPrompts(prev => [prompt, ...prev]);
      toast.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const removed = prompts.filter(p => ids.includes(p.id));
    setPrompts(prev => prev.filter(p => !ids.includes(p.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    try {
      await deletePrompts(ids);
      toast.success(`已删除 ${ids.length} 个`);
    } catch (error: any) {
      setPrompts(prev => [...removed, ...prev]);
      toast.error(error.message || '批量删除失败');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll = (pageIds: string[]) => {
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    if (allPageSelected) {
      // 取消选择当前页
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // 选择当前页
      setSelectedIds(prev => new Set([...prev, ...pageIds]));
    }
  };

  const tabs = [
    { key: 'prompts', label: '项目列表', icon: FileText, count: prompts.length },
    { key: 'history', label: '采集历史', icon: Clock },
    { key: 'config', label: '配置', icon: Settings }
  ];

  if (loading) return <LoadingSpinner text="加载中..." />;

  return (
    <div className="w-full h-full p-6 md:p-10 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <CrawlerIcon className="w-12 h-12" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">项目采集</h2>
              <p className="text-gray-500 text-sm">从 Reddit、GitHub 自动发现优质 AI 项目和资源</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCrawlReddit} disabled={redditCrawling}
              className="px-4 py-2.5 rounded-xl bg-[#FF4500] text-white font-medium hover:bg-[#FF5722] transition-all flex items-center gap-2 disabled:opacity-50">
              {redditCrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RedditIcon className="w-4 h-4" />}
              Reddit
            </button>
            <button onClick={handleCrawlGitHub} disabled={githubCrawling}
              className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50">
              {githubCrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
              GitHub
            </button>
            <button onClick={handleCrawlAll} disabled={redditCrawling && githubCrawling}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-medium hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50">
              {(redditCrawling && githubCrawling) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              全部采集
            </button>
          </div>
        </div>

        {/* 统计 */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">总项目</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalPrompts}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <RedditIcon className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-sm text-gray-500">Reddit</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.redditPrompts}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Github className="w-5 h-5 text-gray-700" />
                </div>
                <span className="text-sm text-gray-500">GitHub</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.githubPrompts}</div>
            </div>
          </div>
        )}

        {/* 采集进度条 - Reddit */}
        <AnimatePresence>
          {redditProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <motion.div
                        className="w-8 h-8 rounded-full bg-[#FF4500]"
                        animate={{ rotate: redditProgress.phase !== 'done' && redditProgress.phase !== 'cancelled' ? 360 : 0 }}
                        transition={{ duration: 2, repeat: redditProgress.phase !== 'done' && redditProgress.phase !== 'cancelled' ? Infinity : 0, ease: 'linear' }}
                      />
                      <div className="absolute inset-1 bg-white rounded-full flex items-center justify-center">
                        {redditProgress.phase === 'done' ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : redditProgress.phase === 'cancelled' ? (
                          <X className="w-3 h-3 text-red-500" />
                        ) : (
                          <RedditIcon className="w-3 h-3 text-[#FF4500]" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Reddit 采集</div>
                      <div className="text-xs text-gray-500">{redditProgress.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{redditProgress.reddit?.found || 0}</div>
                      <div className="text-xs text-gray-500">发现</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{redditProgress.reddit?.extracted || 0}</div>
                      <div className="text-xs text-orange-600">提取</div>
                    </div>
                    {redditProgress.phase !== 'done' && redditProgress.phase !== 'cancelled' && (
                      <button onClick={handleStopReddit} className="p-1.5 hover:bg-red-100 rounded-lg" title="停止采集">
                        <Square className="w-4 h-4 text-red-500 fill-red-500" />
                      </button>
                    )}
                    {(redditProgress.phase === 'done' || redditProgress.phase === 'cancelled') && (
                      <button onClick={() => setRedditProgress(null)} className="p-1.5 hover:bg-white/50 rounded-lg">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${redditProgress.phase === 'cancelled' ? 'bg-red-400' : 'bg-[#FF4500]'}`}
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: redditProgress.phase === 'crawling' ? '20%' : 
                             redditProgress.phase === 'analyzing' 
                               ? `${20 + ((redditProgress.current || 0) / Math.max(redditProgress.total || 1, 1)) * 70}%` : 
                             redditProgress.phase === 'saving' ? '95%' : '100%'
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 采集进度条 - GitHub */}
        <AnimatePresence>
          {githubProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <motion.div
                        className="w-8 h-8 rounded-full bg-gray-900"
                        animate={{ rotate: githubProgress.phase !== 'done' && githubProgress.phase !== 'cancelled' ? 360 : 0 }}
                        transition={{ duration: 2, repeat: githubProgress.phase !== 'done' && githubProgress.phase !== 'cancelled' ? Infinity : 0, ease: 'linear' }}
                      />
                      <div className="absolute inset-1 bg-white rounded-full flex items-center justify-center">
                        {githubProgress.phase === 'done' ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : githubProgress.phase === 'cancelled' ? (
                          <X className="w-3 h-3 text-red-500" />
                        ) : (
                          <Github className="w-3 h-3 text-gray-900" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">GitHub 采集</div>
                      <div className="text-xs text-gray-500">{githubProgress.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{githubProgress.github?.found || 0}</div>
                      <div className="text-xs text-gray-500">发现</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-700">{githubProgress.github?.extracted || 0}</div>
                      <div className="text-xs text-gray-600">提取</div>
                    </div>
                    {githubProgress.phase !== 'done' && githubProgress.phase !== 'cancelled' && (
                      <button onClick={handleStopGitHub} className="p-1.5 hover:bg-red-100 rounded-lg" title="停止采集">
                        <Square className="w-4 h-4 text-red-500 fill-red-500" />
                      </button>
                    )}
                    {(githubProgress.phase === 'done' || githubProgress.phase === 'cancelled') && (
                      <button onClick={() => setGithubProgress(null)} className="p-1.5 hover:bg-white/50 rounded-lg">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${githubProgress.phase === 'cancelled' ? 'bg-red-400' : 'bg-gray-900'}`}
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: githubProgress.phase === 'crawling' ? '20%' : 
                             githubProgress.phase === 'analyzing' 
                               ? `${20 + ((githubProgress.current || 0) / Math.max(githubProgress.total || 1, 1)) * 70}%` : 
                             githubProgress.phase === 'saving' ? '95%' : '100%'
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 标签页 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {tabs.filter(t => t.key !== 'config').map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    isActive 
                      ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'config' 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
            }`}
          >
            <Settings className="w-4 h-4" />
            配置
          </button>
        </div>

        {/* 内容 */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {activeTab === 'prompts' && (
              <PromptList
                prompts={prompts}
                selectedIds={selectedIds}
                selectMode={selectMode}
                onToggleSelectMode={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onDelete={handleDelete}
                onBatchDelete={handleBatchDelete}
                onClearAll={async () => {
                  if (!confirm('确定要清空所有项目吗？此操作不可恢复！')) return;
                  try {
                    await clearAllPrompts(userId);
                    setPrompts([]);
                    setStats(prev => prev ? { ...prev, totalPrompts: 0, redditPrompts: 0, githubPrompts: 0 } : prev);
                    toast.success('所有项目已清空');
                  } catch (e: any) {
                    toast.error(e.message || '清空失败');
                  }
                }}
              />
            )}
            {activeTab === 'history' && <JobHistory jobs={jobs} onRefresh={refreshData} onClear={async () => {
              if (!confirm('确定要清空所有历史记录吗？')) return;
              try {
                await clearCrawlJobs(userId);
                setJobs([]);
                toast.success('历史记录已清空');
              } catch (e: any) {
                toast.error(e.message || '清空失败');
              }
            }} />}
            {activeTab === 'config' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">模型选择</h3>
                  <ModelSelector
                    options={modelOptions}
                    selectedKey={selectedModelKey}
                    onChange={handleModelChange}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">爬取参数</h3>
                  <ConfigPanel 
                    config={config} 
                    userId={userId}
                    onUpdate={async (key, value) => {
                      await updateCrawlConfig(userId, key as any, value);
                      setConfig(prev => ({ ...prev, [key]: value }));
                      toast.success('已保存');
                    }}
                    onImport={async (importedConfig) => {
                      await saveCrawlConfig(userId, importedConfig);
                      setConfig(prev => ({ ...prev, ...importedConfig }));
                      toast.success('配置已导入');
                    }}
                    onExport={() => {
                      const json = exportConfigToJson(config as CrawlConfig);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `crawl-config-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('配置已导出');
                    }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}


// 提示词列表
function PromptList({
  prompts, selectedIds, selectMode, onToggleSelectMode, onToggleSelect, onSelectAll, onDelete, onBatchDelete, onClearAll
}: {
  prompts: CrawledPrompt[]; selectedIds: Set<string>; selectMode: boolean;
  onToggleSelectMode: () => void; onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void; onDelete: (id: string) => void; onBatchDelete: () => void;
  onClearAll: () => void;
}) {
  // 分离来源筛选和分类筛选
  const [sourceFilter, setSourceFilter] = useState<'all' | 'reddit' | 'github'>('all');
  const [subFilter, setSubFilter] = useState<string>(''); // 子版块或仓库
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // 列表容器 ref，用于滚动到顶部
  const listRef = React.useRef<HTMLDivElement>(null);
  
  // 切换页面时滚动到顶部
  const goToPage = (page: number) => {
    setCurrentPage(page);
    // 滚动到列表顶部
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 获取所有仓库和子版块
  const githubPrompts = prompts.filter(p => p.source_type === 'github');
  const redditPrompts = prompts.filter(p => p.source_type === 'reddit');
  const repos = [...new Set(githubPrompts.map(p => p.source_name).filter(Boolean))];
  const subreddits = [...new Set(redditPrompts.map(p => p.source_name).filter(Boolean))];
  
  // 根据当前来源筛选获取对应的分类（AI 建议的分类）
  const categories = useMemo(() => {
    let sourcePrompts = prompts;
    
    if (sourceFilter === 'reddit') {
      sourcePrompts = redditPrompts;
    } else if (sourceFilter === 'github') {
      sourcePrompts = githubPrompts;
    }
    
    return [...new Set(sourcePrompts.map(p => p.suggested_category).filter(Boolean))].sort();
  }, [prompts, redditPrompts, githubPrompts, sourceFilter]);

  // 当来源筛选变化时，重置子筛选和分类筛选
  useEffect(() => {
    setSubFilter('');
    setCategoryFilter('');
  }, [sourceFilter]);

  // 筛选后的提示词
  const filteredPrompts = useMemo(() => {
    let result = prompts;
    
    // 按来源类型筛选
    if (sourceFilter === 'reddit') {
      result = result.filter(p => p.source_type === 'reddit');
    } else if (sourceFilter === 'github') {
      result = result.filter(p => p.source_type === 'github');
    }
    
    // 按子版块或仓库筛选
    if (subFilter) {
      result = result.filter(p => p.source_name === subFilter);
    }
    
    // 按分类筛选
    if (categoryFilter) {
      result = result.filter(p => p.suggested_category === categoryFilter);
    }
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.prompt_title.toLowerCase().includes(query) ||
        p.prompt_content.toLowerCase().includes(query) ||
        p.suggested_category?.toLowerCase().includes(query) ||
        p.source_name?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [prompts, sourceFilter, subFilter, categoryFilter, searchQuery]);

  // 分页
  const totalPages = Math.ceil(filteredPrompts.length / pageSize);
  const paginatedPrompts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPrompts.slice(start, start + pageSize);
  }, [filteredPrompts, currentPage, pageSize]);

  // 当筛选条件变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [sourceFilter, subFilter, categoryFilter, searchQuery]);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (prompts.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-2">暂无提示词</p>
        <p className="text-gray-400 text-sm">点击上方按钮开始采集</p>
      </div>
    );
  }

  const allSelected = paginatedPrompts.length > 0 && paginatedPrompts.every(p => selectedIds.has(p.id));

  return (
    <div ref={listRef}>
      {/* 搜索栏 */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索提示词标题、内容、分类..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ring-primary/20 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 flex-wrap">
        {/* 来源筛选 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
              sourceFilter === 'all' 
                ? 'bg-gray-800/90 text-white border-gray-600 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-600 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}>
            全部
          </button>
          <button onClick={() => setSourceFilter('reddit')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 border ${
              sourceFilter === 'reddit' 
                ? 'bg-orange-500/90 text-white border-orange-400 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-600 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}>
            <RedditIcon className="w-3.5 h-3.5" />
            Reddit
          </button>
          <button onClick={() => setSourceFilter('github')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 border ${
              sourceFilter === 'github' 
                ? 'bg-gray-800/90 text-white border-gray-600 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-600 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}>
            <Github className="w-3.5 h-3.5" />
            GitHub
          </button>
        </div>

        {/* Reddit 子版块筛选 - 仅在 Reddit 模式下显示 */}
        {sourceFilter === 'reddit' && subreddits.length > 0 && (
          <select
            value={subFilter}
            onChange={e => setSubFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border outline-none cursor-pointer transition-all ${
              subFilter 
                ? 'bg-orange-500/90 text-white border-orange-400 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-700 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}
          >
            <option value="" className="bg-white text-gray-700">全部子版块</option>
            {subreddits.map(sub => (
              <option key={sub} value={sub!} className="bg-white text-gray-700">{sub}</option>
            ))}
          </select>
        )}

        {/* GitHub 仓库筛选 - 仅在 GitHub 模式下显示 */}
        {sourceFilter === 'github' && repos.length > 0 && (
          <select
            value={subFilter}
            onChange={e => setSubFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border outline-none cursor-pointer transition-all ${
              subFilter 
                ? 'bg-gray-800/90 text-white border-gray-600 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-700 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}
          >
            <option value="" className="bg-white text-gray-700">全部仓库</option>
            {repos.map(repo => (
              <option key={repo} value={repo!} className="bg-white text-gray-700">{repo}</option>
            ))}
          </select>
        )}

        {/* AI 分类筛选 - 根据当前来源显示对应分类 */}
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border outline-none cursor-pointer transition-all ${
              categoryFilter 
                ? 'bg-purple-500/90 text-white border-purple-400 backdrop-blur-sm' 
                : 'bg-white/70 text-gray-700 border-gray-200 backdrop-blur-sm hover:bg-white/90'
            }`}
          >
            <option value="" className="bg-white text-gray-700">按 AI 分类</option>
            {categories.map(cat => (
              <option key={cat} value={cat!} className="bg-white text-gray-700">{cat}</option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        {/* 批量管理 */}
        <button onClick={onToggleSelectMode}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectMode ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}>
          {selectMode ? '取消选择' : '批量管理'}
        </button>
        {!selectMode && prompts.length > 0 && (
          <button onClick={onClearAll}
            className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            清空全部
          </button>
        )}
        {selectMode && (
          <>
            <button onClick={() => onSelectAll(paginatedPrompts.map(p => p.id))} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
              {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              {allSelected ? '取消全选' : '全选当页'}
            </button>
            <span className="text-sm text-gray-400">已选 {selectedIds.size}</span>
            <button onClick={onBatchDelete} disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> 删除
            </button>
          </>
        )}
      </div>

      {/* 筛选结果提示 */}
      {(subFilter || categoryFilter || searchQuery) && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          {subFilter && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg">
              {sourceFilter === 'reddit' ? '子版块' : '仓库'}: {subFilter}
              <button onClick={() => setSubFilter('')} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">
              分类: {categoryFilter}
              <button onClick={() => setCategoryFilter('')} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg">
              搜索: {searchQuery}
              <button onClick={() => setSearchQuery('')} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span className="text-gray-400">({filteredPrompts.length} 条结果)</span>
        </div>
      )}

      {/* 列表 */}
      <div className="grid gap-3">
        {paginatedPrompts.map(prompt => {
          const isSelected = selectedIds.has(prompt.id);
          const isReddit = prompt.source_type === 'reddit';
          const isGitHub = prompt.source_type === 'github';

          return (
            <motion.div key={prompt.id} layout
              className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-md ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'
              }`}
              style={{ minHeight: '140px' }}>
              <div className="flex items-start gap-4 h-full">
                {/* 选择框 */}
                {selectMode && (
                  <button onClick={() => onToggleSelect(prompt.id)}
                    className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300 hover:border-gray-400'
                    }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                )}

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  {/* 标签行 */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${
                      isReddit ? 'bg-orange-50 text-orange-600' : 'bg-gray-900 text-white'
                    }`}>
                      {isReddit ? <RedditIcon className="w-3 h-3" /> : <Github className="w-3 h-3" />}
                      {isReddit ? 'Reddit' : 'GitHub'}
                    </span>
                    {prompt.suggested_category && (
                      <button
                        onClick={() => setCategoryFilter(prompt.suggested_category!)}
                        className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                      >
                        <Tag className="w-3 h-3 inline mr-1" />
                        {prompt.suggested_category}
                      </button>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-600">
                      <Star className="w-3 h-3" /> {prompt.quality_score.toFixed(1)}
                    </span>
                    {/* GitHub 显示仓库 star 数 */}
                    {isGitHub && prompt.source_stars != null && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-yellow-50 text-yellow-700">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {prompt.source_stars >= 1000 
                          ? `${(prompt.source_stars / 1000).toFixed(1)}k` 
                          : prompt.source_stars}
                      </span>
                    )}
                    {/* GitHub 显示热度（stars + forks*2） */}
                    {isGitHub && (prompt.source_stars != null || prompt.source_forks != null) && (() => {
                      const heat = (prompt.source_stars || 0) + (prompt.source_forks || 0) * 2;
                      const level = heat >= 10000 ? 'hot' : heat >= 1000 ? 'warm' : 'normal';
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                          level === 'hot' ? 'bg-red-50 text-red-600' :
                          level === 'warm' ? 'bg-orange-50 text-orange-600' :
                          'bg-gray-50 text-gray-500'
                        }`} title={`热度: ${heat} (stars + forks×2)`}>
                          <Flame className={`w-3 h-3 ${level === 'hot' ? 'fill-red-400' : level === 'warm' ? 'fill-orange-400' : ''}`} />
                          {heat >= 1000 ? `${(heat / 1000).toFixed(1)}k` : heat}
                        </span>
                      );
                    })()}
                    {/* Reddit 显示发布时间 */}
                    {isReddit && prompt.created_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTime(prompt.created_at)}
                      </span>
                    )}
                    {/* GitHub 显示最新提交时间 */}
                    {isGitHub && (prompt as any).source_updated_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400" title="最新提交">
                        <Clock className="w-3 h-3" />
                        {formatTime((prompt as any).source_updated_at)}
                      </span>
                    )}
                  </div>

                  {/* 标题 */}
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                    {prompt.prompt_title}
                  </h3>

                  {/* 内容预览 */}
                  <p className="text-sm text-gray-500 mb-3 overflow-hidden break-all" style={{ 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical',
                    maxHeight: '2.8em',
                    wordBreak: 'break-all'
                  }}>{prompt.prompt_content}</p>

                  {/* 来源信息 */}
                  <div className="flex items-center gap-3 text-xs">
                    {isGitHub && prompt.source_name && (
                      <button
                        onClick={() => { setSourceFilter('github'); setSubFilter(prompt.source_name!); }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span className="max-w-[150px] truncate">{prompt.source_name}</span>
                      </button>
                    )}
                    {isGitHub && prompt.source_author && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-medium text-white">
                          {prompt.source_author.charAt(0).toUpperCase()}
                        </span>
                        {prompt.source_author}
                      </span>
                    )}
                    {isReddit && prompt.source_name && (
                      <button
                        onClick={() => { setSourceFilter('reddit'); setSubFilter(prompt.source_name!); }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                      >
                        <RedditIcon className="w-3 h-3" />
                        {prompt.source_name}
                      </button>
                    )}
                  </div>
                </div>

                {/* 右侧操作 */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* 跳转按钮 */}
                  {prompt.source_url && (
                    <a
                      href={prompt.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      查看来源
                    </a>
                  )}
                  {/* 删除按钮 */}
                  {!selectMode && (
                    <button onClick={() => onDelete(prompt.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 p-4 bg-white rounded-xl border border-gray-100">
          <div className="text-sm text-gray-500">
            共 {filteredPrompts.length} 条，第 {currentPage}/{totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="首页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* 页码按钮 */}
            <div className="flex items-center gap-1 mx-2">
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
                    onClick={() => goToPage(pageNum)}
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
            </div>
            
            <button
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="末页"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 历史记录
function JobHistory({ jobs, onRefresh, onClear }: { jobs: CrawlJob[]; onRefresh: () => void; onClear: () => void }) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">暂无采集记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {jobs.length} 条记录</span>
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          清空历史
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">时间</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">类型</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">状态</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">发现</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">提取</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-600">
                  {new Date(job.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${
                    job.job_type === 'reddit' ? 'bg-orange-50 text-orange-600' :
                    job.job_type === 'github' ? 'bg-gray-100 text-gray-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {job.job_type === 'reddit' ? <RedditIcon className="w-3 h-3" /> :
                     job.job_type === 'github' ? <Github className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    {job.job_type}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${
                    job.status === 'completed' ? 'bg-green-50 text-green-600' :
                    job.status === 'running' ? 'bg-blue-50 text-blue-600' :
                    job.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600'
                  }`}>
                    {job.status === 'completed' ? '完成' : job.status === 'running' ? '运行中' : job.status === 'failed' ? '失败' : job.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-900 text-right font-medium">{job.items_found}</td>
                <td className="px-5 py-4 text-sm text-primary text-right font-bold">{job.prompts_extracted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 配置面板
function ConfigPanel({ 
  config, 
  userId,
  onUpdate, 
  onImport, 
  onExport 
}: { 
  config: Record<string, any>; 
  userId: string;
  onUpdate: (key: string, value: any) => void
  onImport: (config: Partial<CrawlConfig>) => void;
  onExport: () => void;
}) {
  const [newTag, setNewTag] = useState<{ key: string; value: string } | null>(null);
  const [editingTag, setEditingTag] = useState<{ key: string; oldValue: string; newValue: string } | null>(null);
  const [selectMode, setSelectMode] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [bulkKeywordsInput, setBulkKeywordsInput] = useState(''); // 批量关键词输入
  const [localAiPrompt, setLocalAiPrompt] = useState<string | null>(null); // 本地编辑状态
  const [copiedKey, setCopiedKey] = useState<string | null>(null); // 复制成功反馈
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null); // 当前悬浮的模板
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top'); // tooltip 位置
  const [editingTemplate, setEditingTemplate] = useState<UserTemplate | null>(null); // 正在编辑的模板
  const [editRedditTags, setEditRedditTags] = useState<string[]>([]); // 编辑中的 Reddit 标签
  const [editGithubTags, setEditGithubTags] = useState<string[]>([]); // 编辑中的 GitHub 标签
  const [editNewTag, setEditNewTag] = useState<{ key: string; value: string } | null>(null); // 编辑模式的新标签
  const [editSelectMode, setEditSelectMode] = useState<string | null>(null); // 编辑模式的选择模式
  const [editSelectedTags, setEditSelectedTags] = useState<Set<string>>(new Set()); // 编辑模式的选中标签
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const templateFileInputRef = React.useRef<HTMLInputElement>(null);

  // 处理模板卡片悬浮，智能判断 tooltip 位置
  const handleTemplateHover = (templateId: string, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    // 如果上方空间不足 200px，显示在下方
    setTooltipPosition(spaceAbove < 200 ? 'bottom' : 'top');
    setHoveredTemplate(templateId);
  };

  // 加载用户模板
  useEffect(() => {
    loadUserTemplates();
  }, [userId]);

  const loadUserTemplates = async () => {
    try {
      const templates = await getUserTemplates(userId);
      setUserTemplates(templates);
    } catch (e) {
      console.error('Failed to load user templates:', e);
    }
  };

  // 智能解析关键词（支持空格、逗号、换行分隔）
  const parseKeywords = (input: string): string[] => {
    if (!input.trim()) return [];
    // 按空格、逗号、换行分隔，过滤空值和去重
    const keywords = input
      .split(/[\s,，\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    return [...new Set(keywords)];
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      // 解析批量输入的关键词
      const parsedKeywords = parseKeywords(bulkKeywordsInput);
      
      // 合并当前配置和批量输入的关键词
      const redditSubs = config.reddit_subreddits || [];
      const githubQueries = [...new Set([...(config.github_search_queries || []), ...parsedKeywords])];
      
      await createUserTemplate(userId, {
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        reddit_subreddits: redditSubs,
        github_search_queries: githubQueries
      });
      await loadUserTemplates();
      setShowCreateTemplate(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      setBulkKeywordsInput('');
    } catch (e) {
      console.error('Failed to create template:', e);
    }
  };

  // 导入模板
  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        // 验证模板格式
        if (!data.name || typeof data.name !== 'string') {
          alert('无效的模板格式：缺少模板名称');
          return;
        }
        
        await createUserTemplate(userId, {
          name: data.name,
          description: data.description || '',
          reddit_subreddits: Array.isArray(data.reddit_subreddits) ? data.reddit_subreddits : [],
          github_search_queries: Array.isArray(data.github_search_queries) ? data.github_search_queries : []
        });
        await loadUserTemplates();
      } catch (err) {
        console.error('Failed to import template:', err);
        alert('导入失败：无效的 JSON 格式');
      }
    };
    reader.readAsText(file);
    
    // 重置 input
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
  };

  // 导出模板
  const handleExportTemplate = (template: UserTemplate) => {
    const exportData = {
      name: template.name,
      description: template.description,
      reddit_subreddits: template.reddit_subreddits,
      github_search_queries: template.github_search_queries
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${template.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteUserTemplate = async (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？')) return;
    try {
      await deleteUserTemplate(templateId);
      await loadUserTemplates();
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
  };

  // 打开编辑模板弹窗
  const handleOpenEditTemplate = (template: UserTemplate) => {
    setEditingTemplate(template);
    setEditRedditTags(template.reddit_subreddits || []);
    setEditGithubTags(template.github_search_queries || []);
    setEditNewTag(null);
    setEditSelectMode(null);
    setEditSelectedTags(new Set());
  };

  // 关闭编辑模板弹窗
  const handleCloseEditTemplate = () => {
    setEditingTemplate(null);
    setEditRedditTags([]);
    setEditGithubTags([]);
    setEditNewTag(null);
    setEditSelectMode(null);
    setEditSelectedTags(new Set());
  };

  // 保存编辑的模板
  const handleSaveEditTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await updateUserTemplate(editingTemplate.id, {
        reddit_subreddits: editRedditTags,
        github_search_queries: editGithubTags
      });
      await loadUserTemplates();
      handleCloseEditTemplate();
    } catch (e) {
      console.error('Failed to update template:', e);
    }
  };

  // 编辑模式：添加标签
  const handleEditAddTag = (key: 'reddit' | 'github') => {
    if (!editNewTag || editNewTag.key !== key || !editNewTag.value.trim()) return;
    const newTags = parseKeywords(editNewTag.value);
    if (newTags.length === 0) {
      setEditNewTag(null);
      return;
    }
    
    if (key === 'reddit') {
      const merged = [...new Set([...editRedditTags, ...newTags])];
      setEditRedditTags(merged);
    } else {
      const merged = [...new Set([...editGithubTags, ...newTags])];
      setEditGithubTags(merged);
    }
    setEditNewTag(null);
  };

  // 编辑模式：删除标签
  const handleEditRemoveTag = (key: 'reddit' | 'github', tag: string) => {
    if (key === 'reddit') {
      setEditRedditTags(prev => prev.filter(t => t !== tag));
    } else {
      setEditGithubTags(prev => prev.filter(t => t !== tag));
    }
  };

  // 编辑模式：批量删除
  const handleEditDeleteSelected = (key: 'reddit' | 'github') => {
    if (editSelectedTags.size === 0) return;
    if (key === 'reddit') {
      setEditRedditTags(prev => prev.filter(t => !editSelectedTags.has(t)));
    } else {
      setEditGithubTags(prev => prev.filter(t => !editSelectedTags.has(t)));
    }
    setEditSelectMode(null);
    setEditSelectedTags(new Set());
  };

  // 编辑模式：清空全部
  const handleEditClearAll = (key: 'reddit' | 'github') => {
    if (!confirm(`确定要清空所有${key === 'reddit' ? 'Reddit 子版块' : 'GitHub 关键词'}吗？`)) return;
    if (key === 'reddit') {
      setEditRedditTags([]);
    } else {
      setEditGithubTags([]);
    }
    setEditSelectMode(null);
    setEditSelectedTags(new Set());
  };

  const arrayItems = [
    { key: 'reddit_subreddits', label: 'Reddit 子版块', icon: RedditIcon, color: 'orange', placeholder: '支持批量输入，空格/逗号分隔，如: ChatGPT cursor LocalLLM' },
    { key: 'github_search_queries', label: 'GitHub 关键词', icon: Github, color: 'gray', placeholder: '支持批量输入，空格/逗号分隔，如: ai-tools cursor-rules nextjs' }
  ];

  const numberItems = [
    { key: 'min_reddit_score', label: 'Reddit 最低分', icon: TrendingUp },
    { key: 'min_github_stars', label: 'GitHub 最低 Stars', icon: Star },
    { key: 'ai_quality_threshold', label: 'AI 质量阈值', icon: Sparkles }
  ];

  const handleRemoveTag = (key: string, tag: string) => {
    const current = config[key] || [];
    onUpdate(key, current.filter((t: string) => t !== tag));
  };

  const handleAddTag = (key: string) => {
    if (!newTag || newTag.key !== key || !newTag.value.trim()) return;
    const current = config[key] || [];
    
    // 智能解析：支持空格、逗号、换行分隔的批量输入
    const newTags = parseKeywords(newTag.value);
    
    if (newTags.length === 0) {
      setNewTag(null);
      return;
    }
    
    // 合并并去重
    const merged = [...new Set([...current, ...newTags])];
    onUpdate(key, merged);
    setNewTag(null);
  };

  // 复制所有关键词（空格分隔）
  const handleCopyTags = async (key: string) => {
    const tags = config[key] || [];
    if (tags.length === 0) return;
    
    const text = tags.join(' ');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleEditTag = (key: string, oldValue: string) => {
    if (selectMode) return; // 选择模式下不允许编辑
    setEditingTag({ key, oldValue, newValue: oldValue });
  };

  const handleSaveEdit = () => {
    if (!editingTag || !editingTag.newValue.trim()) {
      setEditingTag(null);
      return;
    }
    const current = config[editingTag.key] || [];
    const newValue = editingTag.newValue.trim();
    
    if (editingTag.oldValue === newValue || (current.includes(newValue) && editingTag.oldValue !== newValue)) {
      setEditingTag(null);
      return;
    }
    
    const updated = current.map((t: string) => t === editingTag.oldValue ? newValue : t);
    onUpdate(editingTag.key, updated);
    setEditingTag(null);
  };

  const handleApplyTemplate = (template: typeof SYSTEM_TEMPLATES[0]) => {
    if (template.config.reddit_subreddits) {
      onUpdate('reddit_subreddits', template.config.reddit_subreddits);
    }
    if (template.config.github_search_queries) {
      onUpdate('github_search_queries', template.config.github_search_queries);
    }
  };

  const handleMergeTemplate = (template: typeof SYSTEM_TEMPLATES[0]) => {
    const currentReddit = config.reddit_subreddits || [];
    const currentGithub = config.github_search_queries || [];
    
    if (template.config.reddit_subreddits) {
      const merged = [...new Set([...currentReddit, ...template.config.reddit_subreddits])];
      onUpdate('reddit_subreddits', merged);
    }
    if (template.config.github_search_queries) {
      const merged = [...new Set([...currentGithub, ...template.config.github_search_queries])];
      onUpdate('github_search_queries', merged);
    }
  };

  // 批量操作
  const handleEnterSelectMode = (key: string) => {
    setSelectMode(key);
    setSelectedTags(new Set());
  };

  const handleExitSelectMode = () => {
    setSelectMode(null);
    setSelectedTags(new Set());
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleSelectAll = (key: string) => {
    const tags = config[key] || [];
    if (selectedTags.size === tags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(tags));
    }
  };

  const handleDeleteSelected = (key: string) => {
    if (selectedTags.size === 0) return;
    const current = config[key] || [];
    const remaining = current.filter((t: string) => !selectedTags.has(t));
    onUpdate(key, remaining);
    handleExitSelectMode();
  };

  const handleClearAll = (key: string) => {
    if (!confirm(`确定要清空所有${key === 'reddit_subreddits' ? 'Reddit 子版块' : 'GitHub 关键词'}吗？`)) return;
    onUpdate(key, []);
    handleExitSelectMode();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseConfigFromJson(content);
      if (parsed) {
        onImport(parsed);
      } else {
        alert('无效的配置文件格式');
      }
    };
    reader.readAsText(file);
    
    // 重置 input 以便可以再次选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getTagColor = (color: string) => {
    if (color === 'orange') return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
    return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
  };

  const hasNoKeywords = (!config.reddit_subreddits || config.reddit_subreddits.length === 0) && 
                        (!config.github_search_queries || config.github_search_queries.length === 0);

  return (
    <div className="grid gap-5">
      {/* 模板选择提示 - 当没有关键词时显示 */}
      {hasNoKeywords && (
        <div className="bg-gradient-to-r from-primary/5 to-purple-50 rounded-2xl border border-primary/20 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">开始配置采集关键词</h4>
              <p className="text-sm text-gray-600">
                选择下方预设模板快速开始，或手动添加自定义关键词来发现 AI 项目
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 导入导出按钮 */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            导入
          </button>
          <button
            onClick={onExport}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 模板管理区域 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900">采集模板</span>
              <p className="text-xs text-gray-400">快速应用预设或自定义模板</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={templateFileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportTemplate}
              className="hidden"
            />
            <button
              onClick={() => templateFileInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 transition-colors border border-gray-200"
            >
              <FolderOpen className="w-4 h-4" />
              导入模板
            </button>
            <button
              onClick={() => setShowCreateTemplate(!showCreateTemplate)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>
          </div>
        </div>

        {/* 新建模板表单 */}
        {showCreateTemplate && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="模板名称"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20"
                />
                <input
                  type="text"
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  placeholder="描述（可选）"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20"
                />
              </div>
              <div>
                <textarea
                  value={bulkKeywordsInput}
                  onChange={e => setBulkKeywordsInput(e.target.value)}
                  placeholder="批量输入关键词（空格、逗号或换行分隔）&#10;例如: react nextjs typescript tailwindcss"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20 resize-none font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">支持空格、逗号、换行分隔，会自动解析为多个关键词</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  当前配置: Reddit {(config.reddit_subreddits || []).length} 个 | GitHub {(config.github_search_queries || []).length} 个
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowCreateTemplate(false); setNewTemplateName(''); setNewTemplateDesc(''); setBulkKeywordsInput(''); }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={!newTemplateName.trim()}
                    className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    保存模板
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户自定义模板 */}
        {userTemplates.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">我的模板</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {userTemplates.map(template => {
                const allKeywords = [...(template.reddit_subreddits || []), ...(template.github_search_queries || [])];
                const isHovered = hoveredTemplate === `user-${template.id}`;
                return (
                  <div 
                    key={template.id} 
                    className="relative p-5 bg-white rounded-2xl border-2 border-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:z-[100] transition-all duration-200 cursor-pointer group"
                    onMouseEnter={(e) => handleTemplateHover(`user-${template.id}`, e)}
                    onMouseLeave={() => setHoveredTemplate(null)}
                    onClick={() => handleOpenEditTemplate(template)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-gray-900 text-base mb-1.5">{template.name}</h5>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {template.description || '自定义模板'}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-bold bg-gray-900 text-white rounded-full">
                        {allKeywords.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplyTemplate({ id: template.id, name: template.name, description: template.description, config: { reddit_subreddits: template.reddit_subreddits, github_search_queries: template.github_search_queries } })}
                          className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                          title="应用"
                        >
                          <Wrench className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMergeTemplate({ id: template.id, name: template.name, description: template.description, config: { reddit_subreddits: template.reddit_subreddits, github_search_queries: template.github_search_queries } })}
                          className="p-2 bg-white border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                          title="合并"
                        >
                          <GitMerge className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportTemplate(template)}
                          className="p-2 bg-white border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                          title="导出"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteUserTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Tooltip */}
                    {allKeywords.length > 0 && isHovered && (
                      <div className={`absolute left-1/2 -translate-x-1/2 p-3 bg-gray-900 text-white text-xs rounded-2xl shadow-2xl z-[200] w-[280px] ${
                        tooltipPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
                      }`}>
                        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                          <div className="flex flex-wrap gap-1.5">
                            {allKeywords.map((kw, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/15 rounded-full whitespace-nowrap">{kw}</span>
                            ))}
                          </div>
                        </div>
                        <div className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-transparent ${
                          tooltipPosition === 'top' 
                            ? 'top-full border-t-8 border-t-gray-900' 
                            : 'bottom-full border-b-8 border-b-gray-900'
                        }`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 系统预设模板 */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">系统预设</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SYSTEM_TEMPLATES.map(template => {
              const allKeywords = [...(template.config.reddit_subreddits || []), ...(template.config.github_search_queries || [])];
              const isHovered = hoveredTemplate === `system-${template.id}`;
              return (
                <div 
                  key={template.id} 
                  className="relative p-5 bg-white rounded-2xl border-2 border-gray-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:border-gray-900 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 hover:z-[100] transition-all duration-200 group"
                  onMouseEnter={(e) => handleTemplateHover(`system-${template.id}`, e)}
                  onMouseLeave={() => setHoveredTemplate(null)}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-gray-900 text-base mb-1.5">{template.name}</h5>
                      <p className="text-xs text-gray-500 line-clamp-1">{template.description}</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-600 rounded-full">
                      {allKeywords.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApplyTemplate(template)}
                      className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      title="应用"
                    >
                      <Wrench className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMergeTemplate(template)}
                      className="p-2 bg-white border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                      title="合并"
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Tooltip */}
                  {allKeywords.length > 0 && isHovered && (
                    <div className={`absolute left-1/2 -translate-x-1/2 p-3 bg-gray-900 text-white text-xs rounded-2xl shadow-2xl z-[200] w-[280px] ${
                      tooltipPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
                    }`}>
                      <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        <div className="flex flex-wrap gap-1.5">
                          {allKeywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/15 rounded-full whitespace-nowrap">{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-transparent ${
                        tooltipPosition === 'top' 
                          ? 'top-full border-t-8 border-t-gray-900' 
                          : 'bottom-full border-b-8 border-b-gray-900'
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 标签云配置 */}
      {arrayItems.map(item => {
        const Icon = item.icon;
        const tags = config[item.key] || [];
        const isAdding = newTag?.key === item.key;
        const isSelectMode = selectMode === item.key;
        const allSelected = tags.length > 0 && selectedTags.size === tags.length;
        
        return (
          <div key={item.key} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color === 'orange' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                  <Icon className={`w-5 h-5 ${item.color === 'orange' ? 'text-orange-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <span className="font-medium text-gray-900">{item.label}</span>
                  <span className="ml-2 text-xs text-gray-400">{tags.length} 个</span>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                {isSelectMode ? (
                  <>
                    <button
                      onClick={() => handleSelectAll(item.key)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                    >
                      {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                      {allSelected ? '取消全选' : '全选'}
                    </button>
                    <button
                      onClick={() => handleDeleteSelected(item.key)}
                      disabled={selectedTags.size === 0}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除 ({selectedTags.size})
                    </button>
                    <button
                      onClick={handleExitSelectMode}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    {tags.length > 0 && (
                      <div className="flex items-center gap-1 mr-2">
                        <button
                          onClick={() => handleCopyTags(item.key)}
                          className={`p-2 rounded-lg transition-all ${
                            copiedKey === item.key 
                              ? 'bg-green-100 text-green-600' 
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                          title="复制所有关键词"
                        >
                          {copiedKey === item.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEnterSelectMode(item.key)}
                          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                          title="批量选择"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleClearAll(item.key)}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                          title="清空全部"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {!isAdding && (
                      <button 
                        onClick={() => setNewTag({ key: item.key, value: '' })}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                        title="添加关键词"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* 标签云 */}
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string) => {
                const isEditing = editingTag?.key === item.key && editingTag?.oldValue === tag;
                const isSelected = selectedTags.has(tag);
                
                if (isEditing) {
                  return (
                    <div key={tag} className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={editingTag.newValue}
                        onChange={e => setEditingTag({ ...editingTag, newValue: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingTag(null);
                        }}
                        autoFocus
                        className="px-3 py-1.5 text-sm border border-primary/30 rounded-full outline-none focus:ring-2 ring-primary/20 w-32"
                      />
                      <button 
                        onClick={handleSaveEdit}
                        className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setEditingTag(null)}
                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }
                
                // 选择模式下的标签
                if (isSelectMode) {
                  return (
                    <span 
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-primary text-white border-primary shadow-md shadow-primary/30 scale-105' 
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-50" />}
                      {tag}
                    </span>
                  );
                }
                
                return (
                  <span 
                    key={tag} 
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${getTagColor(item.color)}`}
                    onDoubleClick={() => handleEditTag(item.key, tag)}
                    title="双击编辑"
                  >
                    {tag}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveTag(item.key, tag); }}
                      className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              
              {/* 添加输入框 */}
              {isAdding && (
                <div className="w-full flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newTag.value}
                    onChange={e => setNewTag({ ...newTag, value: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTag(item.key);
                      if (e.key === 'Escape') setNewTag(null);
                    }}
                    placeholder={item.placeholder}
                    autoFocus
                    className="flex-1 px-4 py-2 text-sm border border-primary/30 rounded-xl outline-none focus:ring-2 ring-primary/20"
                  />
                  <button 
                    onClick={() => handleAddTag(item.key)}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    添加
                  </button>
                  <button 
                    onClick={() => setNewTag(null)}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200"
                  >
                    取消
                  </button>
                </div>
              )}
              
              {tags.length === 0 && !isAdding && (
                <div className="w-full text-center py-4">
                  <p className="text-sm text-gray-400 mb-2">暂无关键词</p>
                  <p className="text-xs text-gray-300">{item.placeholder}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 数值配置 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <span className="font-medium text-gray-900">筛选阈值</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {numberItems.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <input
                  type="number"
                  value={config[item.key] || ''}
                  onChange={e => onUpdate(item.key, parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 ring-primary/20"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* AI 分析提示词 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900">AI 分析提示词</span>
              <p className="text-xs text-gray-400">自定义 AI 如何分析和提取项目信息</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('确定要恢复默认提示词吗？')) {
                setLocalAiPrompt(DEFAULT_AI_ANALYSIS_PROMPT);
              }
            }}
            className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            恢复默认
          </button>
        </div>
        <textarea
          value={localAiPrompt !== null ? localAiPrompt : (config.ai_analysis_prompt || DEFAULT_AI_ANALYSIS_PROMPT)}
          onChange={e => setLocalAiPrompt(e.target.value)}
          onFocus={() => {
            if (localAiPrompt === null) {
              setLocalAiPrompt(config.ai_analysis_prompt || DEFAULT_AI_ANALYSIS_PROMPT);
            }
          }}
          rows={12}
          className="w-full px-4 py-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-primary/20 resize-none font-mono"
          placeholder="输入 AI 分析提示词..."
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            提示：AI 会根据此提示词分析采集到的内容，提取项目信息并评分。
          </p>
          <button
            onClick={() => {
              if (localAiPrompt !== null) {
                onUpdate('ai_analysis_prompt', localAiPrompt);
                setLocalAiPrompt(null);
              }
            }}
            disabled={localAiPrompt === null || localAiPrompt === (config.ai_analysis_prompt || DEFAULT_AI_ANALYSIS_PROMPT)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            <Check className="w-4 h-4" />
            保存提示词
          </button>
        </div>
      </div>

      {/* 编辑模板弹窗 */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={handleCloseEditTemplate}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">编辑模板</h3>
                <p className="text-sm text-gray-500 mt-1">{editingTemplate.name}</p>
              </div>
              <button onClick={handleCloseEditTemplate} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Reddit 子版块 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                        <RedditIcon className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Reddit 子版块</span>
                        <span className="ml-2 text-xs text-gray-400">{editRedditTags.length} 个</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mr-2">
                      {editRedditTags.length > 0 && editSelectMode !== 'reddit' && (
                        <>
                          <button onClick={() => setEditSelectMode('reddit')} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all" title="批量选择">
                            <CheckSquare className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditClearAll('reddit')} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all" title="清空全部">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {editSelectMode === 'reddit' && (
                        <>
                          <button onClick={() => { const all = editRedditTags.every(t => editSelectedTags.has(t)); setEditSelectedTags(all ? new Set() : new Set(editRedditTags)); }} className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100">
                            {editRedditTags.every(t => editSelectedTags.has(t)) ? '取消全选' : '全选'}
                          </button>
                          <button onClick={() => handleEditDeleteSelected('reddit')} disabled={editSelectedTags.size === 0} className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
                            删除 ({editSelectedTags.size})
                          </button>
                          <button onClick={() => { setEditSelectMode(null); setEditSelectedTags(new Set()); }} className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100">
                            取消
                          </button>
                        </>
                      )}
                      {!editNewTag || editNewTag.key !== 'reddit' ? (
                        <button onClick={() => setEditNewTag({ key: 'reddit', value: '' })} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all" title="添加">
                          <Plus className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editRedditTags.map(tag => {
                      const isSelected = editSelectedTags.has(tag);
                      if (editSelectMode === 'reddit') {
                        return (
                          <span key={tag} onClick={() => setEditSelectedTags(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; })}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-all cursor-pointer ${isSelected ? 'bg-primary text-white border-primary shadow-md shadow-primary/30 scale-105' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100'}`}>
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-50" />}
                            {tag}
                          </span>
                        );
                      }
                      return (
                        <span key={tag} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-colors">
                          {tag}
                          <button onClick={() => handleEditRemoveTag('reddit', tag)} className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {editNewTag?.key === 'reddit' && (
                      <div className="w-full flex items-center gap-2 mt-2">
                        <input type="text" value={editNewTag.value} onChange={e => setEditNewTag({ ...editNewTag, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditAddTag('reddit'); if (e.key === 'Escape') setEditNewTag(null); }}
                          placeholder="支持批量输入，空格/逗号分隔" autoFocus
                          className="flex-1 px-4 py-2 text-sm border border-primary/30 rounded-xl outline-none focus:ring-2 ring-primary/20" />
                        <button onClick={() => handleEditAddTag('reddit')} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">添加</button>
                        <button onClick={() => setEditNewTag(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200">取消</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GitHub 关键词 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Github className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">GitHub 关键词</span>
                        <span className="ml-2 text-xs text-gray-400">{editGithubTags.length} 个</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mr-2">
                      {editGithubTags.length > 0 && editSelectMode !== 'github' && (
                        <>
                          <button onClick={() => setEditSelectMode('github')} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all" title="批量选择">
                            <CheckSquare className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditClearAll('github')} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all" title="清空全部">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {editSelectMode === 'github' && (
                        <>
                          <button onClick={() => { const all = editGithubTags.every(t => editSelectedTags.has(t)); setEditSelectedTags(all ? new Set() : new Set(editGithubTags)); }} className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100">
                            {editGithubTags.every(t => editSelectedTags.has(t)) ? '取消全选' : '全选'}
                          </button>
                          <button onClick={() => handleEditDeleteSelected('github')} disabled={editSelectedTags.size === 0} className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
                            删除 ({editSelectedTags.size})
                          </button>
                          <button onClick={() => { setEditSelectMode(null); setEditSelectedTags(new Set()); }} className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100">
                            取消
                          </button>
                        </>
                      )}
                      {!editNewTag || editNewTag.key !== 'github' ? (
                        <button onClick={() => setEditNewTag({ key: 'github', value: '' })} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all" title="添加">
                          <Plus className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editGithubTags.map(tag => {
                      const isSelected = editSelectedTags.has(tag);
                      if (editSelectMode === 'github') {
                        return (
                          <span key={tag} onClick={() => setEditSelectedTags(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; })}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 transition-all cursor-pointer ${isSelected ? 'bg-primary text-white border-primary shadow-md shadow-primary/30 scale-105' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100'}`}>
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-50" />}
                            {tag}
                          </span>
                        );
                      }
                      return (
                        <span key={tag} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors">
                          {tag}
                          <button onClick={() => handleEditRemoveTag('github', tag)} className="w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {editNewTag?.key === 'github' && (
                      <div className="w-full flex items-center gap-2 mt-2">
                        <input type="text" value={editNewTag.value} onChange={e => setEditNewTag({ ...editNewTag, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditAddTag('github'); if (e.key === 'Escape') setEditNewTag(null); }}
                          placeholder="支持批量输入，空格/逗号分隔" autoFocus
                          className="flex-1 px-4 py-2 text-sm border border-primary/30 rounded-xl outline-none focus:ring-2 ring-primary/20" />
                        <button onClick={() => handleEditAddTag('github')} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90">添加</button>
                        <button onClick={() => setEditNewTag(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200">取消</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={handleCloseEditTemplate} className="px-6 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
                取消
              </button>
              <button onClick={handleSaveEditTemplate} className="px-6 py-2.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2">
                <Check className="w-4 h-4" />
                保存更改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AI 模型选择器
function ModelSelector({ 
  options, 
  selectedKey, 
  onChange 
}: { 
  options: ModelOption[]; 
  selectedKey: string | null; 
  onChange: (key: string) => void;
}) {
  // 防止快速点击
  const [isChanging, setIsChanging] = useState(false);
  // 折叠状态 - 默认展开包含选中模型的提供商
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  const handleSelect = (key: string) => {
    if (isChanging || key === selectedKey) return;
    setIsChanging(true);
    onChange(key);
    setTimeout(() => setIsChanging(false), 300);
  };

  const toggleCollapse = (providerId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  // 全部折叠/展开
  const collapseAll = () => {
    const allProviderIds = Object.keys(grouped);
    if (collapsed.size === allProviderIds.length) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(allProviderIds));
    }
  };

  if (options.length === 0) {
    return (
      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-amber-800">未配置 AI 模型</p>
            <p className="text-sm text-amber-600">请先在设置页面配置 AI 提供商的 API Key</p>
          </div>
        </div>
      </div>
    );
  }

  // 按提供商分组
  const grouped = options.reduce((acc, opt) => {
    if (!acc[opt.providerId]) {
      acc[opt.providerId] = {
        providerKey: opt.providerKey,
        providerName: opt.providerName,
        models: []
      };
    }
    acc[opt.providerId].models.push(opt);
    return acc;
  }, {} as Record<string, { providerKey: string; providerName: string; models: ModelOption[] }>);

  // 获取当前选中的模型信息
  const selectedModel = selectedKey ? options.find(o => `${o.providerId}:${o.modelId}` === selectedKey) : null;
  const allCollapsed = collapsed.size === Object.keys(grouped).length;

  return (
    <div className="space-y-3">
      {/* 当前选中显示 + 折叠按钮 */}
      <div className="flex items-center justify-between">
        {selectedModel && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">当前:</span>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-lg">
              <AIProviderIcon providerKey={selectedModel.providerKey} size={16} />
              <span className="font-medium">{selectedModel.modelName}</span>
            </div>
          </div>
        )}
        <button
          onClick={collapseAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <motion.svg 
            className="w-4 h-4" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            animate={{ rotate: allCollapsed ? 180 : 0 }}
          >
            <path d="M19 9l-7 7-7-7" />
          </motion.svg>
          {allCollapsed ? '展开全部' : '折叠全部'}
        </button>
      </div>

      {Object.entries(grouped).map(([providerId, group]) => {
        const isCollapsed = collapsed.has(providerId);
        const hasSelected = group.models.some(m => `${m.providerId}:${m.modelId}` === selectedKey);
        
        return (
          <div key={providerId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleCollapse(providerId)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AIProviderIcon providerKey={group.providerKey} size={20} />
                <span className="font-medium text-gray-900">{group.providerName}</span>
                {hasSelected && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">已选</span>
                )}
              </div>
              <motion.svg 
                className="w-5 h-5 text-gray-400" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M19 9l-7 7-7-7" />
              </motion.svg>
            </button>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-2">
                    {group.models.map(model => {
                      const key = `${model.providerId}:${model.modelId}`;
                      const isSelected = key === selectedKey;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelect(key)}
                          disabled={isChanging}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                            isSelected 
                              ? 'bg-primary/10 text-primary' 
                              : 'hover:bg-gray-50 text-gray-700'
                          } ${isChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="flex-1">{model.modelName}</span>
                          <span className="text-xs text-gray-400 font-mono">{model.modelId}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
