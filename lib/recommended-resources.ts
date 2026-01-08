// 推荐资源 - 实时从 GitHubDaily 仓库获取
// https://github.com/GitHubDaily/GitHubDaily

export interface RecommendedResource {
  title: string;
  url: string;
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
  topics?: string[];
  avatar?: string;
  category?: string;
  year?: string;
  owner?: string;
  repo?: string;
  detailsLoaded?: boolean; // 是否已加载详情
}

// 缓存
let cachedResources: RecommendedResource[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 分钟缓存

// 详情缓存（持久化）
const detailsCache = new Map<string, Partial<RecommendedResource>>();

// 从 GitHub 获取仓库文件列表
async function getRepoFiles(): Promise<string[]> {
  const response = await fetch(
    'https://api.github.com/repos/GitHubDaily/GitHubDaily/contents',
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (!response.ok) throw new Error('Failed to fetch repo contents');
  const files = await response.json();
  return files
    .filter((f: any) => /^\d{4}\.md$/.test(f.name))
    .map((f: any) => f.name)
    .sort()
    .reverse();
}

// 获取 MD 文件内容
async function getMdContent(fileName: string): Promise<string> {
  const response = await fetch(
    `https://raw.githubusercontent.com/GitHubDaily/GitHubDaily/master/${fileName}`
  );
  if (!response.ok) throw new Error(`Failed to fetch ${fileName}`);
  return response.text();
}

// 解析 MD 内容
function parseMdContent(content: string, year: string): RecommendedResource[] {
  const resources: RecommendedResource[] = [];
  const seen = new Set<string>();
  const linkRegex = /\[([^\]]+)\]\((https:\/\/github\.com\/([^\/\s]+)\/([^\/\s\)#]+))/g;
  
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const title = match[1].trim().replace(/\*\*/g, '');
    const owner = match[3];
    const repo = match[4].replace(/[)#\s]*$/, '');
    const url = `https://github.com/${owner}/${repo}`;
    const key = `${owner}/${repo}`.toLowerCase();
    
    if (seen.has(key) || key === 'githubdaily/githubdaily') continue;
    seen.add(key);
    
    // 检查缓存
    const cached = detailsCache.get(key);
    if (cached) {
      resources.push({ ...cached, title: cached.title || title, url, owner, repo, year, detailsLoaded: true } as RecommendedResource);
    } else {
      resources.push({ title, url, owner, repo, year, category: '其他', detailsLoaded: false });
    }
  }
  return resources;
}


// 获取单个仓库详情（带缓存）
async function fetchSingleRepoDetail(resource: RecommendedResource): Promise<RecommendedResource> {
  const key = `${resource.owner}/${resource.repo}`.toLowerCase();
  
  // 检查缓存
  const cached = detailsCache.get(key);
  if (cached) {
    return { ...resource, ...cached, detailsLoaded: true };
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${resource.owner}/${resource.repo}`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );
    
    if (!response.ok) {
      return { ...resource, detailsLoaded: true };
    }
    
    const data = await response.json();
    const details: Partial<RecommendedResource> = {
      title: data.name || resource.title,
      description: data.description || undefined,
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language || undefined,
      topics: data.topics || [],
      avatar: data.owner?.avatar_url,
      category: guessCategory(data.name, data.description || '', data.topics || [], data.language)
    };
    
    // 缓存详情
    detailsCache.set(key, details);
    
    return { ...resource, ...details, detailsLoaded: true };
  } catch {
    return { ...resource, detailsLoaded: true };
  }
}

// 批量获取详情（渐进式，不阻塞）
export async function fetchDetailsForResources(
  resources: RecommendedResource[],
  onUpdate: (updated: RecommendedResource[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const needDetails = resources.filter(r => !r.detailsLoaded);
  if (needDetails.length === 0) return;
  
  const BATCH_SIZE = 5; // 每批 5 个
  const BATCH_DELAY = 200; // 批次间隔 200ms
  
  for (let i = 0; i < needDetails.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    
    const batch = needDetails.slice(i, i + BATCH_SIZE);
    
    // 并行获取这批的详情
    const results = await Promise.all(
      batch.map(r => fetchSingleRepoDetail(r))
    );
    
    // 更新资源列表
    const updatedResources = resources.map(r => {
      const updated = results.find(u => u.url === r.url);
      return updated || r;
    });
    
    // 回调更新 UI
    onUpdate(updatedResources);
    resources = updatedResources;
    
    // 延迟避免 API 限制
    if (i + BATCH_SIZE < needDetails.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
}

// 根据信息猜测分类
function guessCategory(name: string, description: string, topics: string[], language?: string): string {
  const text = `${name} ${description} ${topics.join(' ')}`.toLowerCase();
  if (/\b(ai|llm|gpt|machine.?learning|deep.?learning|neural|transformer|diffusion|ollama|langchain|agent|openai|chatgpt)\b/i.test(text)) return 'AI';
  if (/\b(react|vue|angular|svelte|next|nuxt|frontend|css|tailwind|ui|component)\b/i.test(text)) return '前端';
  if (/\b(node|deno|express|nest|backend|api|server|database|sql|redis|postgres|mysql)\b/i.test(text)) return '后端';
  if (/\b(docker|k8s|kubernetes|devops|ci|cd|deploy|cloud|aws|azure)\b/i.test(text)) return 'DevOps';
  if (/\b(tool|editor|ide|terminal|cli|productivity)\b/i.test(text)) return '效率工具';
  if (/\b(security|encrypt|auth|hack)\b/i.test(text)) return '安全';
  if (/\b(game|unity|unreal)\b/i.test(text)) return '游戏';
  if (/\b(mobile|ios|android|flutter|swift|kotlin)\b/i.test(text)) return '移动开发';
  if (/\b(data|analytics|visualization|chart|pandas)\b/i.test(text)) return '数据';
  if (language === 'Python') return 'Python';
  if (language === 'Rust') return 'Rust';
  if (language === 'Go') return 'Go';
  return '其他';
}

export function formatStars(stars?: number): string {
  if (!stars) return '';
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return stars.toString();
}


// 获取基础资源列表（快速，不获取详情）
export async function fetchRecommendedResources(forceRefresh = false): Promise<RecommendedResource[]> {
  if (!forceRefresh && cachedResources && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedResources;
  }
  
  try {
    const files = await getRepoFiles();
    const contents = await Promise.all(
      files.map(async (fileName) => {
        const content = await getMdContent(fileName);
        const year = fileName.replace('.md', '');
        return parseMdContent(content, year);
      })
    );
    
    let allResources = contents.flat();
    
    // 去重（保留最新年份的）
    const seen = new Map<string, RecommendedResource>();
    for (const r of allResources) {
      const key = `${r.owner}/${r.repo}`.toLowerCase();
      const existing = seen.get(key);
      if (!existing || (r.year && existing.year && r.year > existing.year)) {
        seen.set(key, r);
      }
    }
    allResources = Array.from(seen.values());
    
    cachedResources = allResources;
    cacheTime = Date.now();
    return allResources;
  } catch (error) {
    console.error('Failed to fetch recommended resources:', error);
    if (cachedResources) return cachedResources;
    throw error;
  }
}

// 按年份分组
export function groupByYear(resources: RecommendedResource[]): Record<string, RecommendedResource[]> {
  const grouped: Record<string, RecommendedResource[]> = {};
  for (const resource of resources) {
    const year = resource.year || '未知';
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(resource);
  }
  return grouped;
}

// 按分类分组
export function groupByCategory(resources: RecommendedResource[]): Record<string, RecommendedResource[]> {
  const grouped: Record<string, RecommendedResource[]> = {};
  for (const resource of resources) {
    const category = resource.category || '其他';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(resource);
  }
  return grouped;
}

// 2025 复盘项目接口 - 使用 RecommendedResource 类型以复用卡片和详情加载
// 缓存 README 内容
let cachedReadme: string | null = null;
let readmeCacheTime: number = 0;

// 获取 README 内容
async function getReadmeContent(): Promise<string> {
  if (cachedReadme && Date.now() - readmeCacheTime < CACHE_DURATION) {
    return cachedReadme;
  }
  
  const response = await fetch(
    'https://raw.githubusercontent.com/GitHubDaily/GitHubDaily/master/README.md'
  );
  if (!response.ok) throw new Error('Failed to fetch README');
  cachedReadme = await response.text();
  readmeCacheTime = Date.now();
  return cachedReadme;
}

// 精选项目分类信息
export interface FeaturedCategory {
  name: string;
  count: number;
}

// 解析 README 中的精选项目（2025 复盘部分）- 返回 RecommendedResource 类型
export async function fetchFeaturedProjects(): Promise<{ projects: RecommendedResource[]; categories: FeaturedCategory[] }> {
  try {
    const content = await getReadmeContent();
    const projects: RecommendedResource[] = [];
    const categoryMap = new Map<string, number>();
    
    // 找到 2025 年复盘部分
    const startMarker = '## 2025 年复盘';
    const endMarker = '## 声明';
    
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) return { projects: [], categories: [] };
    
    const endIndex = content.indexOf(endMarker, startIndex);
    const section = endIndex !== -1 
      ? content.slice(startIndex, endIndex) 
      : content.slice(startIndex);
    
    // 解析各个分类
    const categoryRegex = /### ([^\n]+)\n\n项目\|简述\n---\|---\n([\s\S]*?)(?=\n### |\n## |$)/g;
    
    let categoryMatch: RegExpExecArray | null;
    while ((categoryMatch = categoryRegex.exec(section)) !== null) {
      const category = categoryMatch[1].trim();
      const tableContent = categoryMatch[2];
      let categoryCount = 0;
      
      // 解析表格行
      // 格式: [项目名](https://github.com/owner/repo)|描述
      const rowRegex = /\[([^\]]+)\]\((https:\/\/github\.com\/([^\/\s]+)\/([^\/\s\)#]+)[^\)]*)\)\|([^\n]+)/g;
      
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const title = rowMatch[1].trim();
        const owner = rowMatch[3];
        const repo = rowMatch[4].replace(/[)#\s]*$/, '');
        const url = `https://github.com/${owner}/${repo}`;
        const description = rowMatch[5].trim();
        
        if (title && description && !title.toLowerCase().includes('githubdaily')) {
          // 检查缓存
          const key = `${owner}/${repo}`.toLowerCase();
          const cached = detailsCache.get(key);
          
          if (cached) {
            projects.push({
              ...cached,
              title: cached.title || title,
              url,
              owner,
              repo,
              description: cached.description || description,
              category,
              year: '精选',
              detailsLoaded: true
            } as RecommendedResource);
          } else {
            projects.push({
              title,
              url,
              owner,
              repo,
              description,
              category,
              year: '精选',
              detailsLoaded: false
            });
          }
          categoryCount++;
        }
      }
      
      if (categoryCount > 0) {
        categoryMap.set(category, categoryCount);
      }
    }
    
    // 转换为分类数组
    const categories: FeaturedCategory[] = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
    
    return { projects, categories };
  } catch (error) {
    console.error('Failed to fetch featured projects:', error);
    return { projects: [], categories: [] };
  }
}
