// RSS 订阅管理
// 支持订阅 RSS 源，自动同步文章到资源中心
// 支持 WeWe-RSS 微信公众号订阅

import { supabase } from './supabase'
import { getUserCredential } from './user-credentials'
import { createFolder, getSubFolders } from './resource-folders'

// RSS 缓存（5分钟）
const rssCache = new Map<string, { data: any, expireAt: number }>()
const CACHE_DURATION = 5 * 60 * 1000  // 5分钟

export interface RSSSubscription {
  id: string
  user_id: string
  feed_url: string
  title: string
  description?: string
  site_url?: string
  icon_url?: string
  last_fetched_at?: string
  last_item_date?: string
  is_active: boolean
  fetch_interval: number // 分钟
  source_type?: 'rss' | 'wechat' // 来源类型
  mp_id?: string // 微信公众号 ID
  auto_sync?: boolean // 是否自动同步到资源中心
  created_at: string
  updated_at: string
}

export interface RSSItem {
  guid: string  // 不再需要 id，因为不持久化
  title: string
  link: string
  description?: string
  content?: string
  author?: string
  pubDate?: string  // 改为驼峰命名，与 parseFeed 返回值一致
  // 移除 is_read, is_synced, synced_resource_id 等持久化字段
}

// WeWe-RSS 公众号信息
export interface WechatMpInfo {
  id: string
  mpName: string
  mpIntro?: string
  mpCover?: string
  status: number
  syncTime?: string
  updateTime?: string
}



// 解析 RSS/Atom Feed
export async function parseFeed(feedUrl: string): Promise<{
  title: string
  description?: string
  siteUrl?: string
  iconUrl?: string
  items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }>
}> {
  // 检查缓存
  const cached = rssCache.get(feedUrl)
  if (cached && Date.now() < cached.expireAt) {
    console.log('使用缓存的 RSS 数据')
    return cached.data
  }
  
  // 优先使用自己的代理（绕过 CORS）
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseKey) {
      console.log('使用 Supabase 代理获取 RSS')
      const proxyUrl = `${supabaseUrl}/functions/v1/fetch-rss`
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ feedUrl })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.xml) {
          const feedInfo = parseRssXml(data.xml, 'Unknown Feed')
          console.log('代理解析成功，文章数:', feedInfo.items.length)
          // 缓存结果
          rssCache.set(feedUrl, {
            data: feedInfo,
            expireAt: Date.now() + CACHE_DURATION
          })
          return feedInfo
        }
      }
    }
  } catch (err) {
    console.warn('Supabase 代理获取失败:', err)
  }
  
  // 尝试直接获取 RSS XML（可能因 CORS 失败）
  try {
    console.log('尝试直接获取 RSS XML:', feedUrl)
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (response.ok) {
      const xmlText = await response.text()
      console.log('RSS XML 长度:', xmlText.length)
      // 检查是否是 XML 格式
      if (xmlText.trim().startsWith('<?xml') || xmlText.includes('<rss') || xmlText.includes('<feed')) {
        const feedInfo = parseRssXml(xmlText, 'Unknown Feed')
        console.log('直接解析成功，文章数:', feedInfo.items.length)
        // 缓存结果
        rssCache.set(feedUrl, {
          data: feedInfo,
          expireAt: Date.now() + CACHE_DURATION
        })
        return feedInfo
      }
    }
  } catch (err) {
    console.warn('直接获取 RSS XML 失败，尝试使用代理:', err)
  }
  
  // 回退到 RSS2JSON API（限制10篇）
  console.log('使用 RSS2JSON 代理')
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
  
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error('无法获取 RSS 源')
  }
  
  const data = await response.json()
  
  if (data.status !== 'ok') {
    throw new Error(data.message || '解析 RSS 失败')
  }
  
  const feedInfo = {
    title: data.feed?.title || 'Unknown Feed',
    description: data.feed?.description,
    siteUrl: data.feed?.link,
    iconUrl: data.feed?.image,
    items: (data.items || []).map((item: any) => ({
      guid: item.guid || item.link,
      title: item.title,
      link: item.link,
      description: item.description,
      content: item.content,
      author: item.author,
      pubDate: item.pubDate
    }))
  }
  
  // 缓存结果
  rssCache.set(feedUrl, {
    data: feedInfo,
    expireAt: Date.now() + CACHE_DURATION
  })
  
  return feedInfo
}

