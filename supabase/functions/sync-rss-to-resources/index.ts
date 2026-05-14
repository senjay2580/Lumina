// RSS 文章自动同步到资源中心的定时任务
// 每小时执行一次，将开启自动同步的订阅的新文章同步到资源中心

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.3.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 解析 RSS/Atom Feed (Deno 版本)
async function fetchAndParseFeed(feedUrl: string) {
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) throw new Error(`无法获取 RSS 源: ${response.status}`)
  
  const xmlText = await response.text()
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  })
  const jsonObj = parser.parse(xmlText)
  
  // 判断是 RSS 还是 Atom
  const isAtom = jsonObj.feed !== undefined
  const items: any[] = []
  
  if (isAtom) {
    const entries = Array.isArray(jsonObj.feed.entry) ? jsonObj.feed.entry : (jsonObj.feed.entry ? [jsonObj.feed.entry] : [])
    entries.forEach((entry: any) => {
      const link = entry.link?.['@_href'] || (Array.isArray(entry.link) ? entry.link.find((l: any) => l['@_rel'] === 'alternate')?.['@_href'] || entry.link[0]?.['@_href'] : entry.link)
      items.push({
        guid: entry.id || link,
        title: typeof entry.title === 'string' ? entry.title : entry.title?.['#text'] || '',
        link: link,
        description: entry.summary || entry.content?.['#text'] || '',
        author: entry.author?.name || '',
        pubDate: entry.published || entry.updated
      })
    })
  } else {
    const channel = jsonObj.rss?.channel || jsonObj.channel
    const rawItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : [])
    rawItems.forEach((item: any) => {
      items.push({
        guid: item.guid?.['#text'] || item.guid || item.link,
        title: item.title,
        link: item.link,
        description: item.description,
        author: item.author || item['dc:creator'] || '',
        pubDate: item.pubDate
      })
    })
  }
  
  return {
    title: isAtom ? jsonObj.feed.title : (jsonObj.rss?.channel?.title || jsonObj.channel?.title || 'Unknown Feed'),
    items: items
  }
}

// 查找或创建文章文件夹
async function findOrCreateArticleFolder(
  supabase: any,
  userId: string,
  sourceName: string
): Promise<string | null> {
  if (!sourceName) return null

  // 查找已存在的文件夹
  const { data: existingFolder } = await supabase
    .from('resource_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('resource_type', 'article')
    .eq('name', sourceName)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingFolder) {
    return existingFolder.id
  }

  // 获取当前最大 position
  const { data: maxData } = await supabase
    .from('resource_folders')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  const nextPosition = (maxData?.position || 0) + 1

  const { data: newFolder, error } = await supabase
    .from('resource_folders')
    .insert({
      user_id: userId,
      name: sourceName,
      parent_id: null,
      resource_type: 'article',
      color: '#f97316',
      position: nextPosition
    })
    .select('id')
    .single()

  if (error) {
    console.error('创建文件夹失败:', error)
    return null
  }

  return newFolder.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取所有开启自动同步的活跃订阅
    const { data: subscriptions, error: subError } = await supabase
      .from('rss_subscriptions')
      .select('*')
      .eq('auto_sync', true)
      .eq('is_active', true)

    if (subError) throw subError
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: '没有需要同步的订阅', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalSynced = 0
    const results: any[] = []

    for (const subscription of subscriptions) {
      try {
        console.log(`正在同步订阅: ${subscription.title}`)
        
        // 1. 对于微信公众号，先尝试获取并刷新 WeWe-RSS
        if (subscription.source_type === 'wechat' && subscription.mp_id) {
          try {
            const feedUrl = new URL(subscription.feed_url)
            const baseUrl = `${feedUrl.protocol}//${feedUrl.host}`
            
            // 获取用户凭证（在边缘函数中直接查库）
            const { data: cred } = await supabase
              .from('user_credentials')
              .select('credential_value')
              .eq('user_id', subscription.user_id)
              .eq('service_name', 'wewe-rss')
              .eq('credential_key', 'auth_code')
              .maybeSingle()
            
            if (cred?.credential_value) {
              console.log(`触发 WeWe-RSS 刷新: ${subscription.title}`)
              await fetch(`${baseUrl}/trpc/feed.refreshArticles`, {
                method: 'POST',
                headers: {
                  'Authorization': cred.credential_value,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mpId: subscription.mp_id })
              })
              // 等待一下
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          } catch (wechatErr) {
            console.warn(`WeWe-RSS 刷新失败: ${subscription.title}`, wechatErr)
          }
        }

        // 2. 拉取最新文章
        const feedInfo = await fetchAndParseFeed(subscription.feed_url)
        
        // 3. 更新订阅状态
        await supabase
          .from('rss_subscriptions')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_item_date: feedInfo.items[0]?.pubDate || subscription.last_item_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        // 4. 过滤30天前的文章
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const recentItems = feedInfo.items.filter((item: any) => {
          if (!item.pubDate) return true
          const pubDate = new Date(item.pubDate)
          return pubDate >= thirtyDaysAgo
        })

        // 5. 同步到资源中心
        let syncedCount = 0
        for (const item of recentItems) {
          // 检查重复 (按 URL，忽略删除状态)
          const { data: existing } = await supabase
            .from('resources')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('url', item.link)
            .maybeSingle()

          if (existing) {
            console.log(`文章已存在，跳过: ${item.title}`);
            continue;
          }

          // 获取文件夹
          const folderId = await findOrCreateArticleFolder(supabase, subscription.user_id, subscription.title)
          
          const pubDate = item.pubDate ? new Date(item.pubDate) : null
          const createdAt = pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : new Date().toISOString()
          
          const { data: resource, error: resError } = await supabase
            .from('resources')
            .insert({
              user_id: subscription.user_id,
              type: 'article',
              title: item.title,
              description: item.description?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
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

          if (!resError && resource) {
            syncedCount++
            totalSynced++
          }
        }

        results.push({ subscription: subscription.title, synced: syncedCount })
      } catch (err) {
        console.error(`同步订阅 ${subscription.title} 失败:`, err)
        results.push({ subscription: subscription.title, error: String(err) })
      }
    }

    return new Response(
      JSON.stringify({
        message: `同步完成，共同步 ${totalSynced} 篇文章`,
        totalSynced,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('同步任务失败:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
