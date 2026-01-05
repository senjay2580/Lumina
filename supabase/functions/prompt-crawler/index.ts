// Prompt Crawler Edge Function
// 自动从 Reddit 和 GitHub 抓取 AI 提示词相关内容

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 类型定义
interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  score: number;
  subreddit: string;
  author: string;
  created_utc: number;
  permalink: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  topics: string[];
  owner: { login: string };
  readme_content?: string;
}

interface CrawlConfig {
  reddit_subreddits: string[];
  github_search_queries: string[];
  min_reddit_score: number;
  min_github_stars: number;
  ai_quality_threshold: number;
}

// 获取配置
async function getConfig(supabase: any): Promise<CrawlConfig> {
  const { data } = await supabase
    .from('crawl_config')
    .select('config_key, config_value')
  
  const config: any = {}
  for (const item of data || []) {
    try {
      config[item.config_key] = JSON.parse(item.config_value)
    } catch {
      config[item.config_key] = item.config_value
    }
  }
  
  return {
    reddit_subreddits: config.reddit_subreddits || ['ChatGPT', 'PromptEngineering'],
    github_search_queries: config.github_search_queries || ['prompt engineering'],
    min_reddit_score: parseInt(config.min_reddit_score) || 10,
    min_github_stars: parseInt(config.min_github_stars) || 50,
    ai_quality_threshold: parseFloat(config.ai_quality_threshold) || 6.0,
  }
}

// Reddit OAuth 获取 access token
async function getRedditAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get('REDDIT_CLIENT_ID')
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    console.log('Reddit credentials not configured')
    return null
  }
  
  const auth = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PromptCrawler/1.0'
    },
    body: 'grant_type=client_credentials'
  })
  
  if (!response.ok) return null
  
  const data = await response.json()
  return data.access_token
}


// 抓取 Reddit 帖子
async function crawlReddit(
  subreddits: string[], 
  minScore: number,
  accessToken: string
): Promise<RedditPost[]> {
  const posts: RedditPost[] = []
  
  for (const subreddit of subreddits) {
    try {
      // 搜索包含 prompt 关键词的帖子
      const searchUrl = `https://oauth.reddit.com/r/${subreddit}/search?q=prompt&sort=hot&limit=25&restrict_sr=on&t=week`
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'PromptCrawler/1.0'
        }
      })
      
      if (!response.ok) {
        console.log(`Failed to fetch r/${subreddit}: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      const children = data?.data?.children || []
      
      for (const child of children) {
        const post = child.data
        if (post.score >= minScore && (post.selftext || post.title)) {
          posts.push({
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            url: `https://reddit.com${post.permalink}`,
            score: post.score,
            subreddit: post.subreddit,
            author: post.author,
            created_utc: post.created_utc,
            permalink: post.permalink
          })
        }
      }
      
      // 避免速率限制
      await new Promise(r => setTimeout(r, 1000))
    } catch (error) {
      console.error(`Error crawling r/${subreddit}:`, error)
    }
  }
  
  return posts
}

// 抓取 GitHub 仓库
async function crawlGitHub(
  queries: string[], 
  minStars: number
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  const githubToken = Deno.env.get('GITHUB_TOKEN')
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'PromptCrawler/1.0'
  }
  
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`
  }
  
  for (const query of queries) {
    try {
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=20`
      
      const response = await fetch(searchUrl, { headers })
      
      if (!response.ok) {
        console.log(`GitHub search failed for "${query}": ${response.status}`)
        continue
      }
      
      const data = await response.json()
      const items = data?.items || []
      
      for (const repo of items) {
        if (repo.stargazers_count >= minStars) {
          // 尝试获取 README
          let readmeContent = ''
          try {
            const readmeUrl = `https://api.github.com/repos/${repo.full_name}/readme`
            const readmeRes = await fetch(readmeUrl, { headers })
            if (readmeRes.ok) {
              const readmeData = await readmeRes.json()
              readmeContent = atob(readmeData.content || '')
            }
          } catch {
            // README 获取失败，继续
          }
          
          repos.push({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description || '',
            html_url: repo.html_url,
            stargazers_count: repo.stargazers_count,
            topics: repo.topics || [],
            owner: { login: repo.owner.login },
            readme_content: readmeContent.substring(0, 5000) // 限制长度
          })
        }
      }
      
      // 避免速率限制
      await new Promise(r => setTimeout(r, 2000))
    } catch (error) {
      console.error(`Error searching GitHub for "${query}":`, error)
    }
  }
  
  return repos
}


// 使用 AI 分析内容并提取提示词
async function analyzeWithAI(
  content: string,
  sourceType: string,
  title: string
): Promise<{ prompts: Array<{ title: string; content: string; category: string; quality: number }>; analysis: any } | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  
  if (!openaiKey) {
    console.log('OpenAI API key not configured, skipping AI analysis')
    return null
  }
  
  const systemPrompt = `你是一个 AI 提示词专家。分析给定的内容，提取其中有价值的 AI 提示词。

任务：
1. 识别内容中的高质量 AI 提示词（用于 ChatGPT、Claude 等）
2. 为每个提示词评分（1-10分）
3. 建议分类

输出 JSON 格式：
{
  "prompts": [
    {
      "title": "提示词标题",
      "content": "完整的提示词内容",
      "category": "分类（如：写作、编程、分析、创意、翻译、角色扮演等）",
      "quality": 8.5
    }
  ],
  "analysis": {
    "summary": "内容摘要",
    "relevance": "与提示词的相关度 1-10",
    "language": "内容语言"
  }
}

评分标准：
- 10分：专业级、结构完整、可直接使用
- 7-9分：高质量、有明确目标
- 4-6分：一般质量、需要改进
- 1-3分：低质量、不推荐

如果内容中没有有价值的提示词，返回空数组。`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `来源类型: ${sourceType}\n标题: ${title}\n\n内容:\n${content.substring(0, 4000)}` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })
    
    if (!response.ok) {
      console.error('OpenAI API error:', response.status)
      return null
    }
    
    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)
    return result
  } catch (error) {
    console.error('AI analysis error:', error)
    return null
  }
}