// 获取用户的所有订阅
export async function getUserSubscriptions(userId: string): Promise<RSSSubscription[]> {
  const { data, error } = await supabase
    .from('rss_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

// 添加订阅
export async function addSubscription(
  userId: string,
  feedUrl: string,
  autoSync: boolean = true
): Promise<RSSSubscription> {
  // 先解析 feed 获取信息
  const feedInfo = await parseFeed(feedUrl)
  
  const { data, error } = await supabase
    .from('rss_subscriptions')
    .insert({
      user_id: userId,
      feed_url: feedUrl,
      title: feedInfo.title,
      description: feedInfo.description,
      site_url: feedInfo.siteUrl,
      icon_url: feedInfo.iconUrl,
      is_active: true,
      fetch_interval: 60 // 默认 60 分钟
    })
    .select()
    .single()
  
  if (error) throw error
  
  // 不再保存初始文章到 rss_items 表，直接返回
  
  return data
}

// 保存 RSS 条目
// 删除订阅
export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('rss_subscriptions')
    .delete()
    .eq('id', subscriptionId)
  
  if (error) throw error
}

// 更新订阅
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Pick<RSSSubscription, 'title' | 'is_active' | 'fetch_interval'>>
): Promise<void> {
  const { error } = await supabase
    .from('rss_subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
  
  if (error) throw error
}

// 刷新订阅（拉取最新文章，返回内存中的文章列表）
export async function refreshSubscription(subscriptionId: string): Promise<RSSItem[]> {
  // 获取订阅信息
  const { data: subscription, error: subError } = await supabase
    .from('rss_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
  
  if (subError || !subscription) throw new Error('订阅不存在')
  
  // 对于微信公众号订阅，先触发 WeWe-RSS 刷新
  if (subscription.source_type === 'wechat' && subscription.mp_id) {
    try {
      const feedUrl = new URL(subscription.feed_url)
      const baseUrl = `${feedUrl.protocol}//${feedUrl.host}`
      const authCode = await getUserCredential(subscription.user_id, 'wewe-rss', 'auth_code')
      
      if (authCode) {
        console.log('触发 WeWe-RSS 刷新文章...')
        try {
          const refreshResponse = await fetch(`${baseUrl}/trpc/feed.refreshArticles`, {
            method: 'POST',
            headers: {
              'Authorization': authCode,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mpId: subscription.mp_id })
          })
          if (refreshResponse.ok) {
            console.log('WeWe-RSS 刷新成功')
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (refreshErr) {
          console.warn('调用 WeWe-RSS 刷新 API 失败:', refreshErr)
        }
      }
    } catch (err) {
      console.warn('WeWe-RSS 刷新失败:', err)
    }
  }
  
  // 统一使用 parseFeed 解析（已包含 Supabase 代理逻辑）
  const feedInfo = await parseFeed(subscription.feed_url)
  
  // 更新最后获取时间
  await supabase
    .from('rss_subscriptions')
    .update({
      last_fetched_at: new Date().toISOString(),
      last_item_date: feedInfo.items[0]?.pubDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionId)
  
  // 直接返回文章列表（内存中），不持久化到 rss_items 表
  return feedInfo.items
}

// 解析 RSS/Atom XML 文本
function parseRssXml(xmlText: string, defaultTitle: string): {
  title: string
  description?: string
  siteUrl?: string
  iconUrl?: string
  items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }>
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  
  // 检查解析错误
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    console.error('RSS XML 解析错误:', parseError.textContent)
    throw new Error('RSS XML 解析失败')
  }
  
  // 判断是 RSS 还是 Atom 格式
  const isAtom = doc.querySelector('feed') !== null
  
  if (isAtom) {
    return parseAtomXml(doc, defaultTitle)
  }
  
  // RSS 格式解析
  const channel = doc.querySelector('channel')
  const title = channel?.querySelector('title')?.textContent || defaultTitle
  const description = channel?.querySelector('description')?.textContent || undefined
  const siteUrl = channel?.querySelector('link')?.textContent || undefined
  
  // 获取文章列表
  const itemElements = doc.querySelectorAll('item')
  const items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }> = []
  
  itemElements.forEach((item) => {
    const itemTitle = item.querySelector('title')?.textContent || ''
    const itemLink = item.querySelector('link')?.textContent || ''
    const itemGuid = item.querySelector('guid')?.textContent || itemLink
    const itemDescription = item.querySelector('description')?.textContent || undefined
    // content:encoded 或 content
    const itemContent = item.querySelector('content\\:encoded')?.textContent || 
                        item.querySelector('encoded')?.textContent ||
                        item.querySelector('content')?.textContent || undefined
    const itemAuthor = item.querySelector('author')?.textContent || 
                       item.querySelector('dc\\:creator')?.textContent || undefined
    const itemPubDate = item.querySelector('pubDate')?.textContent || undefined
    
    if (itemTitle && itemLink) {
      items.push({
        guid: itemGuid,
        title: itemTitle,
        link: itemLink,
        description: itemDescription,
        content: itemContent,
        author: itemAuthor,
        pubDate: itemPubDate
      })
    }
  })
  
  return {
    title,
    description,
    siteUrl,
    items
  }
}

// 解析 Atom 格式
function parseAtomXml(doc: Document, defaultTitle: string): {
  title: string
  description?: string
  siteUrl?: string
  iconUrl?: string
  items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }>
} {
  const feed = doc.querySelector('feed')
  const title = feed?.querySelector('title')?.textContent || defaultTitle
  const description = feed?.querySelector('subtitle')?.textContent || undefined
  const siteLink = feed?.querySelector('link[rel="alternate"]') || feed?.querySelector('link')
  const siteUrl = siteLink?.getAttribute('href') || undefined
  
  const entryElements = doc.querySelectorAll('entry')
  const items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }> = []
  
  entryElements.forEach((entry) => {
    const itemTitle = entry.querySelector('title')?.textContent || ''
    const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link')
    const itemLink = linkEl?.getAttribute('href') || ''
    const itemGuid = entry.querySelector('id')?.textContent || itemLink
    const itemDescription = entry.querySelector('summary')?.textContent || undefined
    const itemContent = entry.querySelector('content')?.textContent || undefined
    const itemAuthor = entry.querySelector('author name')?.textContent || undefined
    const itemPubDate = entry.querySelector('published')?.textContent || 
                        entry.querySelector('updated')?.textContent || undefined
    
    if (itemTitle && itemLink) {
      items.push({
        guid: itemGuid,
        title: itemTitle,
        link: itemLink,
        description: itemDescription,
        content: itemContent,
        author: itemAuthor,
        pubDate: itemPubDate
      })
    }
  })
  
  return {
    title,
    description,
    siteUrl,
    items
  }
}

