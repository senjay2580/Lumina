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
        // 1. 拉取最新文章
        const feedInfo = await parseFeed(subscription.feed_url)
        
        // 2. 保存新文章到 rss_items
        const records = feedInfo.items.map((item: any) => ({
          subscription_id: subscription.id,
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

        await supabase
          .from('rss_items')
          .upsert(records, { onConflict: 'subscription_id,guid', ignoreDuplicates: true })

        // 更新订阅的最后获取时间
        await supabase
          .from('rss_subscriptions')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_item_date: feedInfo.items[0]?.pubDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        // 3. 获取未同步的文章
        const { data: unsyncedItems } = await supabase
          .from('rss_items')
          .select('*')
          .eq('subscription_id', subscription.id)
          .eq('is_synced', false)
          .order('pub_date', { ascending: false })
          .limit(20)

        if (!unsyncedItems || unsyncedItems.length === 0) {
          results.push({ subscription: subscription.title, synced: 0 })
          continue
        }

        // 4. 同步到资源中心
        let synced = 0
        for (const item of unsyncedItems) {
          // 检查是否已存在（按 URL）
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
            continue
          }

          // 检查是否已存在（按标题，同类型）
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
            continue
          }

          // 创建新资源
          const { data: resource, error: resError } = await supabase
            .from('resources')
            .insert({
              user_id: subscription.user_id,
              type: 'article', // 使用文章类型
              title: item.title,
              description: item.description?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
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

          if (!resError && resource) {
            await supabase
              .from('rss_items')
              .update({ is_synced: true, synced_resource_id: resource.id })
              .eq('id', item.id)
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
