// 提示词爬虫管理库（本地执行版）
import { supabase } from './supabase';
import { getUserProviders } from './ai-providers';
import { decryptApiKey } from './ai-providers';
import { getGithubToken } from './user-credentials';

// 类型定义
export interface CrawledPrompt {
  id: string;
  prompt_title: string;
  prompt_content: string;
  suggested_category: string;
  quality_score: number;
  ai_analysis: any;
  language: string;
  source_type: 'reddit' | 'github' | 'unknown';
  source_url: string | null;
  source_author: string | null;
  source_name: string | null;
  source_stars: number | null;
  source_forks: number | null;
  created_at: string;
}

export interface CrawlJob {
  id: string;
  job_type: 'reddit' | 'github' | 'all';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  items_found: number;
  items_new: number;
  prompts_extracted: number;
  error_message: string | null;
  created_at: string;
}

export interface CrawlStats {
  totalPrompts: number;
  redditPrompts: number;
  githubPrompts: number;
}

export interface CrawlConfig {
  id?: string;
  user_id?: string;
  reddit_subreddits: string[];
  github_search_queries: string[];
  min_reddit_score: number;
  min_github_stars: number;
  ai_quality_threshold: number;
  ai_analysis_prompt: string; // AI 分析提示词
  created_at?: string;
  updated_at?: string;
}

export interface CrawlProgress {
  phase: 'crawling' | 'analyzing' | 'saving' | 'done' | 'cancelled';
  message: string;
  source?: 'reddit' | 'github'; // 当前进度来源
  itemsFound: number;
  promptsExtracted: number;
  current?: number; // 当前处理的索引
  total?: number;   // 总数
  // 分别统计
  reddit?: { found: number; extracted: number };
  github?: { found: number; extracted: number };
  // 新提取的提示词（实时推送）
  newPrompt?: CrawledPrompt;
}

// 默认 AI 分析提示词
export const DEFAULT_AI_ANALYSIS_PROMPT = `你是 AI 项目发现专家。分析内容，提取有价值的 AI 相关项目和资源。

提取范围（必须与 AI/LLM/机器学习相关）：
1. AI 工具/软件 - 如 AI 助手、ChatGPT 插件、ComfyUI 节点、自动化工具
2. AI 开源项目 - GitHub 上的热门 AI 项目、框架、库
3. AI 技术/框架 - 如 LangChain、RAG 实现、Agent 框架、模型微调
4. AI 资源合集 - awesome-xxx 类型的资源列表
5. AI 教程/指南 - 实用的学习资源和最佳实践
6. AI 应用案例 - 创新的 AI 应用和解决方案

输出 JSON：
{
  "prompts": [{ 
    "title": "项目名称（简洁明了）", 
    "content": "项目描述（100-300字，说明核心功能、技术栈、应用场景和价值）", 
    "category": "分类（tool/framework/resource/tutorial/application/agent）", 
    "quality": 8.5 
  }],
  "analysis": { "summary": "内容摘要", "language": "语言" }
}

评分标准：
- 10分：知名项目、Star 数高、活跃维护、广泛使用
- 7-9分：高质量项目、实用性强、有创新点
- 4-6分：一般项目，有一定参考价值
- 1-3分：低质量或过时项目

重要规则：
- 每个来源只返回 1 个最核心的项目（不要拆分成多个）
- 对于 GitHub 仓库，重点描述项目功能、技术特点和使用场景
- 只提取与 AI/LLM/机器学习直接相关的内容
- 如果内容与 AI 无关，返回空数组
- 优先提取有实际应用价值的项目`;

// 默认配置（空数组，用户自定义）
const DEFAULT_CONFIG: CrawlConfig = {
  reddit_subreddits: [],
  github_search_queries: [],
  min_reddit_score: 10,
  min_github_stars: 50,
  ai_quality_threshold: 6.0,
  ai_analysis_prompt: DEFAULT_AI_ANALYSIS_PROMPT
};