// 检测 URL 是否是微信公众号文章
export function isWechatArticle(url: string): boolean {
  return url.includes('mp.weixin.qq.com')
}

// 从微信公众号文章 URL 提取公众号信息
export function extractWechatInfo(url: string): { biz?: string } | null {
  try {
    const u = new URL(url)
    const biz = u.searchParams.get('__biz')
    if (biz) {
      return { biz }
    }
  } catch {}
  return null
}

// 生成 WeWe-RSS 订阅链接
export function generateWeweRssUrl(weweBaseUrl: string, mpId: string): string {
  return `${weweBaseUrl}/feeds/${mpId}.xml`
}

// ============ WeWe-RSS API 对接 ============

// 规范化 WeWe-RSS base URL（移除末尾斜杠和 /dash 路径）
function normalizeWeweBaseUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '') // 移除末尾斜杠
  // 如果用户输入了 /dash 路径，移除它
  if (normalized.endsWith('/dash')) {
    normalized = normalized.slice(0, -5)
  }
  return normalized
}

// 获取 WeWe-RSS 已订阅的公众号列表
// GET /feeds 返回公众号列表（数组格式）
export async function getWeweMpList(baseUrl: string, _authCode: string): Promise<WechatMpInfo[]> {
  const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
  const url = `${normalizedUrl}/feeds`
  const response = await fetch(url)
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || '获取公众号列表失败')
  }
  
  const data = await response.json()
  
  // 转换字段名
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: item.id,
      mpName: item.name,
      mpIntro: item.intro,
      mpCover: item.cover,
      status: 1,
      syncTime: item.syncTime ? new Date(item.syncTime * 1000).toISOString() : undefined,
      updateTime: item.updateTime ? new Date(item.updateTime * 1000).toISOString() : undefined
    }))
  }
  
  return []
}

