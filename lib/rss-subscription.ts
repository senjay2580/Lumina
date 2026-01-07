// RSS 订阅管理
// 支持订阅 RSS 源，自动同步文章到资源中心
// 支持 WeWe-RSS 微信公众号订阅

import { supabase } from './supabase'

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
  id: string
  subscription_id: string
  guid: string
  title: string
  link: string
  description?: string
  content?: string
  author?: string
  pub_date?: string
  is_read: boolean
  is_synced: boolean // 是否已同步到资源中心
  synced_resource_id?: string // 同步后的资源 ID
  created_at: string
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
  // 使用 RSS2JSON API 或自建代理解析 RSS
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
  
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error('无法获取 RSS 源')
  }
  
  const data = await response.json()
  
  if (data.status !== 'ok') {
    throw new Error(data.message || '解析 RSS 失败')
  }
  
  return {
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
  
  // 如果开启自动同步，保存初始文章
  if (autoSync && feedInfo.items.length > 0) {
    await saveRSSItems(data.id, feedInfo.items.slice(0, 10)) // 只保存最新 10 篇
  }
  
  return data
}

// 保存 RSS 条目
async function saveRSSItems(
  subscriptionId: string,
  items: Array<{
    guid: string
    title: string
    link: string
    description?: string
    content?: string
    author?: string
    pubDate?: string
  }>
) {
  const records = items.map(item => ({
    subscription_id: subscriptionId,
    guid: item.guid,
    title: item.title,
    link: item.link,
    description: item.description,
    content: item.content,
    author: item.author,
    pub_date: item.pubDate,
    is_read: false,
    is_synced: false
  }))
  
  // 使用 upsert 避免重复
  const { error } = await supabase
    .from('rss_items')
    .upsert(records, { onConflict: 'subscription_id,guid' })
  
  if (error) console.error('保存 RSS 条目失败:', error)
}

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