// 预设模板（系统默认）
export const SYSTEM_TEMPLATES: { id: string; name: string; description: string; config: Partial<CrawlConfig> }[] = [
  {
    id: 'ai-tools',
    name: 'AI 工具项目',
    description: 'AI 工具、助手、插件等实用项目',
    config: {
      reddit_subreddits: ['ChatGPT', 'ClaudeAI', 'OpenAI', 'LocalLLM', 'artificial'],
      github_search_queries: ['awesome-ai-tools', 'ai-tools', 'llm-tools', 'ai-assistant', 'chatgpt-plugins']
    }
  },
  {
    id: 'ai-coding',
    name: 'AI 编程项目',
    description: 'Cursor、Copilot 等 AI 编程相关项目',
    config: {
      reddit_subreddits: ['cursor', 'vibecoding', 'AIProgramming', 'CodingWithAI', 'github'],
      github_search_queries: ['cursor-rules', 'awesome-cursorrules', 'ai-coding', 'copilot-instructions', 'code-assistant']
    }
  },
  {
    id: 'ai-image',
    name: 'AI 图像项目',
    description: 'Stable Diffusion、ComfyUI、Midjourney 相关项目',
    config: {
      reddit_subreddits: ['StableDiffusion', 'comfyui', 'midjourney', 'AIArt', 'GenerativeAI'],
      github_search_queries: ['comfyui-nodes', 'comfyui-workflows', 'stable-diffusion', 'sd-webui', 'image-generation']
    }
  },
  {
    id: 'ai-agents',
    name: 'AI Agent 项目',
    description: 'AI Agent、自动化、工作流项目',
    config: {
      reddit_subreddits: ['n8n_ai_agents', 'AutoGPT', 'LangChain', 'AIAgents', 'automation'],
      github_search_queries: ['ai-agent', 'autonomous-agent', 'langchain', 'autogpt', 'crew-ai', 'agent-framework']
    }
  },
  {
    id: 'ai-opensource',
    name: 'AI 开源项目',
    description: '热门 AI 开源项目和框架',
    config: {
      reddit_subreddits: ['MachineLearning', 'deeplearning', 'LocalLLM', 'ollama', 'selfhosted'],
      github_search_queries: ['awesome-llm', 'awesome-chatgpt', 'open-source-llm', 'llm-framework', 'machine-learning']
    }
  },
  {
    id: 'full',
    name: '全量采集',
    description: '包含所有推荐的关键词（数量较多）',
    config: {
      reddit_subreddits: [
        'ChatGPT', 'ClaudeAI', 'OpenAI', 'LocalLLM', 'artificial',
        'cursor', 'vibecoding', 'AIProgramming', 'github',
        'StableDiffusion', 'comfyui', 'midjourney', 'AIArt', 'GenerativeAI',
        'n8n_ai_agents', 'AutoGPT', 'LangChain', 'MachineLearning', 'deeplearning'
      ],
      github_search_queries: [
        'awesome-ai-tools', 'ai-tools', 'llm-tools', 'ai-assistant',
        'cursor-rules', 'awesome-cursorrules', 'ai-coding', 'copilot-instructions',
        'comfyui-nodes', 'comfyui-workflows', 'stable-diffusion',
        'ai-agent', 'autonomous-agent', 'langchain', 'autogpt',
        'awesome-llm', 'awesome-chatgpt', 'open-source-llm'
      ]
    }
  }
];

// 用户自定义模板类型
export interface UserTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  reddit_subreddits: string[];
  github_search_queries: string[];
  created_at: string;
  updated_at: string;
}