// 通过微信文章链接添加公众号到 WeWe-RSS
// 使用 tRPC API: POST /trpc/platform.getMpInfo + POST /trpc/feed.add
export async function addWeweMp(baseUrl: string, authCode: string, articleUrl: string): Promise<WechatMpInfo> {
  const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
  
  // 1. 获取公众号信息
  const getMpInfoUrl = `${normalizedUrl}/trpc/platform.getMpInfo`
  const getMpInfoResponse = await fetch(getMpInfoUrl, {
    method: 'POST',
    headers: {
      'Authorization': authCode,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ wxsLink: articleUrl })
  })
  
  if (!getMpInfoResponse.ok) {
    const error = await getMpInfoResponse.json().catch(() => ({}))
    throw new Error(error?.error?.message || '获取公众号信息失败')
  }
  
  const getMpInfoResult = await getMpInfoResponse.json()
  if (getMpInfoResult.error) {
    throw new Error(getMpInfoResult.error.message || '获取公众号信息失败')
  }
  
  // tRPC 返回格式: { result: { data: [...] } }
  const mpInfoList = getMpInfoResult.result?.data
  if (!mpInfoList || mpInfoList.length === 0) {
    throw new Error('未找到公众号信息')
  }
  
  const mpInfo = mpInfoList[0]
  
  // 2. 添加公众号
  const addFeedUrl = `${normalizedUrl}/trpc/feed.add`
  const addFeedResponse = await fetch(addFeedUrl, {
    method: 'POST',
    headers: {
      'Authorization': authCode,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: mpInfo.id,
      mpName: mpInfo.name,
      mpCover: mpInfo.cover,
      mpIntro: mpInfo.intro,
      updateTime: mpInfo.updateTime,
      status: 1
    })
  })
  
  if (!addFeedResponse.ok) {
    const error = await addFeedResponse.json().catch(() => ({}))
    throw new Error(error?.error?.message || '添加公众号失败')
  }
  
  const addFeedResult = await addFeedResponse.json()
  if (addFeedResult.error) {
    throw new Error(addFeedResult.error.message || '添加公众号失败')
  }
  
  // 3. 刷新文章（可选）
  try {
    await fetch(`${normalizedUrl}/trpc/feed.refreshArticles`, {
      method: 'POST',
      headers: {
        'Authorization': authCode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mpId: mpInfo.id })
    })
  } catch {
    // 忽略刷新失败
  }
  
  return {
    id: mpInfo.id,
    mpName: mpInfo.name,
    mpIntro: mpInfo.intro,
    mpCover: mpInfo.cover,
    status: 1,
    updateTime: mpInfo.updateTime ? new Date(mpInfo.updateTime * 1000).toISOString() : undefined
  }
}