// 获取订阅的文章列表
export async function getSubscriptionItems(
  subscriptionId: string,
  limit: number = 50
): Promise<RSSItem[]> {
  const { data, error } = await supabase
    .from('rss_items')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('pub_date', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// 获取用户所有未同步的文章
export async function getUnsyncedItems(userId: string): Promise<(RSSItem & { subscription: RSSSubscription })[]> {
  const { data, error } = await supabase
    .from('rss_items')
    .select(`
      *,
      subscription:rss_subscriptions!inner(*)
    `)
    .eq('rss_subscriptions.user_id', userId)
    .eq('is_synced', false)
    .order('pub_date', { ascending: false })
    .limit(100)
  
  if (error) throw error
  return data || []
}

// 标记文章为已同步
export async function markItemSynced(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('rss_items')
    .update({ is_synced: true })
    .eq('id', itemId)
  
  if (error) throw error
}

// 标记文章为已读
export async function markItemRead(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('rss_items')
    .update({ is_read: true })
    .eq('id', itemId)
  
  if (error) throw error
}

// 标记所有文章为已读
export async function markAllItemsRead(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('rss_items')
    .update({ is_read: true })
    .eq('subscription_id', subscriptionId)
    .eq('is_read', false)
  
  if (error) throw error
}

// 获取未读文章数量
export async function getUnreadCount(subscriptionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rss_items')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscriptionId)
    .eq('is_read', false)
  
  if (error) return 0
  return count || 0
}

// 刷新订阅（拉取最新文章）
export async function refreshSubscription(subscriptionId: string): Promise<number> {
  // 获取订阅信息
  const { data: subscription, error: subError } = await supabase
    .from('rss_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
  
  if (subError || !subscription) throw new Error('订阅不存在')
  
  // 解析 feed
  const feedInfo = await parseFeed(subscription.feed_url)
  
  // 保存新文章
  await saveRSSItems(subscriptionId, feedInfo.items)
  
  // 更新最后获取时间
  await supabase
    .from('rss_subscriptions')
    .update({
      last_fetched_at: new Date().toISOString(),
      last_item_date: feedInfo.items[0]?.pubDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionId)
  
  return feedInfo.items.length
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
    
    // 如果有 authCode，测试 tRPC API
    if (authCode) {
      const trpcResponse = await fetch(`${normalizedUrl}/trpc/feed.list`, {
        method: 'POST',
        headers: {
          'Authorization': authCode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      if (!trpcResponse.ok) return false
      const result = await trpcResponse.json()
      if (result.error) return false
    }
    
    return true
  } catch {
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

// 将单篇文章同步到资源中心
export async function syncItemToResource(
  item: RSSItem,
  subscription: RSSSubscription
): Promise<string | null> {
  // 检查是否已同步且资源还存在
  if (item.is_synced && item.synced_resource_id) {
    // 验证资源是否还存在（未被删除）
    const { data: existingResource } = await supabase
      .from('resources')
      .select('id')
      .eq('id', item.synced_resource_id)
      .is('deleted_at', null)
      .maybeSingle()
    
    if (existingResource) {
      return item.synced_resource_id
    }
    // 资源已被删除，重置同步状态，但不重新同步（用户主动删除的）
    await supabase
      .from('rss_items')
      .update({ is_synced: true }) // 保持已同步状态，避免重复添加
      .eq('id', item.id)
    return null
  }
  
  // 检查资源中心是否已存在相同 URL 的资源（包括不同类型）
  const { data: existingByUrl } = await supabase
    .from('resources')
    .select('id')
    .eq('user_id', subscription.user_id)
    .eq('url', item.link)
    .is('deleted_at', null)
    .maybeSingle()
  
  if (existingByUrl) {
    // URL 已存在，标记为已同步
    await supabase
      .from('rss_items')
      .update({ is_synced: true, synced_resource_id: existingByUrl.id })
      .eq('id', item.id)
    return existingByUrl.id
  }
  
  // 检查是否存在相同标题的文章（同一订阅源）
  const { data: existingByTitle } = await supabase
    .from('resources')
    .select('id')
    .eq('user_id', subscription.user_id)
    .eq('type', 'article')
    .eq('title', item.title)
    .is('deleted_at', null)
    .maybeSingle()
  
  if (existingByTitle) {
    // 标题已存在，标记为已同步
    await supabase
      .from('rss_items')
      .update({ is_synced: true, synced_resource_id: existingByTitle.id })
      .eq('id', item.id)
    return existingByTitle.id
  }
  
  // 创建新资源
  const { data: resource, error } = await supabase
    .from('resources')
    .insert({
      user_id: subscription.user_id,
      type: 'article', // 使用文章类型
      title: item.title,
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 500) || undefined,
      url: item.link,
      metadata: {
        source: 'rss',
        subscription_id: subscription.id,
        subscription_title: subscription.title,
        source_type: subscription.source_type,
        author: item.author,
        pub_date: item.pub_date
      }
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('同步文章到资源中心失败:', error)
    return null
  }
  
  // 更新文章同步状态
  await supabase
    .from('rss_items')
    .update({ is_synced: true, synced_resource_id: resource.id })
    .eq('id', item.id)
  
  return resource.id
}

// 同步订阅的所有未同步文章到资源中心（并发执行）
export async function syncSubscriptionToResources(subscriptionId: string): Promise<number> {
  // 获取订阅信息
  const { data: subscription, error: subError } = await supabase
    .from('rss_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()
  
  if (subError || !subscription) throw new Error('订阅不存在')
  
  // 获取未同步的文章
  const { data: items, error: itemsError } = await supabase
    .from('rss_items')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('is_synced', false)
    .order('pub_date', { ascending: false })
    .limit(50) // 每次最多同步 50 篇
  
  if (itemsError) throw itemsError
  if (!items || items.length === 0) return 0
  
  // 并发同步，每批 5 个
  const BATCH_SIZE = 5
  let synced = 0
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(item => syncItemToResource(item, subscription))
    )
    synced += results.filter(id => id !== null).length
  }
  
  return synced
}

// 手动同步所有开启自动同步的订阅（并发执行）
export async function syncAllAutoSyncSubscriptions(userId: string): Promise<{ total: number; synced: number }> {
  // 获取所有开启自动同步的订阅
  const { data: subscriptions, error } = await supabase
    .from('rss_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('auto_sync', true)
    .eq('is_active', true)
  
  if (error) throw error
  if (!subscriptions || subscriptions.length === 0) return { total: 0, synced: 0 }
  
  // 并发刷新所有订阅
  await Promise.all(
    subscriptions.map(sub => 
      refreshSubscription(sub.id).catch(e => console.error('刷新订阅失败:', e))
    )
  )
  
  // 并发同步所有订阅到资源中心
  const syncResults = await Promise.all(
    subscriptions.map(sub => 
      syncSubscriptionToResources(sub.id).catch(() => 0)
    )
  )
  
  const totalSynced = syncResults.reduce((sum, count) => sum + count, 0)
  
  return { total: subscriptions.length, synced: totalSynced }
}
