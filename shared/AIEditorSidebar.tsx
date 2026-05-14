// AI 编辑器侧边栏 - 翻译、优化、总结
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Languages, Sparkles, FileText, Copy, Check, Settings, X, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  translatePromptStream,
  optimizePromptStream,
  summarizePrompt,
  translatePrompt,
  optimizePrompt,
  saveTranslation,
  getPromptAIData,
  getSummaryFromLocal,
  saveSummaryToLocal,
  getCustomPromptConfig,
  saveCustomPromptConfig,
  DEFAULT_PROMPTS,
  OptimizeResult,
  SummarizeResult,
} from '../lib/ai-prompt-assistant';
import { getStoredUser } from '../lib/auth';
import { hasEnabledProvider } from '../lib/ai-providers';
import { getPrompts, getCategories, Prompt } from '../lib/prompts';

// 后台任务缓存
const backgroundTaskCache: Record<string, {
  type: 'translate' | 'optimize' | 'summarize';
  promptId: string;
  promise: Promise<any>;
  result?: any;
  error?: string;
}> = {};

// 可复制的内容块组件
const CopyableBlock: React.FC<{
  content: string;
  className?: string;
  children: React.ReactNode;
}> = ({ content, className = '', children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
          copied ? 'bg-green-100 text-green-600' : 'bg-white/80 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title={copied ? '已复制' : '复制'}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

// 警告弹窗组件
const WarningModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onBackground: () => void;
}> = ({ isOpen, onClose, onConfirm, onBackground }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl w-[400px] shadow-xl max-md:w-[92vw] max-md:max-w-full" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI 正在处理中</h3>
              <p className="text-sm text-gray-500">关闭将中断当前操作</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            AI 正在生成内容，您可以选择：
          </p>
          <div className="space-y-2">
            <button
              onClick={onBackground}
              className="w-full py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
            >
              后台继续执行
            </button>
            <button
              onClick={onConfirm}
              className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
            >
              强制关闭
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 提示词选择器组件
const PromptSelector: React.FC<{
  type: 'translate' | 'optimize';
  currentPromptId: string | null;
  onSelect: (promptId: string | null, content: string | null) => void;
  onClose: () => void;
}> = ({ type, currentPromptId, onSelect, onClose }) => {
  const user = getStoredUser();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [langVersions, setLangVersions] = useState<Record<string, 'zh' | 'en'>>({});

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        getPrompts(user.id),
        getCategories(user.id)
      ]).then(([promptsData, categoriesData]) => {
        setPrompts(promptsData);
        setCategories(categoriesData);
        const versions: Record<string, 'zh' | 'en'> = {};
        promptsData.forEach(p => {
          versions[p.id] = p.content_en ? 'en' : 'zh';
        });
        setLangVersions(versions);
        setLoading(false);
      });
    }
  }, [user?.id]);

  const filtered = prompts.filter(p => 
    (selectedCategoryId === 'ALL' || p.category_id === selectedCategoryId) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) ||
     p.content.toLowerCase().includes(search.toLowerCase()))
  );

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '未分类';
    return categories.find(c => c.id === categoryId)?.name || '未分类';
  };

  const toggleLang = (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLangVersions(prev => ({
      ...prev,
      [promptId]: prev[promptId] === 'en' ? 'zh' : 'en'
    }));
  };

  const getPromptContent = (prompt: Prompt) => {
    const lang = langVersions[prompt.id] || 'zh';
    if (lang === 'en' && prompt.content_en) return prompt.content_en;
    return stripHtml(prompt.content);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[560px] max-h-[75vh] flex flex-col shadow-xl max-md:w-[92vw] max-md:max-w-full max-md:max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">
            选择{type === 'translate' ? '翻译' : '优化'}提示词
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-3 border-b space-y-3">
          <input
            type="text"
            placeholder="搜索提示词..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 ring-primary/20"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategoryId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategoryId === 'ALL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategoryId === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <button
            onClick={() => onSelect(null, null)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              !currentPromptId ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">默认</span>
              <span className="font-medium text-gray-900">使用系统默认提示词</span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">
              {DEFAULT_PROMPTS[type].substring(0, 100)}...
            </p>
          </button>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">没有找到提示词</div>
          ) : (
            filtered.map(prompt => {
              const hasEnglish = !!prompt.content_en;
              const currentLang = langVersions[prompt.id] || 'zh';
              const displayContent = getPromptContent(prompt);
              
              return (
                <button
                  key={prompt.id}
                  onClick={() => onSelect(prompt.id, displayContent)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    currentPromptId === prompt.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{prompt.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                        {getCategoryName(prompt.category_id)}
                      </span>
                    </div>
                    {hasEnglish && (
                      <div 
                        onClick={(e) => toggleLang(prompt.id, e)}
                        className="flex items-center bg-gray-100 rounded-md text-[10px] font-medium overflow-hidden"
                      >
                        <span className={`px-2 py-1 transition-colors ${currentLang === 'zh' ? 'bg-primary text-white' : 'text-gray-500'}`}>中</span>
                        <span className={`px-2 py-1 transition-colors ${currentLang === 'en' ? 'bg-primary text-white' : 'text-gray-500'}`}>EN</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{displayContent.substring(0, 120)}...</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface AIEditorSidebarProps {
  promptId?: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onContentChange?: (content: string) => void;
  defaultTab?: TabType;
}

type TabType = 'translate' | 'optimize' | 'summarize';

export const AIEditorSidebar: React.FC<AIEditorSidebarProps> = ({
  promptId,
  content,
  isOpen,
  onClose,
  onContentChange,
  defaultTab = 'translate',
}) => {
  const user = getStoredUser();
  const userId = user?.id || '';

  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [hasProvider, setHasProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自定义提示词配置
  const [customConfig, setCustomConfig] = useState(getCustomPromptConfig());
  const [showTranslateSelector, setShowTranslateSelector] = useState(false);
  const [showOptimizeSelector, setShowOptimizeSelector] = useState(false);
  const [translatePromptId, setTranslatePromptId] = useState<string | null>(null);
  const [optimizePromptId, setOptimizePromptId] = useState<string | null>(null);

  // 加载状态
  const [translateLoading, setTranslateLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  
  // 流式输出（仅翻译使用）
  const [translateStreaming, setTranslateStreaming] = useState('');
  const [optimizeStreaming, setOptimizeStreaming] = useState('');

  // 结果
  const [savedTranslation, setSavedTranslation] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<SummarizeResult | null>(null);
  const [translateResult, setTranslateResult] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [summary, setSummary] = useState<SummarizeResult | null>(null);
  
  // 警告弹窗
  const [showWarning, setShowWarning] = useState(false);
  const pendingCloseRef = useRef(false);

  // 检查是否有正在进行的任务
  const isAnyLoading = translateLoading || optimizeLoading || summarizeLoading;

  useEffect(() => {
    if (userId) hasEnabledProvider(userId).then(setHasProvider);
  }, [userId]);

  useEffect(() => {
    if (isOpen) setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  useEffect(() => {
    if (promptId && isOpen) {
      loadSavedData();
      // 检查是否有后台任务完成
      checkBackgroundTasks();
    }
  }, [promptId, isOpen]);

  const loadSavedData = async () => {
    if (!promptId) return;
    const aiData = await getPromptAIData(promptId);
    setSavedTranslation(aiData.contentEn);
    const localSummary = getSummaryFromLocal(promptId);
    setSavedSummary(localSummary);
    setSummary(localSummary);
  };

  const checkBackgroundTasks = () => {
    if (!promptId) return;
    
    // 检查翻译任务
    const translateTask = backgroundTaskCache[`translate_${promptId}`];
    if (translateTask?.result) {
      setTranslateResult(translateTask.result);
      setSavedTranslation(translateTask.result);
      delete backgroundTaskCache[`translate_${promptId}`];
    }
    
    // 检查优化任务
    const optimizeTask = backgroundTaskCache[`optimize_${promptId}`];
    if (optimizeTask?.result) {
      setOptimizeResult(optimizeTask.result);
      delete backgroundTaskCache[`optimize_${promptId}`];
    }
    
    // 检查总结任务
    const summarizeTask = backgroundTaskCache[`summarize_${promptId}`];
    if (summarizeTask?.result) {
      setSummary(summarizeTask.result);
      setSavedSummary(summarizeTask.result);
      delete backgroundTaskCache[`summarize_${promptId}`];
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(300, Math.min(600, newWidth)));
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleSelectTranslatePrompt = (id: string | null, promptContent: string | null) => {
    setTranslatePromptId(id);
    const newConfig = { ...customConfig, translate: promptContent };
    setCustomConfig(newConfig);
    saveCustomPromptConfig(newConfig);
    setShowTranslateSelector(false);
  };

  const handleSelectOptimizePrompt = (id: string | null, promptContent: string | null) => {
    setOptimizePromptId(id);
    const newConfig = { ...customConfig, optimize: promptContent };
    setCustomConfig(newConfig);
    saveCustomPromptConfig(newConfig);
    setShowOptimizeSelector(false);
  };

  // 翻译功能
  const handleTranslate = useCallback(async () => {
    if (!hasProvider) { setError('请先在设置中配置 AI 提供商'); return; }
    setTranslateLoading(true);
    setTranslateStreaming('');
    setTranslateResult(null);
    setError(null);
    try {
      let translated = '';
      const generator = translatePromptStream(userId, content);
      for await (const chunk of generator) {
        translated += chunk;
        setTranslateStreaming(translated);
      }
      setTranslateResult(translated);
      if (promptId) {
        await saveTranslation(promptId, translated);
        setSavedTranslation(translated);
      }
    } catch (err: any) {
      setError(err.message || '翻译失败');
    } finally {
      setTranslateLoading(false);
    }
  }, [userId, content, promptId, hasProvider]);

  // 优化功能 - 不显示原始 JSON，直接解析后显示友好 UI
  const handleOptimize = useCallback(async () => {
    if (!hasProvider) { setError('请先在设置中配置 AI 提供商'); return; }
    setOptimizeLoading(true);
    setOptimizeStreaming('');
    setOptimizeResult(null);
    setError(null);
    try {
      let result = '';
      const generator = optimizePromptStream(userId, content);
      for await (const chunk of generator) {
        result += chunk;
        // 不显示原始 JSON，只显示加载状态
        setOptimizeStreaming('正在分析和优化提示词...');
      }
      // 解析结果
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setOptimizeResult({
            original: content,
            optimized: parsed.optimized || result,
            changes: parsed.changes || [],
            qualityBefore: parsed.qualityBefore || 0,
            qualityAfter: parsed.qualityAfter || 0,
          });
        } else {
          // 如果没有 JSON，直接使用结果作为优化后的内容
          setOptimizeResult({ original: content, optimized: result, changes: [], qualityBefore: 0, qualityAfter: 0 });
        }
      } catch {
        setOptimizeResult({ original: content, optimized: result, changes: [], qualityBefore: 0, qualityAfter: 0 });
      }
    } catch (err: any) {
      setError(err.message || '优化失败');
    } finally {
      setOptimizeLoading(false);
    }
  }, [userId, content, hasProvider]);

  // 总结功能
  const handleSummarize = useCallback(async () => {
    if (!hasProvider) { setError('请先在设置中配置 AI 提供商'); return; }
    setSummarizeLoading(true);
    setError(null);
    try {
      const result = await summarizePrompt(userId, content);
      setSummary(result);
      if (promptId) {
        saveSummaryToLocal(promptId, result);
        setSavedSummary(result);
      }
    } catch (err: any) {
      setError(err.message || '总结失败');
    } finally {
      setSummarizeLoading(false);
    }
  }, [userId, content, promptId, hasProvider]);

  // 应用优化结果
  const handleApplyOptimize = useCallback(() => {
    if (!optimizeResult) return;
    onContentChange?.(optimizeResult.optimized);
    setOptimizeResult(null);
  }, [optimizeResult, onContentChange]);

  // 处理关闭
  const handleClose = useCallback(() => {
    if (isAnyLoading) {
      setShowWarning(true);
    } else {
      onClose();
    }
  }, [isAnyLoading, onClose]);

  // 强制关闭
  const handleForceClose = useCallback(() => {
    setShowWarning(false);
    setTranslateLoading(false);
    setOptimizeLoading(false);
    setSummarizeLoading(false);
    onClose();
  }, [onClose]);

  // 后台执行
  const handleBackgroundExecution = useCallback(async () => {
    if (!promptId) {
      handleForceClose();
      return;
    }
    
    setShowWarning(false);
    
    // 根据当前正在执行的任务类型，启动后台任务
    if (translateLoading) {
      const taskKey = `translate_${promptId}`;
      backgroundTaskCache[taskKey] = {
        type: 'translate',
        promptId,
        promise: (async () => {
          try {
            const result = await translatePrompt(userId, content);
            backgroundTaskCache[taskKey].result = result.translated;
            if (promptId) await saveTranslation(promptId, result.translated);
          } catch (err: any) {
            backgroundTaskCache[taskKey].error = err.message;
          }
        })()
      };
    }
    
    if (optimizeLoading) {
      const taskKey = `optimize_${promptId}`;
      backgroundTaskCache[taskKey] = {
        type: 'optimize',
        promptId,
        promise: (async () => {
          try {
            const result = await optimizePrompt(userId, content);
            backgroundTaskCache[taskKey].result = result;
          } catch (err: any) {
            backgroundTaskCache[taskKey].error = err.message;
          }
        })()
      };
    }
    
    if (summarizeLoading) {
      const taskKey = `summarize_${promptId}`;
      backgroundTaskCache[taskKey] = {
        type: 'summarize',
        promptId,
        promise: (async () => {
          try {
            const result = await summarizePrompt(userId, content);
            backgroundTaskCache[taskKey].result = result;
            if (promptId) saveSummaryToLocal(promptId, result);
          } catch (err: any) {
            backgroundTaskCache[taskKey].error = err.message;
          }
        })()
      };
    }
    
    // 关闭侧边栏
    setTranslateLoading(false);
    setOptimizeLoading(false);
    setSummarizeLoading(false);
    onClose();
  }, [promptId, userId, content, translateLoading, optimizeLoading, summarizeLoading, onClose, handleForceClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={sidebarRef}
      style={{ width }}
      className="h-full bg-white border-l border-gray-200 flex flex-col relative max-md:!w-full max-md:border-l-0 max-md:border-t"
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30 transition-colors z-10"
      />

      {/* Tab 栏 */}
      <div className="flex border-b border-gray-200 shrink-0 h-[41px]">
        {[
          { id: 'translate' as TabType, label: '翻译', icon: Languages },
          { id: 'optimize' as TabType, label: '优化', icon: Sparkles },
          { id: 'summarize' as TabType, label: '总结', icon: FileText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-1.5 ${
              activeTab === tab.id ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {/* 翻译 Tab */}
        {activeTab === 'translate' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowTranslateSelector(true)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-600">
                <Settings className="w-4 h-4" />
                <span>{customConfig.translate ? '使用自定义提示词' : '使用默认提示词'}</span>
              </div>
              <span className="text-xs text-primary">配置</span>
            </button>

            {savedTranslation && !translateLoading && !translateResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">已保存的翻译</span>
                  <button onClick={handleTranslate} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    重新翻译
                  </button>
                </div>
                <CopyableBlock content={savedTranslation} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans pr-8">{savedTranslation}</pre>
                </CopyableBlock>
              </div>
            )}

            {translateLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    正在翻译...
                  </div>
                  <button
                    onClick={() => setTranslateLoading(false)}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    中断
                  </button>
                </div>
                {translateStreaming && (
                  <CopyableBlock content={translateStreaming} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans pr-8">{translateStreaming}</pre>
                  </CopyableBlock>
                )}
              </div>
            )}

            {translateResult && !translateLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-green-600">✓ 翻译完成并已保存</span>
                  <button onClick={handleTranslate} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    重新翻译
                  </button>
                </div>
                <CopyableBlock content={translateResult} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans pr-8">{translateResult}</pre>
                </CopyableBlock>
              </div>
            )}

            {!savedTranslation && !translateLoading && !translateResult && (
              <button
                onClick={handleTranslate}
                disabled={!hasProvider}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Languages className="w-4 h-4" />
                翻译为英文
              </button>
            )}

            {!hasProvider && <p className="text-xs text-gray-500 text-center">请先在设置中配置 AI 提供商</p>}
          </div>
        )}

        {/* 优化 Tab */}
        {activeTab === 'optimize' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowOptimizeSelector(true)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-600">
                <Settings className="w-4 h-4" />
                <span>{customConfig.optimize ? '使用自定义提示词' : '使用默认提示词'}</span>
              </div>
              <span className="text-xs text-primary">配置</span>
            </button>

            {optimizeLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    正在优化...
                  </div>
                  <button
                    onClick={() => setOptimizeLoading(false)}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    中断
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">正在分析和优化提示词...</p>
                      <p className="text-xs text-gray-400 mt-0.5">AI 正在评估质量并生成改进建议</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {optimizeResult && !optimizeLoading && (
              <div className="space-y-3">
                {/* 质量评分 */}
                {(optimizeResult.qualityBefore > 0 || optimizeResult.qualityAfter > 0) && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">优化前</div>
                      <div className={`text-lg font-bold ${optimizeResult.qualityBefore >= 7 ? 'text-green-600' : optimizeResult.qualityBefore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {optimizeResult.qualityBefore}/10
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">优化后</div>
                      <div className={`text-lg font-bold ${optimizeResult.qualityAfter >= 7 ? 'text-green-600' : optimizeResult.qualityAfter >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {optimizeResult.qualityAfter}/10
                      </div>
                    </div>
                  </div>
                )}

                {/* 变更说明 */}
                {optimizeResult.changes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">改进说明</div>
                    <ul className="space-y-1.5 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      {optimizeResult.changes.map((change, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 优化后内容 */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">优化后内容</div>
                  <CopyableBlock content={optimizeResult.optimized} className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans pr-8">{optimizeResult.optimized}</pre>
                  </CopyableBlock>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button onClick={handleApplyOptimize} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                    应用优化
                  </button>
                  <button onClick={handleOptimize} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新优化
                  </button>
                </div>
              </div>
            )}

            {!optimizeLoading && !optimizeResult && (
              <button
                onClick={handleOptimize}
                disabled={!hasProvider}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                优化提示词
              </button>
            )}
          </div>
        )}

        {/* 总结 Tab */}
        {activeTab === 'summarize' && (
          <div className="space-y-3">
            {summarizeLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    正在总结...
                  </div>
                  <button
                    onClick={() => setSummarizeLoading(false)}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    中断
                  </button>
                </div>
              </div>
            )}

            {summary && !summarizeLoading && (
              <div className="space-y-3">
                <CopyableBlock content={summary.summary} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-blue-600 mb-1">📝 一句话总结</div>
                  <p className="text-sm text-gray-700 pr-8">{summary.summary}</p>
                </CopyableBlock>

                {summary.purpose && (
                  <CopyableBlock content={summary.purpose} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-purple-600 mb-1">🎯 目的</div>
                    <p className="text-sm text-gray-700 pr-8">{summary.purpose}</p>
                  </CopyableBlock>
                )}

                {summary.keyPoints.length > 0 && (
                  <CopyableBlock content={summary.keyPoints.join('\n')} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-green-600 mb-2">💡 关键点</div>
                    <ul className="space-y-1 pr-8">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 shrink-0">•</span>{point}
                        </li>
                      ))}
                    </ul>
                  </CopyableBlock>
                )}

                {savedSummary && (
                  <div className="text-xs text-gray-400 text-center">
                    上次总结: {new Date(savedSummary.summarizedAt).toLocaleString('zh-CN')}
                  </div>
                )}

                <button onClick={handleSummarize} className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  重新总结
                </button>
              </div>
            )}

            {!summarizeLoading && !summary && (
              <button
                onClick={handleSummarize}
                disabled={!hasProvider}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                总结提示词
              </button>
            )}
          </div>
        )}
      </div>

      {/* 提示词选择器弹窗 */}
      {showTranslateSelector && (
        <PromptSelector
          type="translate"
          currentPromptId={translatePromptId}
          onSelect={handleSelectTranslatePrompt}
          onClose={() => setShowTranslateSelector(false)}
        />
      )}
      {showOptimizeSelector && (
        <PromptSelector
          type="optimize"
          currentPromptId={optimizePromptId}
          onSelect={handleSelectOptimizePrompt}
          onClose={() => setShowOptimizeSelector(false)}
        />
      )}
      
      {/* 警告弹窗 */}
      <WarningModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onConfirm={handleForceClose}
        onBackground={handleBackgroundExecution}
      />
    </div>
  );
};

export default AIEditorSidebar;
