// RSS 文章自动同步到资源中心的定时任务
// 每小时执行一次，将开启自动同步的订阅的新文章同步到资源中心

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// RSS2JSON API 解析 RSS
async function parseFeed(feedUrl: string) {
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) throw new Error('无法获取 RSS 源')
  
  const data = await response.json()
  if (data.status !== 'ok') throw new Error(data.message || '解析 RSS 失败')
  
  return {
    title: data.feed?.title || 'Unknown Feed',
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

// 查找或创建文章文件夹（按公众号/订阅源名称）
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

  // 检查该来源是否有足够的文章（至少1篇已存在）才创建文件夹
  const { count } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'article')
    .eq('metadata->>subscription_title', sourceName)
    .is('deleted_at', null)

  // 如果已有1篇，加上新的就是2篇，可以创建文件夹
  if (count && count >= 1) {
    // 获取当前最大 position
    const { data: maxData } = await supabase
      .from('resource_folders')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: false })
      .limit(1)
      .single()
    
    const nextPosition = (maxData?.position || 0) + 1

    const { data: newFolder, error } = await supabase
      .from('resource_folders')
      .insert({
        user_id: userId,
        name: sourceName,
        parent_id: null,
        resource_type: 'article',
        color: '#f97316', // 橙色
        position: nextPosition
      })
      .select('id')
      .single()

    if (!error && newFolder) {
      // 将已存在的同来源文章也移到新文件夹
      await supabase
        .from('resources')
        .update({ folder_id: newFolder.id })
        .eq('user_id', userId)
        .eq('type', 'article')
        .eq('metadata->>subscription_title', sourceName)
        .is('folder_id', null)
        .is('deleted_at', null)

      return newFolder.id
    }
  }

  return null
}

Deno.serve(async (req) => {
  // Handle CORS
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
        // 1. 拉取最新文章（直接到内存）
        const feedInfo = await parseFeed(subscription.feed_url)
        
        // 2. 更新订阅的最后获取时间
        await supabase
          .from('rss_subscriptions')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_item_date: feedInfo.items[0]?.pubDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        // 3. 过滤30天前的文章
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const recentItems = feedInfo.items.filter(item => {
          if (!item.pubDate) return true
          const pubDate = new Date(item.pubDate)
          return pubDate >= thirtyDaysAgo
        })

        // 4. 同步到资源中心
        let synced = 0
        for (const item of recentItems) {
          // 检查是否已存在（按 URL）
          const { data: existingByUrl } = await supabase
            .from('resources')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('url', item.link)
            .is('deleted_at', null)
            .maybeSingle()

          if (existingByUrl) {
            continue // URL 已存在，跳过
          }

          // 创建新资源
          const sourceName = subscription.title
          
          // 查找或创建对应的文件夹
          const folderId = await findOrCreateArticleFolder(supabase, subscription.user_id, sourceName)
          
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
              folder_id: folderId, // 自动归类到文件夹
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
            synced++
            totalSynced++
          }
        }

        results.push({ subscription: subscription.title, synced })
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
