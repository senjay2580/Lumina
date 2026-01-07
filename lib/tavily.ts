// Tavily Search API 集成
// 专为 AI 优化的搜索 API，用于获取实时互联网信息

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  publishedDate?: string
}

export interface TavilySearchResponse {
  query: string
  answer?: string
  results: TavilySearchResult[]
  responseTime: number
}

export interface TavilySearchOptions {
  maxResults?: number
  searchDepth?: 'basic' | 'advanced'
  includeAnswer?: boolean
  includeImages?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
}

const TAVILY_API_URL = 'https://api.tavily.com/search'

/**
 * 使用 Tavily API 搜索互联网
 */
export async function tavilySearch(
  query: string,
  apiKey: string,
  options: TavilySearchOptions = {}
): Promise<TavilySearchResponse> {
  const {
    maxResults = 5,
    searchDepth = 'basic',
    includeAnswer = true,
    includeImages = false,
    includeDomains = [],
    excludeDomains = []
  } = options

  const startTime = Date.now()

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: includeAnswer,
      include_images: includeImages,
      include_domains: includeDomains.length > 0 ? includeDomains : undefined,
      exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Tavily API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const responseTime = Date.now() - startTime

  return {
    query: data.query || query,
    answer: data.answer,
    results: (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      score: r.score || 0,
      publishedDate: r.published_date
    })),
    responseTime
  }
}

/**
 * 搜索工具相关信息（GitHub stars、最近更新等）
 */
export async function searchToolInfo(
  toolName: string,
  apiKey: string
): Promise<{
  isActive: boolean
  lastUpdate?: string
  stars?: number
  description?: string
  url?: string
  alternatives?: string[]
}> {
  try {
    const response = await tavilySearch(
      `${toolName} github stars latest update 2024 2025`,
      apiKey,
      {
        maxResults: 5,
        searchDepth: 'advanced',
        includeAnswer: true,
        includeDomains: ['github.com', 'reddit.com', 'producthunt.com']
      }
    )

    // 解析结果
    let isActive = false
    let stars: number | undefined
    let lastUpdate: string | undefined
    let description: string | undefined
    let url: string | undefined

    // 从 answer 中提取信息
    if (response.answer) {
      // 检查是否活跃
      const recentYears = ['2024', '2025']
      isActive = recentYears.some(year => response.answer!.includes(year))
      
      // 尝试提取 stars
      const starsMatch = response.answer.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:k|K)?\s*stars?/i)
      if (starsMatch) {
        let num = parseFloat(starsMatch[1].replace(',', ''))
        if (starsMatch[0].toLowerCase().includes('k')) num *= 1000
        stars = Math.round(num)
      }
    }

    // 从结果中提取更多信息
    for (const result of response.results) {
      if (result.url.includes('github.com') && !url) {
        url = result.url
        description = result.content.substring(0, 200)
      }
      
      // 检查最近更新
      if (result.publishedDate) {
        const date = new Date(result.publishedDate)
        if (!lastUpdate || date > new Date(lastUpdate)) {
          lastUpdate = result.publishedDate
        }
      }
    }

    return {
      isActive,
      lastUpdate,
      stars,
      description,
      url
    }
  } catch (error) {
    console.error('Search tool info failed:', error)
    return { isActive: false }
  }
}

/**
 * 搜索最新的开发工具和资源
 */
export async function searchLatestTools(
  category: string,
  apiKey: string
): Promise<TavilySearchResponse> {
  const queries: Record<string, string> = {
    'ai-tools': 'best new AI developer tools 2025 open source',
    'productivity': 'best productivity tools for developers 2025',
    'terminal': 'best terminal tools CLI 2025 github',
    'devops': 'best DevOps tools 2025 kubernetes docker',
    'frontend': 'best frontend development tools 2025 react vue',
    'backend': 'best backend frameworks 2025 nodejs python',
    'database': 'best database tools 2025 postgresql mongodb',
    'security': 'best security tools for developers 2025',
    'default': 'best developer tools 2025 trending github'
  }

  const query = queries[category] || queries['default']

  return tavilySearch(query, apiKey, {
    maxResults: 10,
    searchDepth: 'advanced',
    includeAnswer: true,
    excludeDomains: ['pinterest.com', 'facebook.com']
  })
}

/**
 * 验证 Tavily API Key 是否有效
 */
export async function validateTavilyApiKey(apiKey: string): Promise<boolean> {
  try {
    await tavilySearch('test', apiKey, { maxResults: 1 })
    return true
  } catch {
    return false
  }
}