// 删除 WeWe-RSS 中的公众号
export async function deleteWeweMp(baseUrl: string, authCode: string, mpId: string): Promise<void> {
  const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
  const url = `${normalizedUrl}/feeds/${mpId}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authCode}`
    }
  })
  
  if (!response.ok) {
    throw new Error('删除公众号失败')
  }
}

// 测试 WeWe-RSS 连接（使用 tRPC API 验证 authCode）
export async function testWeweConnection(baseUrl: string, authCode: string): Promise<boolean> {
  try {
    const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
    // 先测试 /feeds 端点是否可访问
    const feedsResponse = await fetch(`${normalizedUrl}/feeds`)
    if (!feedsResponse.ok) return false
    
    // 如果有 authCode，测试 tRPC API（使用 GET 请求 query 方式）
    if (authCode) {
      // tRPC query 使用 GET 请求，input 通过 URL 参数传递
      const trpcResponse = await fetch(`${normalizedUrl}/trpc/feed.list?input=${encodeURIComponent(JSON.stringify({}))}`, {
        method: 'GET',
        headers: {
          'Authorization': authCode
        }
      })
      // 如果返回 404，可能是旧版本 API，尝试直接使用 /feeds 端点的结果
      if (trpcResponse.status === 404) {
        // 旧版本不支持 tRPC，但 /feeds 已经成功，认为连接正常
        return true
      }
      if (!trpcResponse.ok) return false
      const result = await trpcResponse.json()
      if (result.error) return false
    }
    
    return true
  } catch {
    return false
  }
}

// WeWe-RSS 账号信息
export interface WeweAccount {
  id: string
  name: string
  status: number // 1=正常, 0=禁用, -1=失效
  createdAt: string
  updatedAt: string
}

// WeWe-RSS 账号状态检测结果
export interface WeweAccountStatus {
  connected: boolean           // 服务是否可连接
  hasAccounts: boolean         // 是否有账号
  accounts: WeweAccount[]      // 账号列表
  invalidAccounts: WeweAccount[] // 失效的账号
  blockedAccounts: string[]    // 被封禁的账号 ID（今日小黑屋）
  allAccountsInvalid: boolean  // 是否所有账号都失效
  needRelogin: boolean         // 是否需要重新登录
  message: string              // 状态描述
}

