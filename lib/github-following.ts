// GitHub 用户关注管理
// 关注列表持久化到 Supabase（github_following 表）
// GitHub API 派生数据（用户详情/Stars/Repos/Events）走 localStorage 缓存（10 分钟过期）

import { supabase } from './supabase';
import { getGithubToken } from './user-credentials';

// 缓存配置
const CACHE_DURATION = 10 * 60 * 1000; // 10 分钟
const USER_CACHE_PREFIX = 'github_user_';
const STARS_CACHE_PREFIX = 'github_stars_';
const REPOS_CACHE_PREFIX = 'github_repos_';
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

export interface FollowingRow {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at: string;
}

interface CacheItem<T> { data: T; timestamp: number; }

// 当前 GitHub Token
let currentGithubToken: string | null = null;

export function setGithubToken(token: string | null) {
  currentGithubToken = token;
}

export { getGithubToken };

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

// =========================================================
// 关注列表 — Supabase 持久化
// =========================================================

// 获取关注列表（含基础展示信息）
export async function getFollowingRows(userId: string): Promise<FollowingRow[]> {
  const { data, error } = await supabase
    .from('github_following')
    .select('username, display_name, avatar_url, bio, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('加载关注列表失败:', error);
    throw error;
  }
  return data || [];
}

// 仅获取用户名列表（兼容旧调用）
export async function getFollowingUsers(userId: string): Promise<string[]> {
  const rows = await getFollowingRows(userId);
  return rows.map(r => r.username);
}

// 添加关注用户（带基础信息缓存到表内，节省后续请求）
export async function addFollowingUser(
  userId: string,
  user: { login: string; name?: string; avatar_url?: string; bio?: string }
): Promise<void> {
  const { error } = await supabase
    .from('github_following')
    .upsert({
      user_id: userId,
      username: user.login,
      display_name: user.name || null,
      avatar_url: user.avatar_url || null,
      bio: user.bio || null
    }, { onConflict: 'user_id,username' });

  if (error) {
    console.error('添加关注失败:', error);
    throw error;
  }
}

// 移除关注用户
export async function removeFollowingUser(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('github_following')
    .delete()
    .eq('user_id', userId)
    .eq('username', username);

  if (error) {
    console.error('取消关注失败:', error);
    throw error;
  }

  // 清除该用户的派生数据缓存
  try {
    localStorage.removeItem(USER_CACHE_PREFIX + username);
    Object.keys(localStorage).forEach(k => {
      if (
        k.startsWith(STARS_CACHE_PREFIX + username) ||
        k.startsWith(REPOS_CACHE_PREFIX + username) ||
        k.startsWith(EVENTS_CACHE_PREFIX + username)
      ) {
        localStorage.removeItem(k);
      }
    });
  } catch {}
}

// 批量添加（用于 seed 推荐名单）
export async function bulkAddFollowingUsers(
  userId: string,
  usernames: string[]
): Promise<{ added: string[]; skipped: string[]; failed: { username: string; reason: string }[] }> {
  const added: string[] = [];
  const skipped: string[] = [];
  const failed: { username: string; reason: string }[] = [];

  // 先拉一遍已有,避免重复网络请求
  const existing = new Set((await getFollowingUsers(userId)).map(u => u.toLowerCase()));

  for (const raw of usernames) {
    const username = raw.trim();
    if (!username) continue;
    if (existing.has(username.toLowerCase())) {
      skipped.push(username);
      continue;
    }
    try {
      const user = await fetchGitHubUser(username);
      if (!user) {
        failed.push({ username, reason: '用户不存在' });
        continue;
      }
      await addFollowingUser(userId, {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio
      });
      added.push(username);
    } catch (e: any) {
      failed.push({ username, reason: e?.message || '未知错误' });
    }
  }

  return { added, skipped, failed };
}

// =========================================================
// GitHub API 派生数据 — localStorage 缓存
// =========================================================

// 获取 GitHub 用户信息
export async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
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

// 获取用户自己的仓库（按更新时间倒序，分页）
export async function fetchUserRepos(
  username: string,
  page: number = 1,
  perPage: number = 30
): Promise<{ repos: GitHubRepo[]; hasMore: boolean }> {
  const cacheKey = `${REPOS_CACHE_PREFIX}${username}_${page}_${perPage}`;
  const cached = getCache<{ repos: GitHubRepo[]; hasMore: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&page=${page}&per_page=${perPage}`,
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
    console.error('获取仓库列表失败:', e);
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

// 推荐关注名单（一键填充用）
export const RECOMMENDED_USERS: Array<{ username: string; reason: string; tag: string }> = [
  { username: 'sindresorhus', reason: '小工具天花板，开源 OG', tag: 'tools' },
  { username: 'simonw', reason: 'AI + CLI 创意雷达，LLM 工具狂魔', tag: 'ai' },
  { username: 'antfu', reason: 'Vue/Vite 工具链 + DX 神器', tag: 'frontend' },
  { username: 'addyosmani', reason: 'Google，前端性能 + 学习资源', tag: 'learning' },
  { username: 'kamranahmedse', reason: 'roadmap.sh，学习路径', tag: 'learning' },
  { username: 'sw-yx', reason: 'AI Engineer 概念提出者，趋势 + 创意', tag: 'ai' },
  { username: 'steven-tey', reason: 'Dub.co/Novel，SaaS 级开源应用', tag: 'product' },
  { username: 'sharkdp', reason: 'bat/fd/hyperfine，Rust CLI 党', tag: 'tools' },
  { username: 'ruanyf', reason: '阮一峰，中文周刊源头', tag: 'chinese' },
  { username: 'transitive-bullshit', reason: 'AI 副业项目灵感库', tag: 'ai' },
  { username: 'rasbt', reason: 'Sebastian Raschka，LLM/ML 教科书', tag: 'ai' },
  { username: 'jph00', reason: 'fast.ai，PyTorch 训练实战', tag: 'ai' },
  { username: 'donnemartin', reason: 'system-design-primer 作者', tag: 'learning' },
  { username: 'yangshun', reason: 'Tech Interview Handbook', tag: 'learning' },
  { username: 'gaearon', reason: 'Dan Abramov，深度技术随笔', tag: 'frontend' },
  { username: 'shadcn', reason: 'shadcn/ui，UI 设计系统', tag: 'frontend' },
  { username: 'pacocoursey', reason: 'cmdk/next-themes，交互细节', tag: 'frontend' },
  { username: 'junegunn', reason: 'fzf 作者，终端效率审美', tag: 'tools' },
  { username: 'kentcdodds', reason: '教学型博客，React/测试', tag: 'learning' },
  { username: 'mitchellh', reason: 'HashiCorp/Ghostty，生产力工具', tag: 'tools' }
];
