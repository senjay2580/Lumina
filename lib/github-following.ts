// GitHub 用户关注管理
// 本地缓存，不落地数据库

import { getGithubToken } from './user-credentials';

// 缓存配置
const CACHE_DURATION = 10 * 60 * 1000; // 10 分钟
const FOLLOWING_CACHE_KEY = 'github_following_users';
const USER_CACHE_PREFIX = 'github_user_';
const STARS_CACHE_PREFIX = 'github_stars_';
const EVENTS_CACHE_PREFIX = 'github_events_';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name?: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description?: string;
  stargazers_count: number;
  forks_count: number;
  language?: string;
  topics?: string[];
  owner: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string; url: string };
  payload: any;
}

interface CacheItem<T> { data: T; timestamp: number; }

// 当前 GitHub Token
let currentGithubToken: string | null = null;

export function setGithubToken(token: string | null) {
  currentGithubToken = token;
}

// 获取 GitHub API 请求头
function getGithubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (currentGithubToken) {
    headers['Authorization'] = `Bearer ${currentGithubToken}`;
  }
  return headers;
}

// 缓存辅助函数
function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const cached: CacheItem<T> = JSON.parse(item);
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (e) {
    console.warn('缓存写入失败:', e);
  }
}

// 获取关注的用户列表
export function getFollowingUsers(): string[] {
  try {
    const data = localStorage.getItem(FOLLOWING_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 添加关注用户
export function addFollowingUser(username: string): void {
  const users = getFollowingUsers();
  if (!users.includes(username)) {
    users.push(username);
    localStorage.setItem(FOLLOWING_CACHE_KEY, JSON.stringify(users));
  }
}

// 移除关注用户
export function removeFollowingUser(username: string): void {
  const users = getFollowingUsers().filter(u => u !== username);
  localStorage.setItem(FOLLOWING_CACHE_KEY, JSON.stringify(users));
  // 清除该用户的缓存
  localStorage.removeItem(USER_CACHE_PREFIX + username);
  localStorage.removeItem(STARS_CACHE_PREFIX + username);
  localStorage.removeItem(EVENTS_CACHE_PREFIX + username);
}

// 获取 GitHub 用户信息
export async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  // 检查缓存
  const cached = getCache<GitHubUser>(USER_CACHE_PREFIX + username);
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: getGithubHeaders()
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API 错误: ${response.status}`);
    }
    const user = await response.json();
    setCache(USER_CACHE_PREFIX + username, user);
    return user;
  } catch (e) {
    console.error('获取用户信息失败:', e);
    throw e;
  }
}

// 获取用户 Star 的仓库（分页）
export async function fetchUserStars(
  username: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ repos: GitHubRepo[]; hasMore: boolean }> {
  const cacheKey = `${STARS_CACHE_PREFIX}${username}_${page}_${perPage}`;
  const cached = getCache<{ repos: GitHubRepo[]; hasMore: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/starred?page=${page}&per_page=${perPage}`,
      { headers: getGithubHeaders() }
    );
    if (!response.ok) throw new Error(`GitHub API 错误: ${response.status}`);
    
    const repos: GitHubRepo[] = await response.json();
    const linkHeader = response.headers.get('Link');
    const hasMore = linkHeader?.includes('rel="next"') || repos.length === perPage;
    
    const result = { repos, hasMore };
    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('获取 Star 列表失败:', e);
    throw e;
  }
}

// 获取用户最近活动
export async function fetchUserEvents(
  username: string,
  page: number = 1,
  perPage: number = 30
): Promise<GitHubEvent[]> {
  const cacheKey = `${EVENTS_CACHE_PREFIX}${username}_${page}`;
  const cached = getCache<GitHubEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/events/public?page=${page}&per_page=${perPage}`,
      { headers: getGithubHeaders() }
    );
    if (!response.ok) throw new Error(`GitHub API 错误: ${response.status}`);
    
    const events: GitHubEvent[] = await response.json();
    setCache(cacheKey, events);
    return events;
  } catch (e) {
    console.error('获取用户活动失败:', e);
    throw e;
  }
}

// 解析事件类型为中文描述
export function getEventDescription(event: GitHubEvent): { action: string; icon: string; color: string } {
  const repoName = event.repo.name;
  switch (event.type) {
    case 'WatchEvent':
      return { action: `Star 了 ${repoName}`, icon: '⭐', color: 'text-yellow-600' };
    case 'CreateEvent':
      if (event.payload.ref_type === 'repository') {
        return { action: `创建了仓库 ${repoName}`, icon: '📦', color: 'text-green-600' };
      }
      return { action: `创建了 ${event.payload.ref_type} ${event.payload.ref || ''} 在 ${repoName}`, icon: '🌿', color: 'text-green-500' };
    case 'PushEvent':
      const commits = event.payload.commits?.length || 0;
      return { action: `推送了 ${commits} 个提交到 ${repoName}`, icon: '📝', color: 'text-blue-600' };
    case 'PullRequestEvent':
      return { action: `${event.payload.action} PR #${event.payload.number} 在 ${repoName}`, icon: '🔀', color: 'text-purple-600' };
    case 'IssuesEvent':
      return { action: `${event.payload.action} Issue #${event.payload.issue?.number} 在 ${repoName}`, icon: '🐛', color: 'text-red-500' };
    case 'ForkEvent':
      return { action: `Fork 了 ${repoName}`, icon: '🍴', color: 'text-gray-600' };
    case 'IssueCommentEvent':
      return { action: `评论了 ${repoName}`, icon: '💬', color: 'text-gray-500' };
    case 'DeleteEvent':
      return { action: `删除了 ${event.payload.ref_type} 在 ${repoName}`, icon: '🗑️', color: 'text-red-400' };
    case 'ReleaseEvent':
      return { action: `发布了 ${event.payload.release?.tag_name || ''} 在 ${repoName}`, icon: '🚀', color: 'text-orange-500' };
    default:
      return { action: `${event.type.replace('Event', '')} 在 ${repoName}`, icon: '📌', color: 'text-gray-500' };
  }
}

// 格式化相对时间
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 格式化数字
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}
