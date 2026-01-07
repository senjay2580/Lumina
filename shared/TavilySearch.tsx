// Tavily 搜索组件 - AI 增强搜索
import React, { useState, useEffect } from 'react'
import { Search, Loader2, ExternalLink, Sparkles, AlertCircle, Plus, Star, GitFork, Clock, Filter, History, X, Globe, BookOpen, Newspaper, Code } from 'lucide-react'
// @ts-ignore
import { Github } from 'lucide-react'
import { tavilySearch, type TavilySearchResponse, type TavilySearchResult } from '../lib/tavily'
import { getTavilyApiKey } from '../lib/user-credentials'

// 导出类型供外部使用
export type { TavilySearchResult } from '../lib/tavily'

const STORAGE_KEY = 'tavily_search_cache'
const HISTORY_KEY = 'tavily_search_history'

// 搜索类型配置
type SearchType = 'general' | 'github' | 'news' | 'docs' | 'chinese'

const SEARCH_TYPES: { id: SearchType; label: string; icon: React.ReactNode; domains?: string[]; excludeDomains?: string[]; queryPrefix?: string }[] = [
  { id: 'general', label: '通用', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5" />, domains: ['github.com'] },
  { id: 'news', label: '新闻', icon: <Newspaper className="w-3.5 h-3.5" />, domains: ['techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', '36kr.com', 'sspai.com', 'infoq.cn'] },
  { id: 'docs', label: '文档', icon: <BookOpen className="w-3.5 h-3.5" />, domains: ['docs.github.com', 'developer.mozilla.org', 'reactjs.org', 'vuejs.org', 'nextjs.org', 'tailwindcss.com'] },
  { id: 'chinese', label: '中文', icon: <span className="text-xs font-medium">中</span>, domains: ['zhihu.com', 'juejin.cn', 'segmentfault.com', 'csdn.net', 'cnblogs.com', 'oschina.net', 'v2ex.com'] }
]

interface CachedSearch {
  query: string
  searchType: SearchType
  response: TavilySearchResponse
  timestamp: number
}

// 判断是否是 GitHub 仓库链接
function isGitHubRepo(url: string): boolean {
  try {
    const u = new URL(url)
    // github.com/owner/repo 格式
    return u.hostname === 'github.com' && u.pathname.split('/').filter(Boolean).length >= 2
  } catch {
    return false
  }
}

// 从 GitHub URL 提取 owner/repo
function extractGitHubInfo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] }
    }
  } catch {}
  return null
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

// 从 localStorage 读取缓存
function getCache(): CachedSearch | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const data = JSON.parse(cached) as CachedSearch
      // 缓存 24 小时有效
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data
      }
    }
  } catch {}
  return null
}

// 保存到 localStorage
function setCache(query: string, searchType: SearchType, response: TavilySearchResponse) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      query,
      searchType,
      response,
      timestamp: Date.now()
    }))
  } catch {}
}

// 获取搜索历史
function getSearchHistory(): string[] {
  try {
    const history = localStorage.getItem(HISTORY_KEY)
    return history ? JSON.parse(history) : []
  } catch {
    return []
  }
}

// 添加到搜索历史
function addToHistory(query: string) {
  try {
    const history = getSearchHistory()
    const filtered = history.filter(h => h !== query)
    const newHistory = [query, ...filtered].slice(0, 10) // 保留最近 10 条
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
  } catch {}
}

// 清除搜索历史
function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {}
}

interface Props {
  userId: string
  onSelectResult?: (result: TavilySearchResult) => void
  placeholder?: string
  className?: string
}