// 检测 WeWe-RSS 账号状态（可靠的检测方式）
export async function checkWeweAccountStatus(baseUrl: string, authCode: string): Promise<WeweAccountStatus> {
  const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
  
  const result: WeweAccountStatus = {
    connected: false,
    hasAccounts: false,
    accounts: [],
    invalidAccounts: [],
    blockedAccounts: [],
    allAccountsInvalid: false,
    needRelogin: false,
    message: ''
  }
  
  try {
    // 1. 测试基本连接
    const feedsResponse = await fetch(`${normalizedUrl}/feeds`)
    if (!feedsResponse.ok) {
      result.message = 'WeWe-RSS 服务无法连接'
      return result
    }
    result.connected = true
    
    // 2. 如果没有 authCode，无法检测账号状态
    if (!authCode) {
      result.message = '未配置授权码，无法检测账号状态'
      return result
    }
    
    // 3. 获取账号列表
    const accountResponse = await fetch(
      `${normalizedUrl}/trpc/account.list?input=${encodeURIComponent(JSON.stringify({ limit: 100 }))}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authCode
        }
      }
    )
    
    if (!accountResponse.ok) {
      // 可能是旧版本不支持 account.list
      if (accountResponse.status === 404) {
        result.message = 'WeWe-RSS 版本过旧，无法检测账号状态'
        return result
      }
      result.message = '获取账号列表失败'
      return result
    }
    
    const accountData = await accountResponse.json()
    
    // tRPC 返回格式: { result: { data: { items: [...], blocks: [...] } } }
    const items = accountData.result?.data?.items || []
    const blocks = accountData.result?.data?.blocks || []
    
    result.accounts = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
    result.blockedAccounts = blocks
    result.hasAccounts = result.accounts.length > 0
    
    // 4. 分析账号状态
    // status: 1=正常, 0=禁用, -1=失效（根据 wewe-rss 源码 statusMap）
    result.invalidAccounts = result.accounts.filter(acc => acc.status === -1 || acc.status === 0)
    
    // 检查是否所有账号都失效或被封禁
    const validAccounts = result.accounts.filter(acc => 
      acc.status === 1 && !blocks.includes(acc.id)
    )
    
    if (!result.hasAccounts) {
      result.needRelogin = true
      result.allAccountsInvalid = true
      result.message = '没有微信读书账号，请添加账号'
    } else if (validAccounts.length === 0) {
      result.needRelogin = true
      result.allAccountsInvalid = true
      if (result.invalidAccounts.length > 0) {
        result.message = `所有账号已失效（${result.invalidAccounts.length}个），请重新登录`
      } else if (blocks.length > 0) {
        result.message = `所有账号被封禁（今日小黑屋），请等待24小时或添加新账号`
      } else {
        result.message = '所有账号不可用，请重新登录'
      }
    } else if (result.invalidAccounts.length > 0) {
      result.message = `${result.invalidAccounts.length}个账号已失效，${validAccounts.length}个账号正常`
    } else if (blocks.length > 0) {
      result.message = `${blocks.length}个账号被封禁（今日小黑屋），${validAccounts.length}个账号正常`
    } else {
      result.message = `${validAccounts.length}个账号正常`
    }
    
    return result
  } catch (err) {
    console.error('检测 WeWe-RSS 账号状态失败:', err)
    result.message = '检测账号状态时发生错误'
    return result
  }
}

// 获取 WeWe-RSS 登录二维码 URL
export async function getWeweLoginQrCode(baseUrl: string, authCode: string): Promise<{ url: string; id: string } | null> {
  try {
    const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
    const response = await fetch(`${normalizedUrl}/trpc/platform.createLoginUrl`, {
      method: 'POST',
      headers: {
        'Authorization': authCode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
    
    if (!response.ok) {
      console.error('获取二维码失败:', response.status, await response.text())
      return null
    }
    
    const data = await response.json()
    console.log('createLoginUrl response:', data)
    
    // tRPC 返回格式: { result: { data: { uuid: string, scanUrl: string } } }
    const result = data.result?.data
    if (result?.scanUrl && result?.uuid) {
      return { url: result.scanUrl, id: result.uuid }
    }
    return null
  } catch (err) {
    console.error('获取二维码异常:', err)
    return null
  }
}

// 检查登录结果
export async function checkWeweLoginResult(baseUrl: string, authCode: string, loginId: string): Promise<{
  success: boolean
  account?: { id: string; name: string; token: string }
} | null> {
  try {
    const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
    const response = await fetch(
      `${normalizedUrl}/trpc/platform.getLoginResult?input=${encodeURIComponent(JSON.stringify({ id: loginId }))}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authCode
        }
      }
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    console.log('getLoginResult response:', data)
    
    // tRPC 返回格式: { result: { data: { message, vid?, token?, username? } } }
    const result = data.result?.data
    if (result) {
      // 如果有 vid 和 token，说明登录成功
      if (result.vid && result.token) {
        return {
          success: true,
          account: { 
            id: String(result.vid), 
            name: result.username || String(result.vid),
            token: result.token
          }
        }
      }
      // 还在等待扫码
      return { success: false }
    }
    return null
  } catch (err) {
    console.error('检查登录结果异常:', err)
    return null
  }
}

