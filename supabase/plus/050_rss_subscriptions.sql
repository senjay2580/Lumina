-- RSS 订阅表
-- 用于存储用户的 RSS 订阅源

CREATE TABLE IF NOT EXISTS public.rss_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  site_url TEXT,
  icon_url TEXT,
  last_fetched_at TIMESTAMPTZ,
  last_item_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  fetch_interval INTEGER DEFAULT 60, -- 分钟
  source_type VARCHAR(20) DEFAULT 'rss', -- rss 或 wechat
  mp_id VARCHAR(100), -- 微信公众号 ID (WeWe-RSS)
  auto_sync BOOLEAN DEFAULT false, -- 是否自动同步到资源中心
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, feed_url)
);

-- RSS 文章条目表
CREATE TABLE IF NOT EXISTS public.rss_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.rss_subscriptions(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title VARCHAR(1000) NOT NULL,
  link TEXT NOT NULL,
  description TEXT,
  content TEXT,
  author VARCHAR(200),
  pub_date TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_synced BOOLEAN DEFAULT false, -- 是否已同步到资源中心
  synced_resource_id UUID, -- 同步后的资源 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(subscription_id, guid)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rss_subscriptions_user ON public.rss_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_subscriptions_active ON public.rss_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rss_subscriptions_mp ON public.rss_subscriptions(user_id, mp_id);
CREATE INDEX IF NOT EXISTS idx_rss_subscriptions_auto_sync ON public.rss_subscriptions(auto_sync) WHERE auto_sync = true;
CREATE INDEX IF NOT EXISTS idx_rss_items_subscription ON public.rss_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_rss_items_synced ON public.rss_items(subscription_id, is_synced);
CREATE INDEX IF NOT EXISTS idx_rss_items_pub_date ON public.rss_items(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_rss_items_unsynced ON public.rss_items(is_synced) WHERE is_synced = false;

-- RLS 策略
ALTER TABLE public.rss_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_items ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（使用自定义用户系统）
DROP POLICY IF EXISTS "Allow all on rss_subscriptions" ON public.rss_subscriptions;
CREATE POLICY "Allow all on rss_subscriptions" ON public.rss_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on rss_items" ON public.rss_items;
CREATE POLICY "Allow all on rss_items" ON public.rss_items
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rss_subscriptions IS 'RSS 订阅源';
COMMENT ON TABLE public.rss_items IS 'RSS 文章条目';
COMMENT ON COLUMN public.rss_subscriptions.fetch_interval IS '拉取间隔（分钟）';
COMMENT ON COLUMN public.rss_subscriptions.source_type IS '来源类型：rss 或 wechat';
COMMENT ON COLUMN public.rss_subscriptions.mp_id IS '微信公众号 ID（WeWe-RSS）';
COMMENT ON COLUMN public.rss_subscriptions.auto_sync IS '是否自动同步文章到资源中心';
COMMENT ON COLUMN public.rss_items.is_synced IS '是否已同步到资源中心';
COMMENT ON COLUMN public.rss_items.synced_resource_id IS '同步后的资源 ID';
