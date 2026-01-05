import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkflowEditor } from './components/WorkflowEditor';
import { PromptManager, PromptBrowserWindow } from './components/PromptManager';
import { HomePage } from './components/HomePage';
import { SettingsPage } from './components/SettingsPage';
import { TrashPage } from './components/TrashPage';
import PromptCrawlerPage from './components/PromptCrawlerPage';
import { Sidebar, ViewType } from './components/Sidebar';
import { AuthPage } from './components/AuthPage';
import { User, clearUser, validateStoredUser, getStoredUser } from './lib/auth';
import { usePreloadData } from './lib/usePreloadData';
import { clearUserCache } from './lib/cache';
import { usePromptBrowser } from './lib/usePromptBrowser';
import { Confirm, Modal, ToastContainer, useToast } from './shared';
import * as promptApi from './lib/prompts';

// 路由映射
const VIEW_ROUTES: Record<ViewType, string> = {
  HOME: '',
  WORKFLOW: 'workflow',
  PROMPTS: 'prompts',
  CRAWLER: 'crawler',
  SETTINGS: 'settings',
  TRASH: 'trash',
};

const ROUTE_VIEWS: Record<string, ViewType> = {
  '': 'HOME',
  'workflow': 'WORKFLOW',
  'prompts': 'PROMPTS',
  'crawler': 'CRAWLER',
  'settings': 'SETTINGS',
  'trash': 'TRASH',
};

// 解析 URL hash
const parseHash = (): { view: ViewType; workflowId?: string } => {
  const hash = window.location.hash.slice(1); // 移除 #
  const [route, id] = hash.split('/');
  const view = ROUTE_VIEWS[route] || 'HOME';
  return { view, workflowId: view === 'WORKFLOW' ? id : undefined };
};