export function TavilySearch({ userId, onSelectResult, placeholder = '搜索互联网...', className = '' }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<TavilySearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noApiKey, setNoApiKey] = useState(false)
  const [searchType, setSearchType] = useState<SearchType>('general')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [maxResults, setMaxResults] = useState(10)

  // 初始化时从 localStorage 恢复
  useEffect(() => {
    const cached = getCache()
    if (cached) {
      setQuery(cached.query)
      setSearchType(cached.searchType || 'general')
      setResponse(cached.response)
    }
    setHistory(getSearchHistory())
  }, [])

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)
    setNoApiKey(false)
    setShowHistory(false)

    try {
      const apiKey = await getTavilyApiKey(userId)
      if (!apiKey) {
        setNoApiKey(true)
        setError('请先在设置中配置 Tavily API Key')
        return
      }

      const typeConfig = SEARCH_TYPES.find(t => t.id === searchType)
      
      const result = await tavilySearch(q, apiKey, {
        maxResults: maxResults,
        searchDepth: 'advanced', // 使用高级搜索
        includeAnswer: true,
        includeDomains: typeConfig?.domains || [],
        excludeDomains: typeConfig?.excludeDomains || []
      })
      setResponse(result)
      // 保存到 localStorage
      setCache(q, searchType, result)
      // 添加到历史
      addToHistory(q)
      setHistory(getSearchHistory())
    } catch (err: any) {
      setError(err.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleHistoryClick = (q: string) => {
    setQuery(q)
    setShowHistory(false)
    handleSearch(q)
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜索类型选择器 */}
      <div className="flex items-center gap-1 flex-wrap">
        {SEARCH_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setSearchType(type.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              searchType === type.id
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
            }`}
          >
            {type.icon}
            {type.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600"
          >
            <option value={5}>5 条</option>
            <option value={10}>10 条</option>
            <option value={15}>15 条</option>
            <option value={20}>20 条</option>
          </select>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => history.length > 0 && setShowHistory(true)}
              placeholder={placeholder}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            搜索
          </button>
        </div>

        {/* 搜索历史下拉 */}
        {showHistory && history.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <History className="w-3 h-3" />
                搜索历史
              </span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                清除
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleHistoryClick(h)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="truncate">{h}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 点击外部关闭历史 */}
      {showHistory && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            {error}
            {noApiKey && (
              <p className="mt-1 text-red-600">
                获取 API Key: <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="underline">tavily.com</a> (免费 1000次/月)
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI 回答 */}
      {response?.answer && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">AI 摘要</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{response.answer}</p>
        </div>
      )}

      {/* 搜索结果 */}
      {response && response.results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            找到 {response.results.length} 个结果 · {response.responseTime}ms
          </div>
          <div className="space-y-2">
            {response.results.map((result, index) => {
              const isGitHub = isGitHubRepo(result.url)
              const ghInfo = isGitHub ? extractGitHubInfo(result.url) : null
              
              // GitHub 仓库特殊卡片
              if (isGitHub && ghInfo) {
                return (
                  <div
                    key={index}
                    className="rounded-xl overflow-hidden border border-[#30363d]"
                    style={{ background: 'linear-gradient(145deg, #161b22 0%, #0d1117 100%)' }}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Github className="w-4 h-4 text-[#8b949e] flex-shrink-0" />
                          <span className="font-medium text-[#e6edf3] text-sm truncate">
                            {ghInfo.owner}/{ghInfo.repo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {onSelectResult && (
                            <button
                              onClick={() => onSelectResult(result)}
                              className="p-1.5 text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] rounded transition-colors"
                              title="添加到资源中心"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] rounded transition-colors"
                            title="在 GitHub 打开"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                      {result.content && (
                        <p className="text-xs text-[#8b949e] line-clamp-2 leading-relaxed">{result.content}</p>
                      )}
                    </div>
                  </div>
                )
              }
              
              // 普通结果卡片
              return (
                <div
                  key={index}
                  className="p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-1 flex-1">{result.title}</h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {onSelectResult && (
                        <button
                          onClick={() => onSelectResult(result)}
                          className="p-1 text-gray-400 hover:text-primary hover:bg-orange-50 rounded transition-colors"
                          title="添加到资源中心"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                        title="在新标签页打开"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{result.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400 truncate max-w-[200px]">
                      {new URL(result.url).hostname}
                    </span>
                    {result.publishedDate && (
                      <span className="text-xs text-gray-400">
                        · {new Date(result.publishedDate).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 无结果 */}
      {response && response.results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">未找到相关结果</p>
        </div>
      )}
    </div>
  )
}

export default TavilySearch