// 获取用户自定义模板
export async function getUserTemplates(userId: string): Promise<UserTemplate[]> {
  const { data, error } = await supabase
    .from('crawl_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// 创建用户模板
export async function createUserTemplate(
  userId: string, 
  template: { name: string; description?: string; reddit_subreddits: string[]; github_search_queries: string[] }
): Promise<UserTemplate> {
  const { data, error } = await supabase
    .from('crawl_templates')
    .insert({
      user_id: userId,
      name: template.name,
      description: template.description || '',
      reddit_subreddits: template.reddit_subreddits,
      github_search_queries: template.github_search_queries
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// 更新用户模板
export async function updateUserTemplate(
  templateId: string,
  template: { name?: string; description?: string; reddit_subreddits?: string[]; github_search_queries?: string[] }
): Promise<void> {
  const { error } = await supabase
    .from('crawl_templates')
    .update({
      ...template,
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId);
  
  if (error) throw error;
}

// 删除用户模板
export async function deleteUserTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('crawl_templates')
    .delete()
    .eq('id', templateId);
  
  if (error) throw error;
}

// 兼容旧的 CONFIG_TEMPLATES 导出
export const CONFIG_TEMPLATES = SYSTEM_TEMPLATES;

const SELECTED_MODEL_KEY = 'crawl_selected_model'; // 格式: providerId:modelId

// ============ 配置管理 (Supabase 数据库) ============

export async function getCrawlConfig(userId: string): Promise<CrawlConfig> {
  try {
    const { data, error } = await supabase
      .from('crawl_configs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    
    if (data) {
      return {
        id: data.id,
        user_id: data.user_id,
        reddit_subreddits: data.reddit_subreddits || [],
        github_search_queries: data.github_search_queries || [],
        min_reddit_score: data.min_reddit_score ?? 10,
        min_github_stars: data.min_github_stars ?? 50,
        ai_quality_threshold: data.ai_quality_threshold ?? 6.0,
        ai_analysis_prompt: data.ai_analysis_prompt || DEFAULT_AI_ANALYSIS_PROMPT,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }
    
    // 如果没有配置，创建默认配置
    const newConfig = { ...DEFAULT_CONFIG, user_id: userId };
    const { data: created, error: createError } = await supabase
      .from('crawl_configs')
      .insert(newConfig)
      .select()
      .single();
    
    if (createError) throw createError;
    return created as CrawlConfig;
  } catch (e) {
    console.error('Failed to load crawl config:', e);
    return { ...DEFAULT_CONFIG };
  }
}

export async function updateCrawlConfig(userId: string, key: keyof CrawlConfig, value: any): Promise<void> {
  const { error } = await supabase
    .from('crawl_configs')
    .update({ [key]: value, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  
  if (error) throw error;
}

export async function saveCrawlConfig(userId: string, config: Partial<CrawlConfig>): Promise<void> {
  const { error } = await supabase
    .from('crawl_configs')
    .upsert({
      user_id: userId,
      reddit_subreddits: config.reddit_subreddits,
      github_search_queries: config.github_search_queries,
      min_reddit_score: config.min_reddit_score,
      min_github_stars: config.min_github_stars,
      ai_quality_threshold: config.ai_quality_threshold,
      ai_analysis_prompt: config.ai_analysis_prompt,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  
  if (error) throw error;
}

export async function resetCrawlConfig(userId: string): Promise<void> {
  await saveCrawlConfig(userId, DEFAULT_CONFIG);
}

// 导出配置为 JSON
export function exportConfigToJson(config: CrawlConfig): string {
  const exportData = {
    reddit_subreddits: config.reddit_subreddits,
    github_search_queries: config.github_search_queries,
    min_reddit_score: config.min_reddit_score,
    min_github_stars: config.min_github_stars,
    ai_quality_threshold: config.ai_quality_threshold,
    ai_analysis_prompt: config.ai_analysis_prompt
  };
  return JSON.stringify(exportData, null, 2);
}

// 从 JSON 导入配置
export function parseConfigFromJson(jsonStr: string): Partial<CrawlConfig> | null {
  try {
    const data = JSON.parse(jsonStr);
    const config: Partial<CrawlConfig> = {};
    
    if (Array.isArray(data.reddit_subreddits)) {
      config.reddit_subreddits = data.reddit_subreddits.filter((s: any) => typeof s === 'string');
    }
    if (Array.isArray(data.github_search_queries)) {
      config.github_search_queries = data.github_search_queries.filter((s: any) => typeof s === 'string');
    }
    if (typeof data.min_reddit_score === 'number') {
      config.min_reddit_score = data.min_reddit_score;
    }
    if (typeof data.min_github_stars === 'number') {
      config.min_github_stars = data.min_github_stars;
    }
    if (typeof data.ai_quality_threshold === 'number') {
      config.ai_quality_threshold = data.ai_quality_threshold;
    }
    if (typeof data.ai_analysis_prompt === 'string') {
      config.ai_analysis_prompt = data.ai_analysis_prompt;
    }
    
    return config;
  } catch (e) {
    console.error('Failed to parse config JSON:', e);
    return null;
  }
}

// 获取用户选择的模型 (providerId:modelId)
export function getSelectedModel(): { providerId: string; modelId: string } | null {
  const stored = localStorage.getItem(SELECTED_MODEL_KEY);
  if (!stored) return null;
  const [providerId, modelId] = stored.split(':');
  if (!providerId || !modelId) return null;
  return { providerId, modelId };
}

// 保存用户选择的模型
export function setSelectedModel(providerId: string, modelId: string): void {
  localStorage.setItem(SELECTED_MODEL_KEY, `${providerId}:${modelId}`);
}

// ============ 爬取任务记录 ============

export async function getCrawlJobs(userId: string, limit = 10): Promise<CrawlJob[]> {
  const { data, error } = await supabase
    .from('crawl_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function clearCrawlJobs(userId: string): Promise<void> {
  const { error } = await supabase
    .from('crawl_jobs')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

// ============ 提示词管理 ============

export async function getCrawledPrompts(userId: string, limit = 1000): Promise<CrawledPrompt[]> {
  const { data, error } = await supabase
    .from('extracted_prompts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function deletePrompts(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .delete()
    .in('id', ids);
  
  if (error) throw error;
}

export async function clearAllPrompts(userId: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_prompts')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

// ============ 统计 ============

export async function getCrawlStats(userId: string): Promise<CrawlStats> {
  const [
    { count: totalPrompts },
    { count: redditPrompts },
    { count: githubPrompts }
  ] = await Promise.all([
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('source_type', 'reddit'),
    supabase.from('extracted_prompts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('source_type', 'github')
  ]);
  
  return {
    totalPrompts: totalPrompts || 0,
    redditPrompts: redditPrompts || 0,
    githubPrompts: githubPrompts || 0
  };
}

// ============ 本地爬取逻辑 ============

// 计算内容哈希（用于去重）
async function computeContentHash(content: string): Promise<string> {
  // 标准化：小写、去除多余空白、保留中文
  const normalized = content
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // SHA-256 哈希
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 爬取单个 Reddit 子版块
async function crawlSingleSubreddit(subreddit: string, minScore: number): Promise<any[]> {
  const results: any[] = [];
  
  const corsProxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
  
  try {
    console.log(`[Reddit] Fetching r/${subreddit}...`);
    
    const targetUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50&raw_json=1`;
    let data = null;
    
    for (const proxyFn of corsProxies) {
      try {
        const response = await fetch(proxyFn(targetUrl), {
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch {
        // 继续尝试下一个代理
      }
    }
    
    if (!data) {
      console.log(`[Reddit] r/${subreddit} failed: all proxies failed`);
      return results;
    }
    
    const children = data?.data?.children || [];
    
    for (const child of children) {
      const post = child.data;
      if (post.stickied || post.score < minScore) continue;
      if (!post.title) continue;
      
      const content = post.selftext || '';
      if (content.length < 50) continue;
      
      results.push({
        id: post.id,
        title: post.title,
        content: content,
        url: `https://reddit.com${post.permalink}`,
        author: post.author,
        subreddit: post.subreddit
      });
    }
    
    console.log(`[Reddit] r/${subreddit}: ${results.length} posts`);
  } catch (e) {
    console.error(`[Reddit] Error crawling r/${subreddit}:`, e);
  }
  
  return results;
}

// 爬取 Reddit（并发版本）
async function crawlReddit(subreddits: string[], minScore: number): Promise<any[]> {
  // 分批并发，每批 5 个，避免代理限流
  const batchSize = 5;
  const allResults: any[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < subreddits.length; i += batchSize) {
    const batch = subreddits.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(sub => crawlSingleSubreddit(sub, minScore))
    );
    
    // 合并并去重
    for (const results of batchResults) {
      for (const post of results) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          allResults.push(post);
        }
      }
    }
    
    // 批次间短暂延迟
    if (i + batchSize < subreddits.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`[Reddit] Total: ${allResults.length} unique posts`);
  return allResults;
}

// 爬取单个 GitHub 搜索词
async function crawlSingleGitHubQuery(query: string, minStars: number, token?: string): Promise<any[]> {
  const results: any[] = [];
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) headers['Authorization'] = `token ${token}`;
  
  try {
    console.log(`[GitHub] Searching "${query}"...`);
    
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=15`,
      { headers }
    );
    
    if (!response.ok) {
      console.log(`[GitHub] Search failed: ${response.status}`);
      return results;
    }
    
    const data = await response.json();
    const repos = data?.items || [];
    
    // 并发获取所有 README
    const repoPromises = repos
      .filter((repo: any) => repo.stargazers_count >= minStars)
      .map(async (repo: any) => {
        let readme = '';
        try {
          const readmeRes = await fetch(
            `https://api.github.com/repos/${repo.full_name}/readme`,
            { headers }
          );
          if (readmeRes.ok) {
            const readmeData = await readmeRes.json();
            readme = atob(readmeData.content || '').substring(0, 3000);
          }
        } catch {}
        
        return {
          id: repo.full_name,
          title: repo.name,
          content: `${repo.description || ''}\n\n${readme}`,
          url: repo.html_url,
          author: repo.owner.login,
          repoName: repo.full_name,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          pushedAt: repo.pushed_at
        };
      });
    
    const repoResults = await Promise.all(repoPromises);
    results.push(...repoResults);
    
    console.log(`[GitHub] "${query}": ${results.length} repos`);
  } catch (e) {
    console.error(`[GitHub] Error searching "${query}":`, e);
  }
  
  return results;
}

// 爬取 GitHub（并发版本）
async function crawlGitHub(queries: string[], minStars: number, token?: string): Promise<any[]> {
  // 分批并发，每批 3 个（GitHub API 限流更严格）
  const batchSize = 3;
  const allResults: any[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(q => crawlSingleGitHubQuery(q, minStars, token))
    );
    
    // 合并并去重
    for (const results of batchResults) {
      for (const repo of results) {
        if (!seenIds.has(repo.id)) {
          seenIds.add(repo.id);
          allResults.push(repo);
        }
      }
    }
    
    // 批次间延迟（GitHub API 限流）
    if (i + batchSize < queries.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`[GitHub] Total: ${allResults.length} unique repos`);
  return allResults;
}

// AI 分析提取项目
async function analyzeWithAI(
  content: string,
  sourceType: string,
  title: string,
  aiProvider: any,
  customPrompt?: string
): Promise<{ prompts: Array<{ title: string; content: string; category: string; quality: number }>; analysis: any } | null> {
  // 内容太短，跳过分析
  if (content.trim().length < 50) {
    console.log(`[AI] Skipping "${title.substring(0, 30)}..." - content too short (${content.length} chars)`);
    return null;
  }

  const systemPrompt = customPrompt || DEFAULT_AI_ANALYSIS_PROMPT;

  try {
    // 使用用户配置的 baseUrl，和 ai-prompt-assistant 保持一致
    const baseUrl = aiProvider.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;
    const model = aiProvider.defaultModel || aiProvider.models?.[0]?.id || 'gpt-4o-mini';
    const apiKey = decryptApiKey(aiProvider.apiKey);
    
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `来源: ${sourceType}\n标题: ${title}\n\n${content.substring(0, 3000)}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    };
    
    console.log(`[AI] Analyzing "${title.substring(0, 30)}..." with ${aiProvider.providerKey}, model: ${model}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] API error ${response.status}:`, errorText);
      return null;
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    console.log(`[AI] Found ${result.prompts?.length || 0} prompts in "${title}"`);
    return result;
  } catch (e) {
    console.error('[AI] Analysis error:', e);
    return null;
  }
}

// ============ 主爬取函数 ============

export async function triggerCrawl(
  jobType: 'reddit' | 'github' | 'all',
  userId: string,
  onProgress?: (progress: CrawlProgress) => void,
  abortSignal?: AbortSignal,
  selectedModel?: { providerId: string; modelId: string } // 指定使用的模型
): Promise<{ jobId: string; stats: any }> {
  const config = await getCrawlConfig(userId);
  
  // 获取 AI 提供商
  const providers = await getUserProviders(userId);
  
  // 优先使用指定的模型，其次使用 localStorage 保存的选择
  const modelSelection = selectedModel || getSelectedModel();
  let aiProvider = modelSelection 
    ? providers.find(p => p.id === modelSelection.providerId && p.isEnabled)
    : null;
  
  // 如果选择的提供商不可用，回退到默认
  if (!aiProvider) {
    aiProvider = providers.find(p => p.isDefault && p.isEnabled) || providers.find(p => p.isEnabled);
  }
  
  if (!aiProvider) {
    throw new Error('请先在配置页面选择 AI 模型');
  }
  
  // 使用选择的模型覆盖默认模型
  if (modelSelection?.modelId) {
    aiProvider = { ...aiProvider, defaultModel: modelSelection.modelId };
  }
  
  // 创建任务记录
  const { data: job, error: jobError } = await supabase
    .from('crawl_jobs')
    .insert({ 
      job_type: jobType, 
      status: 'running', 
      started_at: new Date().toISOString(),
      user_id: userId
    })
    .select()
    .single();
  
  if (jobError) throw jobError;
  const jobId = job.id;
  
  // 分别统计 - 使用独立对象避免并发问题
  const redditStats = { found: 0, extracted: 0, current: 0, total: 0 };
  const githubStats = { found: 0, extracted: 0, current: 0, total: 0 };
  let itemsNew = 0;
  
  // 更新进度 - 只更新当前任务类型的数据
  const updateProgress = (
    source: 'reddit' | 'github',
    phase: CrawlProgress['phase'], 
    message: string,
    newPrompt?: CrawledPrompt
  ) => {
    const stats = source === 'reddit' ? redditStats : githubStats;
    onProgress?.({
      phase,
      message,
      source, // 标记是哪个来源的进度
      itemsFound: stats.found,
      promptsExtracted: stats.extracted,
      current: stats.current,
      total: stats.total,
      reddit: { found: redditStats.found, extracted: redditStats.extracted },
      github: { found: githubStats.found, extracted: githubStats.extracted },
      newPrompt // 新提取的提示词
    });
  };
  
  // 立即保存单个提示词并返回保存结果
  const saveAndNotify = async (
    promptData: any,
    source: 'reddit' | 'github'
  ): Promise<CrawledPrompt | null> => {
    // 对于 GitHub，用 source_url 去重（同一仓库只保存一条）
    if (source === 'github' && promptData.source_url) {
      const { data: existingByUrl } = await supabase
        .from('extracted_prompts')
        .select('id')
        .eq('user_id', userId)
        .eq('source_url', promptData.source_url)
        .maybeSingle();
      
      if (existingByUrl) {
        console.log(`[Crawler] Skipping duplicate GitHub repo: ${promptData.source_url}`);
        return null;
      }
    }
    
    // 计算内容哈希
    const contentHash = await computeContentHash(promptData.prompt_content);
    
    // 检查当前用户是否已有相同哈希
    const { data: existing } = await supabase
      .from('extracted_prompts')
      .select('id')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .maybeSingle();
    
    if (existing) return null; // 已存在，跳过
    
    // 保存并返回完整数据（包含 user_id 和 content_hash）
    const { data, error } = await supabase
      .from('extracted_prompts')
      .insert({ 
        ...promptData, 
        user_id: userId,
        content_hash: contentHash 
      })
      .select()
      .single();
    
    if (error || !data) return null;
    
    itemsNew++;
    return data as CrawledPrompt;
  };
  
  try {
    // 定义爬取任务
    const crawlRedditTask = async () => {
      if (jobType !== 'all' && jobType !== 'reddit') return;
      if (abortSignal?.aborted) return;
      
      updateProgress('reddit', 'crawling', '正在爬取 Reddit...');
      const subs = config.reddit_subreddits;
      const posts = await crawlReddit(subs, config.min_reddit_score);
      if (abortSignal?.aborted) return;
      
      redditStats.found = posts.length;
      redditStats.total = posts.length;
      console.log(`[Crawler] Reddit crawl done, ${posts.length} posts to analyze`);
      // 爬取完成后立即更新进度，显示发现数量
      updateProgress('reddit', 'crawling', `Reddit 爬取完成，发现 ${posts.length} 条内容`);
      updateProgress('reddit', 'analyzing', `分析 ${posts.length} 条 Reddit 内容...`);
      
      for (let i = 0; i < posts.length; i++) {
        if (abortSignal?.aborted) {
          console.log('[Crawler] Reddit task cancelled');
          return;
        }
        
        const post = posts[i];
        redditStats.current = i + 1;
        console.log(`[Crawler] Analyzing Reddit post ${i + 1}/${posts.length}: "${post.title.substring(0, 30)}..."`);
        
        try {
          const analysis = await analyzeWithAI(
            `${post.title}\n\n${post.content}`,
            'reddit',
            post.title,
            aiProvider,
            config.ai_analysis_prompt
          );
          
          if (analysis?.prompts?.length) {
            for (const p of analysis.prompts) {
              if (p.quality >= config.ai_quality_threshold) {
                // 立即保存并推送
                const promptData = {
                  prompt_title: p.title,
                  prompt_content: p.content,
                  suggested_category: p.category,
                  quality_score: p.quality,
                  ai_analysis: analysis.analysis,
                  language: analysis.analysis?.language || 'en',
                  source_type: 'reddit',
                  source_url: post.url,
                  source_author: post.author,
                  source_name: `r/${post.subreddit}`
                };
                
                const saved = await saveAndNotify(promptData, 'reddit');
                if (saved) {
                  redditStats.extracted++;
                  // 推送新提示词到 UI
                  updateProgress('reddit', 'analyzing', `Reddit: ${i + 1}/${posts.length} 已分析，提取 ${redditStats.extracted} 个`, saved);
                }
              }
            }
          }
          // 即使没有提取到也更新进度
          updateProgress('reddit', 'analyzing', `Reddit: ${i + 1}/${posts.length} 已分析，提取 ${redditStats.extracted} 个`);
        } catch (err) {
          console.error(`[Crawler] Error analyzing post:`, err);
        }
      }
      console.log(`[Crawler] Reddit analysis done, extracted ${redditStats.extracted} prompts`);
    };
    
    const crawlGitHubTask = async () => {
      if (jobType !== 'all' && jobType !== 'github') return;
      if (abortSignal?.aborted) return;
      
      updateProgress('github', 'crawling', '正在爬取 GitHub...');
      const queries = config.github_search_queries;
      
      // 获取用户配置的 GitHub Token
      const githubToken = await getGithubToken(userId);
      if (githubToken) {
        console.log('[Crawler] Using user GitHub token for higher rate limits');
      }
      
      const repos = await crawlGitHub(queries, config.min_github_stars, githubToken || undefined);
      if (abortSignal?.aborted) return;
      
      githubStats.found = repos.length;
      githubStats.total = repos.length;
      console.log(`[Crawler] GitHub crawl done, ${repos.length} repos to analyze`);
      // 爬取完成后立即更新进度，显示发现数量
      updateProgress('github', 'crawling', `GitHub 爬取完成，发现 ${repos.length} 个仓库`);
      updateProgress('github', 'analyzing', `分析 ${repos.length} 个 GitHub 仓库...`);
      
      for (let i = 0; i < repos.length; i++) {
        if (abortSignal?.aborted) {
          console.log('[Crawler] GitHub task cancelled');
          return;
        }
        
        const repo = repos[i];
        githubStats.current = i + 1;
        console.log(`[Crawler] Analyzing GitHub repo ${i + 1}/${repos.length}: "${repo.title}"`);
        
        try {
          const analysis = await analyzeWithAI(
            repo.content,
            'github',
            repo.title,
            aiProvider,
            config.ai_analysis_prompt
          );
          
          if (analysis?.prompts?.length) {
            for (const p of analysis.prompts) {
              if (p.quality >= config.ai_quality_threshold) {
                // 立即保存并推送
                const promptData = {
                  prompt_title: p.title,
                  prompt_content: p.content,
                  suggested_category: p.category,
                  quality_score: p.quality,
                  ai_analysis: analysis.analysis,
                  language: analysis.analysis?.language || 'en',
                  source_type: 'github',
                  source_url: repo.url,
                  source_author: repo.author,
                  source_name: repo.repoName,
                  source_stars: repo.stars,
                  source_forks: repo.forks
                };
                
                const saved = await saveAndNotify(promptData, 'github');
                if (saved) {
                  githubStats.extracted++;
                  // 推送新提示词到 UI
                  updateProgress('github', 'analyzing', `GitHub: ${i + 1}/${repos.length} 已分析，提取 ${githubStats.extracted} 个`, saved);
                }
              }
            }
          }
          // 即使没有提取到也更新进度
          updateProgress('github', 'analyzing', `GitHub: ${i + 1}/${repos.length} 已分析，提取 ${githubStats.extracted} 个`);
        } catch (err) {
          console.error(`[Crawler] Error analyzing repo:`, err);
        }
      }
      console.log(`[Crawler] GitHub analysis done, extracted ${githubStats.extracted} prompts`);
    };
    
    // 并发执行（全部采集时）或单独执行
    if (jobType === 'all') {
      await Promise.all([crawlRedditTask(), crawlGitHubTask()]);
    } else if (jobType === 'reddit') {
      await crawlRedditTask();
    } else {
      await crawlGitHubTask();
    }
    
    // 检查是否被中断
    if (abortSignal?.aborted) {
      console.log('[Crawler] Task was cancelled');
      await supabase.from('crawl_jobs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: '用户取消'
      }).eq('id', jobId);
      return { jobId, stats: { itemsFound: 0, itemsNew: 0, promptsExtracted: 0 } };
    }
    
    // 提示词已经在分析过程中实时保存了，这里只需要更新任务状态
    const totalFound = redditStats.found + githubStats.found;
    const totalExtracted = redditStats.extracted + githubStats.extracted;
    
    // 更新任务状态
    await supabase.from('crawl_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      items_found: totalFound,
      items_new: itemsNew,
      prompts_extracted: totalExtracted
    }).eq('id', jobId);
    
    onProgress?.({
      phase: 'done',
      message: '采集完成！',
      itemsFound: totalFound,
      promptsExtracted: totalExtracted,
      reddit: { found: redditStats.found, extracted: redditStats.extracted },
      github: { found: githubStats.found, extracted: githubStats.extracted }
    });
    
    return { jobId, stats: { itemsFound: totalFound, itemsNew, promptsExtracted: totalExtracted } };
    
  } catch (error: any) {
    await supabase.from('crawl_jobs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error.message
    }).eq('id', jobId);
    
    throw error;
  }
}