// 更新 URL hash
const updateHash = (view: ViewType, workflowId?: string) => {
  const route = VIEW_ROUTES[view];
  const hash = view === 'WORKFLOW' && workflowId ? `${route}/${workflowId}` : route;
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('HOME');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [workflowHasUnsaved, setWorkflowHasUnsaved] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ view: ViewType; workflowId?: string } | null>(null);
  const [unsavedConfirm, setUnsavedConfirm] = useState<{ open: boolean; promptId: string | null; action: 'close' | 'closeAll' }>({ open: false, promptId: null, action: 'close' });

  // 角色库标签页状态
  const [showRoleLibrary, setShowRoleLibrary] = useState(false); // 角色库 tab 是否存在
  const [isRoleLibraryActive, setIsRoleLibraryActive] = useState(false); // 角色库内容是否激活显示

  // 全局提示词浏览器状态
  const promptBrowser = usePromptBrowser();
  const toast = useToast();

  // 监听打开角色库事件
  useEffect(() => {
    const handleOpenRoleLibrary = () => {
      setShowRoleLibrary(true);
      setIsRoleLibraryActive(true);
      promptBrowser.setIsBrowserMinimized(false);
    };
    window.addEventListener('open-role-library', handleOpenRoleLibrary);
    return () => window.removeEventListener('open-role-library', handleOpenRoleLibrary);
  }, [promptBrowser]);

  // 预加载数据
  usePreloadData(user?.id);

  // 初始化时从 URL 读取路由
  useEffect(() => {
    const { view, workflowId } = parseHash();
    setCurrentView(view);
    setSelectedWorkflowId(workflowId);
  }, []);

  // 监听浏览器前进/后退
  useEffect(() => {
    const handleHashChange = () => {
      const { view, workflowId } = parseHash();
      // 如果有未保存的更改，阻止导航
      if (currentView === 'WORKFLOW' && workflowHasUnsaved && view !== 'WORKFLOW') {
        setPendingNavigation({ view, workflowId });
        // 恢复原来的 hash
        updateHash(currentView, selectedWorkflowId);
        return;
      }
      setCurrentView(view);
      setSelectedWorkflowId(workflowId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentView, workflowHasUnsaved, selectedWorkflowId]);

  useEffect(() => {
    // 验证存储的用户是否在数据库中存在
    const checkUser = async () => {
      const validUser = await validateStoredUser();
      setUser(validUser);
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = () => {
    // 清除用户缓存
    if (user?.id) {
      clearUserCache(user.id);
    }
    clearUser();
    setUser(null);
    setShowLogoutConfirm(false);
  };

  const handleOpenWorkflow = (workflowId: string) => {
    // 如果当前在工作流编辑器且有未保存的更改，先确认
    if (currentView === 'WORKFLOW' && workflowHasUnsaved && workflowId !== selectedWorkflowId) {
      setPendingNavigation({ view: 'WORKFLOW', workflowId });
      return;
    }
    setSelectedWorkflowId(workflowId);
    setCurrentView('WORKFLOW');
    updateHash('WORKFLOW', workflowId);
  };

  const handleNavigate = (view: ViewType) => {
    // 如果当前在工作流编辑器且有未保存的更改，先确认
    if (currentView === 'WORKFLOW' && workflowHasUnsaved && view !== 'WORKFLOW') {
      setPendingNavigation({ view });
      return;
    }
    if (view !== 'WORKFLOW') {
      setSelectedWorkflowId(undefined);
    }
    setCurrentView(view);
    updateHash(view, view === 'WORKFLOW' ? selectedWorkflowId : undefined);
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      if (pendingNavigation.view !== 'WORKFLOW') {
        setSelectedWorkflowId(undefined);
      } else if (pendingNavigation.workflowId) {
        setSelectedWorkflowId(pendingNavigation.workflowId);
      }
      setCurrentView(pendingNavigation.view);
      updateHash(pendingNavigation.view, pendingNavigation.workflowId);
      setWorkflowHasUnsaved(false);
      setPendingNavigation(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 animate-pulse">
            <svg className="w-full h-full" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="loadingLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF8C00" />
                  <stop offset="50%" stopColor="#FF6B00" />
                  <stop offset="100%" stopColor="#E85D00" />
                </linearGradient>
                <linearGradient id="loadingLogoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFB347" />
                  <stop offset="100%" stopColor="#FF6B00" />
                </linearGradient>
              </defs>
              <path fill="url(#loadingLogoGradient)" fillRule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clipRule="evenodd"/>
              <circle cx="12" cy="12" r="2.5" fill="url(#loadingLogoGradient2)" />
            </svg>
          </div>
          <p className="text-subtext">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen w-full text-text overflow-hidden font-sans selection:bg-primary selection:text-white"
      style={{
        background: 'linear-gradient(135deg, #FDFCF8 0%, #FFF9F5 25%, #FDFCF8 50%, #F8FAFF 75%, #FDFCF8 100%)'
      }}
    >
      {/* 弥散光效背景 */}
      <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/8 to-orange-300/5 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="absolute top-[30%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-bl from-blue-400/6 to-purple-300/4 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-gradient-to-tr from-green-300/5 to-cyan-300/3 rounded-full blur-[80px] pointer-events-none" />

      <Sidebar 
        currentView={currentView} 
        onViewChange={handleNavigate} 
        username={user.username}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {currentView === 'HOME' && <HomePage username={user.username} onNavigate={handleNavigate} onOpenWorkflow={handleOpenWorkflow} />}
          {currentView === 'WORKFLOW' && <WorkflowEditor onBack={() => handleNavigate('HOME')} workflowId={selectedWorkflowId} onUnsavedChange={setWorkflowHasUnsaved} />}
          {currentView === 'PROMPTS' && <PromptManager promptBrowser={promptBrowser} />}
          {currentView === 'CRAWLER' && <PromptCrawlerPage userId={user.id} />}
          {currentView === 'SETTINGS' && <SettingsPage user={user} onUserUpdate={setUser} />}
          {currentView === 'TRASH' && <TrashPage />}
        </div>
      </main>

      {/* 全局提示词任务栏 - 居中底部 */}
      <AnimatePresence>
        {promptBrowser.isBrowserMinimized && (promptBrowser.browserTabs.length > 0 || showRoleLibrary) && (
          <motion.button
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => promptBrowser.setIsBrowserMinimized(false)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-gray-900/95 backdrop-blur-sm hover:bg-gray-800 rounded-xl shadow-lg border border-gray-700 z-[60]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* 角色库指示 */}
            {showRoleLibrary && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-gray-700 flex items-center justify-center">
                  <span className="text-xs">🎭</span>
                </div>
                <span className="text-sm text-gray-300 font-medium">角色库</span>
              </div>
            )}
            {/* 分隔线 */}
            {showRoleLibrary && promptBrowser.browserTabs.length > 0 && (
              <div className="w-px h-4 bg-gray-600" />
            )}
            {/* 提示词指示 */}
            {promptBrowser.browserTabs.length > 0 && (
              <div className="flex items-center gap-2">
                <motion.div 
                  className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </motion.div>
                <span className="text-sm text-gray-300 font-medium">Prompts</span>
                <span className="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">{promptBrowser.browserTabs.length}</span>
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* 全局提示词浏览器窗口 */}
      <AnimatePresence>
        {(promptBrowser.browserTabs.length > 0 || showRoleLibrary) && !promptBrowser.isBrowserMinimized && (
          <PromptBrowserWindow
            key="global-prompt-browser"
            tabs={promptBrowser.browserTabs}
            activeTabId={promptBrowser.activeTabId}
            categories={promptBrowser.categories}
            autoEditId={promptBrowser.autoEditId}
            unsavedIds={new Set([...promptBrowser.newPromptIds, ...promptBrowser.editedPromptIds])}
            isMinimizing={promptBrowser.isMinimizing}
            showRoleLibrary={showRoleLibrary}
            isRoleLibraryActive={isRoleLibraryActive}
            onRoleLibraryTabClick={() => setIsRoleLibraryActive(true)}
            onTabChange={(id) => {
              setIsRoleLibraryActive(false); // 切换到提示词 tab 时，取消角色库激活状态
              promptBrowser.setActiveTabId(id);
            }}
            onTabClose={(promptId, e) => {
              e?.stopPropagation();
              if (promptBrowser.newPromptIds.has(promptId) || promptBrowser.editedPromptIds.has(promptId)) {
                setUnsavedConfirm({ open: true, promptId, action: 'close' });
                return;
              }
              promptBrowser.closeTab(promptId);
            }}
            onMinimize={promptBrowser.handleMinimize}
            onClose={() => {
              const hasUnsaved = promptBrowser.browserTabs.some(t => 
                promptBrowser.newPromptIds.has(t.id) || promptBrowser.editedPromptIds.has(t.id)
              );
              if (hasUnsaved) {
                setUnsavedConfirm({ open: true, promptId: null, action: 'closeAll' });
                return;
              }
              promptBrowser.clearAllTabs();
              setShowRoleLibrary(false); // 同时关闭角色库
              setIsRoleLibraryActive(false);
            }}
            onCloseRoleLibrary={() => {
              setShowRoleLibrary(false);
              setIsRoleLibraryActive(false);
              // 如果有其他标签页，切换到第一个提示词标签页
              if (promptBrowser.browserTabs.length > 0) {
                promptBrowser.setActiveTabId(promptBrowser.browserTabs[0].id);
              }
            }}
            onSave={async (prompt, data) => {
              const storedUser = getStoredUser();
              const userId = storedUser?.id || '';
              try {
                if (promptBrowser.newPromptIds.has(prompt.id)) {
                  const created = await promptApi.createPrompt(userId, data);
                  promptBrowser.updateTabPrompt(prompt.id, created);
                  promptBrowser.removeNewPromptId(prompt.id);
                  promptBrowser.notifyPromptCreated(created); // 通知列表新增
                  toast.success('提示词已创建');
                } else {
                  const updated = await promptApi.updatePrompt(prompt.id, data);
                  promptBrowser.updateTabPrompt(prompt.id, updated);
                  promptBrowser.removeEditedPromptId(prompt.id); // 清除编辑状态
                  promptBrowser.notifyPromptUpdated(updated); // 通知列表更新
                  toast.success('提示词已更新');
                }
              } catch (err: any) {
                toast.error(err.message || '保存失败');
              }
            }}
            onCopy={async (content, promptId) => {
              try {
                // 从 HTML 中提取纯文本
                const tmp = document.createElement('div');
                tmp.innerHTML = content;
                const plainText = tmp.textContent || tmp.innerText || content;
                await navigator.clipboard.writeText(plainText);
                toast.success('已复制到剪贴板');
                
                // 记录复制次数（仅对已保存的提示词）
                const storedUser = getStoredUser();
                if (storedUser?.id && promptId && !promptId.startsWith('temp_')) {
                  promptApi.logPromptCopy(promptId, storedUser.id);
                }
              } catch {
                toast.error('复制失败');
              }
            }}
            onClearAutoEdit={() => promptBrowser.setAutoEditId(null)}
            onEditStateChange={(promptId, hasChanges) => {
              if (hasChanges) {
                promptBrowser.addEditedPromptId(promptId);
              } else {
                promptBrowser.removeEditedPromptId(promptId);
              }
            }}
            getCategoryName={(id) => id ? promptBrowser.categories.find(c => c.id === id)?.name || '未分类' : '未分类'}
            getCategoryColor={(id) => id ? promptBrowser.categories.find(c => c.id === id)?.color || 'gray' : 'gray'}
          />
        )}
      </AnimatePresence>

      {/* 未保存确认对话框 */}
      <Modal isOpen={unsavedConfirm.open} onClose={() => setUnsavedConfirm({ open: false, promptId: null, action: 'close' })} title="未保存的更改">
        <p className="text-gray-600 mb-6">你有未保存的更改，确定要放弃吗？</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setUnsavedConfirm({ open: false, promptId: null, action: 'close' })} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">取消</button>
          <button onClick={() => {
            if (unsavedConfirm.action === 'closeAll') {
              promptBrowser.clearAllTabs();
            } else if (unsavedConfirm.promptId) {
              promptBrowser.closeTab(unsavedConfirm.promptId);
            }
            setUnsavedConfirm({ open: false, promptId: null, action: 'close' });
          }} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">放弃</button>
        </div>
      </Modal>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <Confirm
        isOpen={showLogoutConfirm}
        title="退出登录"
        message="确定要退出当前账号吗？"
        confirmText="退出"
        cancelText="取消"
        danger
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <Confirm
        isOpen={!!pendingNavigation}
        title="未保存的更改"
        message="工作流有未保存的更改，确定要离开吗？"
        confirmText="放弃"
        cancelText="取消"
        danger
        onConfirm={confirmNavigation}
        onCancel={() => setPendingNavigation(null)}
      />
    </div>
  );
};

export default App;
