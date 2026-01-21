// RSS 订阅管理页面
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Rss,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Clock,
  AlertCircle,
  Check,
  Loader2,
  Settings,
  ChevronDown,
  Link2,
  MessageCircle,
  Download,
  FileText,
  Circle,
  Calendar
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal, Confirm, Button, Tooltip } from '../shared'
import {
  RSSSubscription,
  RSSItem,
  WechatMpInfo,
  WeweAccountStatus,
  getUserSubscriptions,
  addSubscription,
  deleteSubscription,
  refreshSubscription,
  parseFeed,
  isWechatArticle,
  getWeweMpList,
  addWeweMp,
  testWeweConnection,
  checkWeweAccountStatus,
  getWeweLoginQrCode,
  checkWeweLoginResult,
  addWeweAccount,
  syncWeweToSubscriptions,
  generateWeweRssUrl,
  toggleAutoSync,
  syncSubscriptionToResources,
  syncAllAutoSyncSubscriptions
} from '../lib/rss-subscription'
import { getUserCredential, saveCredential } from '../lib/user-credentials'
import { supabase } from '../lib/supabase'

interface Props {
  userId: string
}

export default function RSSSubscriptionPage({ userId }: Props) {
  const [subscriptions, setSubscriptions] = useState<RSSSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showWechatModal, setShowWechatModal] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  
  // 添加订阅表单
  const [feedUrl, setFeedUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [previewFeed, setPreviewFeed] = useState<{ title: string; description?: string; itemCount: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  
  // WeWe-RSS 设置
  const [weweRssUrl, setWeweRssUrl] = useState('')
  const [weweRssUrlInput, setWeweRssUrlInput] = useState('')
  const [weweAuthCode, setWeweAuthCode] = useState('')
  const [weweAuthCodeInput, setWeweAuthCodeInput] = useState('')
  const [savingWeweRss, setSavingWeweRss] = useState(false)
  const [testingWeweRss, setTestingWeweRss] = useState(false)
  const [weweRssStatus, setWeweRssStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  
  // 微信公众号列表
  const [wechatMpList, setWechatMpList] = useState<WechatMpInfo[]>([])
  const [loadingMpList, setLoadingMpList] = useState(false)
  const [wechatArticleUrl, setWechatArticleUrl] = useState('')
  const [addingWechat, setAddingWechat] = useState(false)
  const [wechatError, setWechatError] = useState<string | null>(null)
  const [syncingWewe, setSyncingWewe] = useState(false)
  
  // 文章列表
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null)
  const [articles, setArticles] = useState<RSSItem[]>([])  // 当前已加载的文章
  const [allArticles, setAllArticles] = useState<RSSItem[]>([])  // 所有可用文章（用于分页）
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const ARTICLES_PER_PAGE = 15  // 每页显示15篇
  
  // 同步状态
  const [syncingSubId, setSyncingSubId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncResult, setSyncResult] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: true, message: '' })
  
  // 账号状态检测
  const [accountStatus, setAccountStatus] = useState<WeweAccountStatus | null>(null)
  const [showAccountAlert, setShowAccountAlert] = useState(false)
  const [checkingAccount, setCheckingAccount] = useState(false)
  
  // 登录二维码
  const [loginQrCode, setLoginQrCode] = useState<{ url: string; id: string } | null>(null)
  const [loadingQrCode, setLoadingQrCode] = useState(false)
  const [qrCodeError, setQrCodeError] = useState<string | null>(null)
  const [checkingLoginResult, setCheckingLoginResult] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)

  // 加载订阅列表
  const loadSubscriptions = useCallback(async () => {
    try {
      const data = await getUserSubscriptions(userId)
      setSubscriptions(data)
    } catch (err) {
      console.error('加载订阅失败:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 加载 WeWe-RSS 配置
  const loadWeweRssConfig = useCallback(async () => {
    try {
      const url = await getUserCredential(userId, 'wewe-rss', 'base_url')
      const authCode = await getUserCredential(userId, 'wewe-rss', 'auth_code')
      if (url) {
        setWeweRssUrl(url)
        setWeweRssUrlInput(url)
      }
      if (authCode) {
        setWeweAuthCode(authCode)
        setWeweAuthCodeInput(authCode)
      }
      
      // 如果配置了 WeWe-RSS，自动检测账号状态
      if (url && authCode) {
        checkAccountStatus(url, authCode)
      }
    } catch (err) {
      console.error('加载 WeWe-RSS 配置失败:', err)
    }
  }, [userId])
  
  // 检测 WeWe-RSS 账号状态
  const checkAccountStatus = async (url?: string, authCode?: string) => {
    const baseUrl = url || weweRssUrl
    const code = authCode || weweAuthCode
    if (!baseUrl || !code) return
    
    setCheckingAccount(true)
    try {
      const status = await checkWeweAccountStatus(baseUrl, code)
      setAccountStatus(status)
      
      // 如果需要重新登录，显示提醒弹窗
      if (status.needRelogin) {
        setShowAccountAlert(true)
      }
    } catch (err) {
      console.error('检测账号状态失败:', err)
    } finally {
      setCheckingAccount(false)
    }
  }
  
  // 获取登录二维码
  const fetchLoginQrCode = async () => {
    if (!weweRssUrl || !weweAuthCode) return
    
    setLoadingQrCode(true)
    setQrCodeError(null)
    setLoginQrCode(null)
    setLoginSuccess(false)
    
    try {
      const result = await getWeweLoginQrCode(weweRssUrl, weweAuthCode)
      if (result) {
        setLoginQrCode(result)
        // 开始轮询登录结果
        startPollingLoginResult(result.id)
      } else {
        setQrCodeError('获取二维码失败，请稍后重试')
      }
    } catch (err) {
      console.error('获取二维码失败:', err)
      setQrCodeError('获取二维码失败，请稍后重试')
    } finally {
      setLoadingQrCode(false)
    }
  }
  
  // 轮询登录结果
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  
  const startPollingLoginResult = (loginId: string) => {
    // 清除之前的轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }
    
    setCheckingLoginResult(true)
    let attempts = 0
    const maxAttempts = 60 // 最多轮询 60 次（约 2 分钟）
    
    pollingRef.current = setInterval(async () => {
      attempts++
      
      if (attempts > maxAttempts) {
        // 超时
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setCheckingLoginResult(false)
        setQrCodeError('二维码已过期，请重新获取')
        setLoginQrCode(null)
        return
      }
      
      try {
        const result = await checkWeweLoginResult(weweRssUrl, weweAuthCode, loginId)
        if (result?.success && result.account) {
          // 登录成功，添加账号到 WeWe-RSS
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          
          // 添加账号
          const added = await addWeweAccount(weweRssUrl, weweAuthCode, result.account)
          
          setCheckingLoginResult(false)
          if (added) {
            setLoginSuccess(true)
            setLoginQrCode(null)
            
            // 重新检测账号状态
            setTimeout(async () => {
              await checkAccountStatus()
              
              // 自动同步微信公众号文章
              try {
                setSyncingAll(true)
                const syncResult = await syncAllAutoSyncSubscriptions(userId)
                loadSubscriptions()
                if (syncResult.synced > 0) {
                  setSyncResult({ 
                    open: true, 
                    success: true, 
                    message: `登录成功！已自动同步 ${syncResult.synced} 篇文章到资源中心` 
                  })
                }
              } catch (err) {
                console.error('自动同步失败:', err)
              } finally {
                setSyncingAll(false)
              }
            }, 1000)
          } else {
            setQrCodeError('添加账号失败，请重试')
          }
        }
      } catch (err) {
        console.error('检查登录结果失败:', err)
      }
    }, 2000) // 每 2 秒检查一次
  }
  
  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  useEffect(() => {
    loadSubscriptions()
    loadWeweRssConfig()
  }, [loadSubscriptions, loadWeweRssConfig])

  // 预览 Feed
  const handlePreviewFeed = async () => {
    if (!feedUrl.trim()) return
    
    setPreviewing(true)
    setAddError(null)
    setPreviewFeed(null)
    
    try {
      // 检查是否是微信公众号链接
      if (isWechatArticle(feedUrl)) {
        if (!weweRssUrl || !weweAuthCode) {
          setAddError('请先在设置中配置 WeWe-RSS 服务地址和授权码')
          return
        }
        // 打开微信公众号添加弹窗
        setWechatArticleUrl(feedUrl)
        setShowAddModal(false)
        setShowWechatModal(true)
        return
      }
      
      const feed = await parseFeed(feedUrl)
      setPreviewFeed({
        title: feed.title,
        description: feed.description,
        itemCount: feed.items.length
      })
    } catch (err: any) {
      setAddError(err.message || '无法解析 RSS 源')
    } finally {
      setPreviewing(false)
    }
  }

  // 添加订阅
  const handleAddSubscription = async () => {
    if (!feedUrl.trim() || !previewFeed) return
    
    setAdding(true)
    setAddError(null)
    
    try {
      await addSubscription(userId, feedUrl, true)
      setShowAddModal(false)
      setFeedUrl('')
      setPreviewFeed(null)
      loadSubscriptions()
    } catch (err: any) {
      setAddError(err.message || '添加订阅失败')
    } finally {
      setAdding(false)
    }
  }

  // 刷新订阅 - 已合并到 handleRefreshAndLoad

  // 删除订阅
  const handleDelete = async (subscriptionId: string) => {
    setDeletingId(subscriptionId)
    try {
      await deleteSubscription(subscriptionId)
      loadSubscriptions()
    } catch (err) {
      console.error('删除失败:', err)
    } finally {
      setDeletingId(null)
      setDeleteConfirm({ open: false, id: null })
    }
  }

  // 保存 WeWe-RSS 配置
  const handleSaveWeweRss = async () => {
    if (!weweRssUrlInput.trim()) return
    
    setSavingWeweRss(true)
    try {
      await saveCredential(userId, 'wewe-rss', 'base_url', weweRssUrlInput.trim(), 'WeWe-RSS 服务地址')
      if (weweAuthCodeInput.trim()) {
        await saveCredential(userId, 'wewe-rss', 'auth_code', weweAuthCodeInput.trim(), 'WeWe-RSS 授权码')
      }
      setWeweRssUrl(weweRssUrlInput.trim())
      setWeweAuthCode(weweAuthCodeInput.trim())
      setWeweRssStatus('unknown')
    } catch (err) {
      console.error('保存失败:', err)
    } finally {
      setSavingWeweRss(false)
    }
  }

  // 测试 WeWe-RSS 连接
  const handleTestWeweRss = async () => {
    if (!weweRssUrlInput.trim() || !weweAuthCodeInput.trim()) return
    
    setTestingWeweRss(true)
    try {
      const connected = await testWeweConnection(weweRssUrlInput.trim(), weweAuthCodeInput.trim())
      setWeweRssStatus(connected ? 'connected' : 'error')
    } catch {
      setWeweRssStatus('error')
    } finally {
      setTestingWeweRss(false)
    }
  }

  // 加载微信公众号列表
  const loadWechatMpList = async () => {
    if (!weweRssUrl || !weweAuthCode) return
    
    setLoadingMpList(true)
    try {
      const list = await getWeweMpList(weweRssUrl, weweAuthCode)
      setWechatMpList(list)
    } catch (err) {
      console.error('加载公众号列表失败:', err)
    } finally {
      setLoadingMpList(false)
    }
  }

  // 添加微信公众号
  const handleAddWechatMp = async () => {
    if (!wechatArticleUrl.trim() || !weweRssUrl || !weweAuthCode) return
    
    setAddingWechat(true)
    setWechatError(null)
    
    try {
      const mp = await addWeweMp(weweRssUrl, weweAuthCode, wechatArticleUrl)
      
      // 只添加这一个公众号到本地订阅，不同步全部
      const feedUrl = generateWeweRssUrl(weweRssUrl, mp.id)
      
      // 检查是否已存在
      const { data: existing } = await supabase
        .from('rss_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('mp_id', mp.id)
        .maybeSingle()
      
      if (!existing) {
        // 新增
        await supabase
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
      }
      
      setShowWechatModal(false)
      setWechatArticleUrl('')
      loadSubscriptions()
      loadWechatMpList()
    } catch (err: any) {
      setWechatError(err.message || '添加公众号失败')
    } finally {
      setAddingWechat(false)
    }
  }

  // 同步 WeWe-RSS 公众号到本地
  const handleSyncWewe = async () => {
    if (!weweRssUrl || !weweAuthCode) return
    
    setSyncingWewe(true)
    try {
      await syncWeweToSubscriptions(userId, weweRssUrl, weweAuthCode)
      loadSubscriptions()
      loadWechatMpList()
    } catch (err) {
      console.error('同步失败:', err)
    } finally {
      setSyncingWewe(false)
    }
  }

  // 展开/收起文章列表
  const handleToggleArticles = async (subscriptionId: string) => {
    if (expandedSubId === subscriptionId) {
      setExpandedSubId(null)
      setArticles([])
      setAllArticles([])
      return
    }
    
    setExpandedSubId(subscriptionId)
    setLoadingArticles(true)
    setArticles([])
    setAllArticles([])
    
    try {
      const items = await refreshSubscription(subscriptionId)
      // 保存所有文章
      setAllArticles(items)
      // 只显示前15篇
      setArticles(items.slice(0, ARTICLES_PER_PAGE))
    } catch (err) {
      console.error('加载文章失败:', err)
    } finally {
      setLoadingArticles(false)
    }
  }

  // 加载更多文章
  const handleLoadMore = () => {
    setLoadingMore(true)
    try {
      const currentLength = articles.length
      const moreArticles = allArticles.slice(currentLength, currentLength + ARTICLES_PER_PAGE)
      setArticles(prev => [...prev, ...moreArticles])
    } finally {
      setLoadingMore(false)
    }
  }

  // 刷新并加载文章
  const handleRefreshAndLoad = async (subscriptionId: string) => {
    setRefreshingId(subscriptionId)
    try {
      const items = await refreshSubscription(subscriptionId)
      loadSubscriptions()
      // 如果当前展开的就是这个订阅，更新文章列表
      if (expandedSubId === subscriptionId) {
        setArticles(items)
      }
    } catch (err) {
      console.error('刷新失败:', err)
    } finally {
      setRefreshingId(null)
    }
  }

  // 切换自动同步
  const handleToggleAutoSync = async (sub: RSSSubscription, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await toggleAutoSync(sub.id, !sub.auto_sync)
      setSubscriptions(prev => prev.map(s => 
        s.id === sub.id ? { ...s, auto_sync: !s.auto_sync } : s
      ))
    } catch (err) {
      console.error('切换自动同步失败:', err)
    }
  }

  // 手动同步单个订阅到资源中心（同步全量文章）
  const handleSyncToResources = async (subscriptionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSyncingSubId(subscriptionId)
    try {
      // 同步全量文章（allArticles），不是当前已加载的
      const articlesToSync = expandedSubId === subscriptionId ? allArticles : await refreshSubscription(subscriptionId)
      const result = await syncSubscriptionToResources(subscriptionId, articlesToSync)
      loadSubscriptions()
      
      // 根据结果显示不同的提示
      if (result.synced > 0) {
        const msg = result.skipped > 0 
          ? `已同步 ${result.synced} 篇文章，${result.skipped} 篇已存在`
          : `已同步 ${result.synced} 篇文章到资源中心`
        setSyncResult({ open: true, success: true, message: msg })
      } else if (result.skipped > 0) {
        setSyncResult({ open: true, success: true, message: `${result.skipped} 篇文章已存在，未重复添加` })
      } else {
        setSyncResult({ open: true, success: true, message: '没有新文章需要同步' })
      }
    } catch (err) {
      console.error('同步失败:', err)
      setSyncResult({ open: true, success: false, message: '同步失败，请稍后重试' })
    } finally {
      setSyncingSubId(null)
    }
  }

  // 同步所有开启自动同步的订阅
  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const result = await syncAllAutoSyncSubscriptions(userId)
      loadSubscriptions()
      // 根据结果显示不同的提示
      if (result.synced > 0) {
        const msg = result.skipped > 0 
          ? `已同步 ${result.synced} 篇文章，${result.skipped} 篇已存在`
          : `已同步 ${result.synced} 篇文章到资源中心`
        setSyncResult({ open: true, success: true, message: msg })
      } else if (result.skipped > 0) {
        setSyncResult({ open: true, success: true, message: `${result.skipped} 篇文章已存在，未重复添加` })
      } else {
        setSyncResult({ open: true, success: true, message: '没有新文章需要同步' })
      }
    } catch (err) {
      console.error('同步失败:', err)
      setSyncResult({ open: true, success: false, message: '同步失败，请稍后重试' })
    } finally {
      setSyncingAll(false)
    }
  }

  // 刷新所有订阅
  const [refreshingAll, setRefreshingAll] = useState(false)
  const handleRefreshAll = async () => {
    if (subscriptions.length === 0) return
    setRefreshingAll(true)
    try {
      // 并发刷新所有订阅
      await Promise.all(
        subscriptions.map(sub => refreshSubscription(sub.id).catch(err => {
          console.error(`刷新订阅 ${sub.title} 失败:`, err)
          return null
        }))
      )
      loadSubscriptions()
      // 如果当前展开了某个订阅，重新加载文章
      if (expandedSubId) {
        const items = await refreshSubscription(expandedSubId)
        setArticles(items)
      }
    } catch (err) {
      console.error('刷新失败:', err)
    } finally {
      setRefreshingAll(false)
    }
  }

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '从未'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return `${Math.floor(diff / 86400000)} 天前`
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Rss className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">RSS 订阅</h1>
              <p className="text-sm text-gray-500">订阅博客、公众号，自动同步到资源中心</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 刷新所有按钮 */}
            {subscriptions.length > 0 && (
              <Tooltip content="刷新所有订阅">
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshingAll}
                  className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshingAll ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
            )}
            {/* 账号状态指示器 */}
            {weweRssUrl && weweAuthCode && accountStatus && (
              <Tooltip content={accountStatus.message}>
                <button
                  onClick={() => {
                    if (accountStatus.needRelogin) {
                      setShowAccountAlert(true)
                    } else {
                      checkAccountStatus()
                    }
                  }}
                  className={`p-2.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                    accountStatus.needRelogin
                      ? 'bg-red-100 hover:bg-red-200 text-red-600'
                      : accountStatus.invalidAccounts.length > 0 || accountStatus.blockedAccounts.length > 0
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-600'
                      : 'bg-green-100 hover:bg-green-200 text-green-600'
                  }`}
                >
                  {checkingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : accountStatus.needRelogin ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span className="text-xs font-medium">
                    {accountStatus.needRelogin 
                      ? '账号失效' 
                      : `${accountStatus.accounts.length - accountStatus.invalidAccounts.length}个账号`}
                  </span>
                </button>
              </Tooltip>
            )}
            <Tooltip content="设置">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
            {subscriptions.some(s => s.auto_sync) && (
              <Tooltip content="同步所有开启自动同步的订阅到资源中心">
                <Button
                  variant="secondary"
                  onClick={handleSyncAll}
                  loading={syncingAll}
                  icon={<Download className="w-4 h-4" />}
                >
                  同步全部
                </Button>
              </Tooltip>
            )}
            {weweRssUrl && weweAuthCode && (
              <Tooltip content="管理微信公众号订阅">
                <Button
                  variant="success"
                  onClick={() => {
                    loadWechatMpList()
                    setShowWechatModal(true)
                  }}
                  icon={<MessageCircle className="w-4 h-4" />}
                >
                  公众号
                </Button>
              </Tooltip>
            )}
            <Tooltip content="添加 RSS 或公众号订阅">
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                添加订阅
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* 订阅列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <Rss className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-gray-500 mb-2">暂无订阅</p>
            <p className="text-gray-400 text-sm mb-4">添加 RSS 源开始订阅内容</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              添加第一个订阅
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all"
              >
                <div 
                  className="p-4 cursor-pointer group"
                  onClick={() => handleToggleArticles(sub.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* 图标 */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      sub.source_type === 'wechat' ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      {sub.icon_url ? (
                        <img src={sub.icon_url} alt="" className="w-8 h-8 rounded" />
                      ) : sub.source_type === 'wechat' ? (
                        <MessageCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <Rss className="w-6 h-6 text-orange-500" />
                      )}
                    </div>
                    
                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">{sub.title}</h3>
                        {sub.source_type === 'wechat' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded-full">公众号</span>
                        )}
                        {sub.auto_sync && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600 rounded-full">自动同步</span>
                        )}
                        {sub.is_active ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded-full">活跃</span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">已暂停</span>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{sub.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          更新于 {formatTime(sub.last_fetched_at)}
                        </span>
                        {sub.site_url && (
                          <a
                            href={sub.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {new URL(sub.site_url).hostname}
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* 展开箭头和操作按钮 */}
                    <div className="flex items-center gap-1">
                      {/* 自动同步开关 */}
                      <Tooltip content={sub.auto_sync ? '关闭自动同步' : '开启自动同步到资源中心'}>
                        <button
                          onClick={(e) => handleToggleAutoSync(sub, e)}
                          className={`p-2 rounded-lg transition-colors ${
                            sub.auto_sync 
                              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                              : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      {/* 手动同步按钮 */}
                      <Tooltip content="立即同步到资源中心">
                        <button
                          onClick={(e) => handleSyncToResources(sub.id, e)}
                          disabled={syncingSubId === sub.id}
                          className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        >
                          {syncingSubId === sub.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>
                      </Tooltip>
                      <Tooltip content="刷新">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRefreshAndLoad(sub.id)
                          }}
                          disabled={refreshingId === sub.id}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingId === sub.id ? 'animate-spin' : ''}`} />
                        </button>
                      </Tooltip>
                      <Tooltip content="删除">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm({ open: true, id: sub.id })
                          }}
                          disabled={deletingId === sub.id}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSubId === sub.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                
                {/* 文章列表 */}
                {expandedSubId === sub.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {loadingArticles ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : articles.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>暂无文章</p>
                        <button
                          onClick={() => handleRefreshAndLoad(sub.id)}
                          className="mt-2 text-primary hover:underline text-xs"
                        >
                          点击刷新获取文章
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {articles.map((article) => {
                          // 检查是否超过30天
                          const isOld = article.pubDate ? (() => {
                            const pubDate = new Date(article.pubDate)
                            const thirtyDaysAgo = new Date()
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                            return pubDate < thirtyDaysAgo
                          })() : false
                          
                          return (
                          <a
                            key={article.guid}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-4 hover:bg-white transition-colors"
                          >
                            {/* 文章图标 */}
                            <div className="flex-shrink-0 mt-1.5">
                              <FileText className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm line-clamp-2 font-medium text-gray-900 hover:text-primary transition-colors">
                                {article.title}
                              </h4>
                              {article.description && (
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                  {article.description.replace(/<[^>]*>/g, '').slice(0, 100)}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                {article.pubDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatTime(article.pubDate)}
                                  </span>
                                )}
                                {article.author && <span>作者：{article.author}</span>}
                                {isOld && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium">
                                    超过30天，不同步
                                  </span>
                                )}
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </a>
                        )})
                        }
                        {/* 统计信息和加载更多按钮 */}
                        {allArticles.length > 0 && (
                          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>共 {allArticles.length} 篇文章</span>
                              <span>已加载 {articles.length} 篇</span>
                            </div>
                            {articles.length < allArticles.length && (
                              <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="w-full mt-2 py-2.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                {loadingMore ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    加载中...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4" />
                                    加载更多
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加订阅弹窗 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setFeedUrl('')
          setPreviewFeed(null)
          setAddError(null)
        }}
        title="添加 RSS 订阅"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">RSS 地址</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedUrl}
                onChange={(e) => {
                  setFeedUrl(e.target.value)
                  setPreviewFeed(null)
                  setAddError(null)
                }}
                placeholder="https://example.com/feed.xml"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              />
              <button
                onClick={handlePreviewFeed}
                disabled={previewing || !feedUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                解析
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {addError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{addError}</p>
            </div>
          )}

          {/* 预览信息 */}
          {previewFeed && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{previewFeed.title}</h4>
                  {previewFeed.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{previewFeed.description}</p>
                  )}
                  <p className="text-xs text-green-600 mt-2">找到 {previewFeed.itemCount} 篇文章</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowAddModal(false)
                setFeedUrl('')
                setPreviewFeed(null)
                setAddError(null)
              }}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddSubscription}
              disabled={adding || !previewFeed}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              订阅
            </button>
          </div>
        </div>
      </Modal>

      {/* 设置弹窗 */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="RSS 订阅设置"
        size="md"
      >
        <div className="space-y-6">
          {/* WeWe-RSS 配置 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">微信公众号订阅</h4>
                <p className="text-xs text-gray-500">通过 WeWe-RSS 服务订阅公众号</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">WeWe-RSS 服务地址</label>
                <input
                  type="text"
                  value={weweRssUrlInput}
                  onChange={(e) => {
                    setWeweRssUrlInput(e.target.value)
                    setWeweRssStatus('unknown')
                  }}
                  placeholder="https://xxx.zeabur.app"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">授权码 (Auth Code)</label>
                <input
                  type="password"
                  value={weweAuthCodeInput}
                  onChange={(e) => {
                    setWeweAuthCodeInput(e.target.value)
                    setWeweRssStatus('unknown')
                  }}
                  placeholder="你的 WeWe-RSS 授权码"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">添加公众号需要授权码，查看公众号列表不需要</p>
              </div>
              
              {weweRssStatus === 'connected' && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  连接成功
                </div>
              )}
              {weweRssStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  连接失败
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={handleTestWeweRss}
                  disabled={testingWeweRss || !weweRssUrlInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {testingWeweRss && <Loader2 className="w-3 h-3 animate-spin" />}
                  测试连接
                </button>
                <button
                  onClick={() => checkAccountStatus(weweRssUrlInput.trim(), weweAuthCodeInput.trim())}
                  disabled={checkingAccount || !weweRssUrlInput.trim() || !weweAuthCodeInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {checkingAccount && <Loader2 className="w-3 h-3 animate-spin" />}
                  检测账号
                </button>
                <button
                  onClick={handleSaveWeweRss}
                  disabled={savingWeweRss || !weweRssUrlInput.trim() || (weweRssUrlInput === weweRssUrl && weweAuthCodeInput === weweAuthCode)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {savingWeweRss ? '保存中...' : '保存'}
                </button>
              </div>
              
              {/* 账号状态显示 */}
              {accountStatus && accountStatus.connected && (
                <div className={`p-3 rounded-lg ${
                  accountStatus.needRelogin 
                    ? 'bg-red-50 border border-red-200' 
                    : accountStatus.invalidAccounts.length > 0 || accountStatus.blockedAccounts.length > 0
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {accountStatus.needRelogin ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : accountStatus.invalidAccounts.length > 0 || accountStatus.blockedAccounts.length > 0 ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      accountStatus.needRelogin 
                        ? 'text-red-700' 
                        : accountStatus.invalidAccounts.length > 0 || accountStatus.blockedAccounts.length > 0
                        ? 'text-amber-700'
                        : 'text-green-700'
                    }`}>
                      {accountStatus.message}
                    </span>
                  </div>
                  {accountStatus.needRelogin && (
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowAccountAlert(true)
                      }}
                      className="text-xs text-red-600 hover:underline mt-1"
                    >
                      查看详情并解决 →
                    </button>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-400">
                没有 WeWe-RSS？
                <a
                  href="https://github.com/cooderl/wewe-rss"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline ml-1"
                >
                  查看部署教程
                </a>
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>

      {/* 微信公众号弹窗 */}
      <Modal
        isOpen={showWechatModal}
        onClose={() => {
          setShowWechatModal(false)
          setWechatArticleUrl('')
          setWechatError(null)
        }}
        title="微信公众号订阅"
        size="lg"
      >
        <div className="space-y-4">
          {/* 添加公众号 */}
          <div className="p-4 bg-green-50 rounded-xl">
            <h4 className="text-sm font-medium text-gray-900 mb-2">添加公众号</h4>
            <p className="text-xs text-gray-500 mb-3">粘贴任意一篇该公众号的文章链接</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={wechatArticleUrl}
                onChange={(e) => {
                  setWechatArticleUrl(e.target.value)
                  setWechatError(null)
                }}
                placeholder="https://mp.weixin.qq.com/s/..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-green-500/20 outline-none transition-all text-sm"
              />
              <button
                onClick={handleAddWechatMp}
                disabled={addingWechat || !wechatArticleUrl.trim()}
                className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {addingWechat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                添加
              </button>
            </div>
            {wechatError && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {wechatError}
              </p>
            )}
            {!weweAuthCode && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                请先在设置中配置授权码才能添加公众号
              </p>
            )}
          </div>

          {/* 已订阅的公众号列表 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">已订阅的公众号</h4>
              <button
                onClick={handleSyncWewe}
                disabled={syncingWewe}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {syncingWewe ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                同步到本地
              </button>
            </div>
            
            {loadingMpList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-green-500" />
              </div>
            ) : wechatMpList.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                暂无订阅的公众号
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {wechatMpList.map((mp) => (
                  <div
                    key={mp.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {mp.mpCover ? (
                        <img src={mp.mpCover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <MessageCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 text-sm truncate">{mp.mpName}</h5>
                      {mp.mpIntro && (
                        <p className="text-xs text-gray-500 truncate">{mp.mpIntro}</p>
                      )}
                    </div>
                    <a
                      href={generateWeweRssUrl(weweRssUrl, mp.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Rss className="w-3 h-3" />
                      RSS
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setShowWechatModal(false)
                setWechatArticleUrl('')
                setWechatError(null)
              }}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Confirm
        isOpen={deleteConfirm.open}
        title="删除订阅"
        message="确定要删除这个订阅吗？"
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      {/* 同步结果提示 */}
      <Modal
        isOpen={syncResult.open}
        onClose={() => setSyncResult({ ...syncResult, open: false })}
        title={syncResult.success ? '同步完成' : '同步失败'}
        size="sm"
      >
        <div className="text-center py-4">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            syncResult.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {syncResult.success ? (
              <Check className="w-8 h-8 text-green-500" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          <p className="text-gray-700">{syncResult.message}</p>
          <button
            onClick={() => setSyncResult({ ...syncResult, open: false })}
            className={`mt-6 px-6 py-2.5 rounded-xl font-medium transition-colors ${
              syncResult.success 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            确定
          </button>
        </div>
      </Modal>

      {/* 账号失效提醒弹窗 */}
      <Modal
        isOpen={showAccountAlert}
        onClose={() => {
          setShowAccountAlert(false)
          setLoginQrCode(null)
          setLoginSuccess(false)
          setQrCodeError(null)
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }}
        title="⚠️ 微信读书账号失效"
        size="md"
      >
        <div className="space-y-4">
          {/* 登录成功提示 */}
          {loginSuccess ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                {syncingAll ? (
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                ) : (
                  <Check className="w-8 h-8 text-green-500" />
                )}
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                {syncingAll ? '正在同步文章...' : '登录成功！'}
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                {syncingAll 
                  ? '正在自动同步微信公众号文章到资源中心' 
                  : '微信读书账号已添加成功'}
              </p>
              {!syncingAll && (
                <button
                  onClick={() => {
                    setShowAccountAlert(false)
                    setLoginSuccess(false)
                  }}
                  className="px-6 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
                >
                  完成
                </button>
              )}
            </div>
          ) : loginQrCode ? (
            /* 二维码显示 */
            <div className="text-center">
              <div className="p-4 bg-white border-2 border-green-200 rounded-2xl inline-block mb-4">
                <QRCodeSVG 
                  value={loginQrCode.url} 
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-2">
                {checkingLoginResult && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                    <span>等待扫码登录...</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">
                请使用微信扫描二维码登录微信读书
              </p>
              {qrCodeError && (
                <p className="text-sm text-red-500 mb-4">{qrCodeError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setLoginQrCode(null)
                    if (pollingRef.current) {
                      clearInterval(pollingRef.current)
                      pollingRef.current = null
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={fetchLoginQrCode}
                  disabled={loadingQrCode}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingQrCode && <Loader2 className="w-4 h-4 animate-spin" />}
                  刷新二维码
                </button>
              </div>
            </div>
          ) : (
            /* 默认状态 */
            <>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-red-800 mb-1">
                      {accountStatus?.hasAccounts 
                        ? '微信读书账号已失效' 
                        : '没有微信读书账号'}
                    </h4>
                    <p className="text-sm text-red-700">
                      {accountStatus?.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* 账号列表 */}
              {accountStatus && accountStatus.accounts.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">账号状态</h5>
                  <div className="space-y-2">
                    {accountStatus.accounts.map((acc) => {
                      const isBlocked = accountStatus.blockedAccounts.includes(acc.id)
                      const isInvalid = acc.status === -1 || acc.status === 0
                      return (
                        <div
                          key={acc.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            isInvalid || isBlocked ? 'bg-red-50' : 'bg-green-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              isInvalid ? 'bg-red-500' : isBlocked ? 'bg-amber-500' : 'bg-green-500'
                            }`} />
                            <span className="text-sm font-medium text-gray-900">{acc.name}</span>
                            <span className="text-xs text-gray-500">({acc.id})</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isInvalid 
                              ? 'bg-red-100 text-red-600' 
                              : isBlocked 
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {isInvalid ? '已失效' : isBlocked ? '今日小黑屋' : '正常'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {qrCodeError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-700">{qrCodeError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAccountAlert(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                >
                  稍后处理
                </button>
                <button
                  onClick={fetchLoginQrCode}
                  disabled={loadingQrCode}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingQrCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  扫码添加账号
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