// 添加账号到 WeWe-RSS
export async function addWeweAccount(
  baseUrl: string, 
  authCode: string, 
  account: { id: string; name: string; token: string }
): Promise<boolean> {
  try {
    const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
    const response = await fetch(`${normalizedUrl}/trpc/account.add`, {
      method: 'POST',
      headers: {
        'Authorization': authCode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: account.id,
        name: account.name,
        token: account.token,
        status: 1 // 启用状态
      })
    })
    
    if (!response.ok) {
      console.error('添加账号失败:', response.status, await response.text())
      return false
    }
    
    const data = await response.json()
    console.log('addAccount response:', data)
    return !data.error
  } catch (err) {
    console.error('添加账号异常:', err)
    return false
  }
}

// 从 WeWe-RSS 同步公众号到本地订阅
export async function syncWeweToSubscriptions(
  userId: string,
  baseUrl: string,
  authCode: string
): Promise<{ added: number; updated: number }> {
  const normalizedUrl = normalizeWeweBaseUrl(baseUrl)
  const mpList = await getWeweMpList(normalizedUrl, authCode)
  let added = 0
  let updated = 0
  
  for (const mp of mpList) {
    const feedUrl = generateWeweRssUrl(normalizedUrl, mp.id)
    
    // 检查是否已存在 - 使用 maybeSingle() 避免 406 错误
    const { data: existing } = await supabase
      .from('rss_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('mp_id', mp.id)
      .maybeSingle()
    
    if (existing) {
      // 更新
      await supabase
        .from('rss_subscriptions')
        .update({
          title: mp.mpName,
          description: mp.mpIntro,
          icon_url: mp.mpCover,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      updated++
    } else {
      // 新增
      const { error } = await supabase
        .from('rss_subscriptions')
        .insert({
          user_id: userId,
          feed_url: feedUrl,
          title: mp.mpName,
          description: mp.mpIntro,
          icon_url: mp.mpCover,
          source_type: 'wechat',
          mp_id: mp.id,
          is_active: true,
          fetch_interval: 60
        })
      if (!error) added++
    }
  }
  
  return { added, updated }
}


// ============ 同步到资源中心 ============

// 切换订阅的自动同步状态
export async function toggleAutoSync(subscriptionId: string, autoSync: boolean): Promise<void> {
  const { error } = await supabase
    .from('rss_subscriptions')
    .update({ auto_sync: autoSync, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
  
  if (error) throw error
}

// 查找或创建 RSS 订阅对应的文件夹
async function findOrCreateSubscriptionFolder(
  userId: string,
  subscriptionTitle: string
): Promise<string | null> {
  try {
    // 查找名称匹配的文章文件夹
    const folders = await getSubFolders(null, userId);
    const existingFolder = folders.find(
      f => f.resource_type === 'article' && f.name === subscriptionTitle
    );
    
    if (existingFolder) {
      return existingFolder.id;
    }
    
    // 不存在则创建新文件夹
    const newFolder = await createFolder(
      userId,
      'article',
      subscriptionTitle,
      null,
      '#f97316' // 橙色，表示 RSS 订阅
    );
    
    return newFolder.id;
  } catch (err) {
    console.error('查找或创建订阅文件夹失败:', err);
    return null; // 失败则返回 null，文章进入根目录
  }
}

// 将单篇文章同步到资源中心（直接从内存中的文章数据）
// 返回: { resourceId: string | null, isNew: boolean }
export async function syncItemToResource(
  item: RSSItem,
  subscription: RSSSubscription
): Promise<{ resourceId: string | null; isNew: boolean }> {
  // 过滤30天前的文章（可能已被回收站清理）
  if (item.pubDate) {
    const pubDate = new Date(item.pubDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (pubDate < thirtyDaysAgo) {
      // 跳过过旧文章
      return { resourceId: null, isNew: false };
    }
  }
  
  // 检查 URL 是否已存在
  const { data: existingByUrl } = await supabase
    .from('resources')
    .select('id')
    .eq('user_id', subscription.user_id)
    .eq('url', item.link)
    .is('deleted_at', null)
    .maybeSingle()
  
  if (existingByUrl) {
    // URL 已存在，跳过
    return { resourceId: existingByUrl.id, isNew: false }
  }
  
  // 查找或创建订阅对应的文件夹
  const folderId = await findOrCreateSubscriptionFolder(
    subscription.user_id,
    subscription.title
  );
  
  // 创建新资源 - 使用文章发布时间作为 created_at
  const pubDate = item.pubDate ? new Date(item.pubDate) : null
  const createdAt = pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : new Date().toISOString()
  
  const { data: resource, error } = await supabase
    .from('resources')
    .insert({
      user_id: subscription.user_id,
      type: 'article',
      title: item.title,
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 500) || undefined,
      url: item.link,
      folder_id: folderId,
      created_at: createdAt,
      metadata: {
        source: 'rss',
        subscription_id: subscription.id,
        subscription_title: subscription.title,
        source_type: subscription.source_type,
        author: item.author,
        pub_date: item.pubDate
      }
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('同步文章到资源中心失败:', {
      title: item.title,
      url: item.link,
      error: error,
      message: error.message
    })
    return { resourceId: null, isNew: false }
  }
  
  return { resourceId: resource.id, isNew: true }
}

// 同步订阅的文章到资源中心（使用内存中的文章列表）
export async function syncSubscriptionToResources(
  subscriptionId: string,
  articles?: RSSItem[]  // 可选：直接传入文章列表，否则重新刷新
): Promise<{ synced: number; skipped: number; total: number }> {
  // 获取订阅信息
  const { data: subscription, error: subError } = await supabase
    .from('rss_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
  
  if (subError || !subscription) throw new Error('订阅不存在')
  
  // 如果没有传入文章列表，则重新刷新
  const items = articles || await refreshSubscription(subscriptionId)
  
  if (!items || items.length === 0) return { synced: 0, skipped: 0, total: 0 }
  
  // 并发同步，每批 5 个
  const BATCH_SIZE = 5
  let synced = 0
  let skipped = 0
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(item => syncItemToResource(item, subscription))
    )
    // 统计新创建和跳过的数量
    synced += results.filter(r => r.isNew).length
    skipped += results.filter(r => !r.isNew && r.resourceId !== null).length
  }
  
  return { synced, skipped, total: items.length }
}

// 手动同步所有开启自动同步的订阅（并发执行）
export async function syncAllAutoSyncSubscriptions(userId: string): Promise<{ total: number; synced: number; skipped: number }> {
  // 获取所有开启自动同步的订阅
  const { data: subscriptions, error } = await supabase
    .from('rss_subscriptions')
    .select('*')  // 需要完整数据用于同步
    .eq('user_id', userId)
    .eq('auto_sync', true)
    .eq('is_active', true)
  
  if (error) throw error
  if (!subscriptions || subscriptions.length === 0) return { total: 0, synced: 0, skipped: 0 }
  
  // 并发刷新所有订阅并同步
  const syncResults = await Promise.all(
    subscriptions.map(async sub => {
      try {
        // 刷新获取最新文章
        const articles = await refreshSubscription(sub.id)
        // 直接同步到资源中心
        return await syncSubscriptionToResources(sub.id, articles)
      } catch (e) {
        console.error(`同步订阅 ${sub.title} 失败:`, e)
        return { synced: 0, skipped: 0, total: 0 }
      }
    })
  )
  
  const totalSynced = syncResults.reduce((sum, r) => sum + r.synced, 0)
  const totalSkipped = syncResults.reduce((sum, r) => sum + r.skipped, 0)
  
  return { total: subscriptions.length, synced: totalSynced, skipped: totalSkipped }
}