// 保存抓取结果到数据库
async function saveResults(
  supabase: any,
  redditPosts: RedditPost[],
  githubRepos: GitHubRepo[],
  config: CrawlConfig,
  jobId: string
) {
  let itemsNew = 0
  let promptsExtracted = 0
  
  // 保存 Reddit 帖子
  for (const post of redditPosts) {
    // 检查是否已存在
    const { data: existing } = await supabase
      .from('prompt_sources')
      .select('id')
      .eq('source_type', 'reddit')
      .eq('source_id', post.id)
      .single()
    
    if (existing) continue
    
    // 插入新记录
    const { data: source, error } = await supabase
      .from('prompt_sources')
      .insert({
        source_type: 'reddit',
        source_id: post.id,
        source_url: post.url,
        title: post.title,
        content: post.selftext,
        author: post.author,
        score: post.score,
        raw_data: post
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error saving Reddit post:', error)
      continue
    }
    
    itemsNew++
    
    // AI 分析
    const content = `${post.title}\n\n${post.selftext}`
    const analysis = await analyzeWithAI(content, 'reddit', post.title)
    
    if (analysis?.prompts?.length) {
      for (const prompt of analysis.prompts) {
        if (prompt.quality >= config.ai_quality_threshold) {
          await supabase.from('extracted_prompts').insert({
            source_id: source.id,
            prompt_title: prompt.title,
            prompt_content: prompt.content,
            suggested_category: prompt.category,
            quality_score: prompt.quality,
            ai_analysis: analysis.analysis,
            language: analysis.analysis?.language || 'en'
          })
          promptsExtracted++
        }
      }
    }
  }
  
  // 保存 GitHub 仓库
  for (const repo of githubRepos) {
    const { data: existing } = await supabase
      .from('prompt_sources')
      .select('id')
      .eq('source_type', 'github')
      .eq('source_id', repo.full_name)
      .single()
    
    if (existing) continue
    
    const { data: source, error } = await supabase
      .from('prompt_sources')
      .insert({
        source_type: 'github',
        source_id: repo.full_name,
        source_url: repo.html_url,
        title: repo.name,
        content: repo.readme_content || repo.description,
        author: repo.owner.login,
        score: repo.stargazers_count,
        raw_data: repo
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error saving GitHub repo:', error)
      continue
    }
    
    itemsNew++
    
    // AI 分析
    const content = `${repo.name}\n${repo.description}\n\n${repo.readme_content || ''}`
    const analysis = await analyzeWithAI(content, 'github', repo.name)
    
    if (analysis?.prompts?.length) {
      for (const prompt of analysis.prompts) {
        if (prompt.quality >= config.ai_quality_threshold) {
          await supabase.from('extracted_prompts').insert({
            source_id: source.id,
            prompt_title: prompt.title,
            prompt_content: prompt.content,
            suggested_category: prompt.category,
            quality_score: prompt.quality,
            ai_analysis: analysis.analysis,
            language: analysis.analysis?.language || 'en'
          })
          promptsExtracted++
        }
      }
    }
  }
  
  // 更新任务状态
  await supabase
    .from('crawl_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      items_found: redditPosts.length + githubRepos.length,
      items_new: itemsNew,
      prompts_extracted: promptsExtracted
    })
    .eq('id', jobId)
  
  return { itemsNew, promptsExtracted }
}


// 主函数
serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // 解析请求参数
    const { jobType = 'all' } = await req.json().catch(() => ({}))
    
    // 创建任务记录
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert({
        job_type: jobType,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (jobError) throw jobError
    
    // 获取配置
    const config = await getConfig(supabase)
    
    let redditPosts: RedditPost[] = []
    let githubRepos: GitHubRepo[] = []
    
    // 抓取 Reddit
    if (jobType === 'all' || jobType === 'reddit') {
      const accessToken = await getRedditAccessToken()
      if (accessToken) {
        console.log('Crawling Reddit...')
        redditPosts = await crawlReddit(
          config.reddit_subreddits,
          config.min_reddit_score,
          accessToken
        )
        console.log(`Found ${redditPosts.length} Reddit posts`)
      }
    }
    
    // 抓取 GitHub
    if (jobType === 'all' || jobType === 'github') {
      console.log('Crawling GitHub...')
      githubRepos = await crawlGitHub(
        config.github_search_queries,
        config.min_github_stars
      )
      console.log(`Found ${githubRepos.length} GitHub repos`)
    }
    
    // 保存结果
    const { itemsNew, promptsExtracted } = await saveResults(
      supabase,
      redditPosts,
      githubRepos,
      config,
      job.id
    )
    
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        stats: {
          redditPosts: redditPosts.length,
          githubRepos: githubRepos.length,
          itemsNew,
          promptsExtracted
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Crawler error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
