import React, { useState, useEffect } from 'react';
import { WorkflowEditor } from './components/WorkflowEditor';
import { PromptManager } from './components/PromptManager';
import { HomePage } from './components/HomePage';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar, ViewType } from './components/Sidebar';
import { AuthPage } from './components/AuthPage';
import { User, clearUser, validateStoredUser } from './lib/auth';
import { Confirm } from './shared';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('HOME');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [workflowHasUnsaved, setWorkflowHasUnsaved] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ view: ViewType; workflowId?: string } | null>(null);

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
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      if (pendingNavigation.view !== 'WORKFLOW') {
        setSelectedWorkflowId(undefined);
      } else if (pendingNavigation.workflowId) {
        setSelectedWorkflowId(pendingNavigation.workflowId);
      }
      setCurrentView(pendingNavigation.view);
      setWorkflowHasUnsaved(false);
      setPendingNavigation(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white shadow-lg shadow-primary/30 animate-pulse">
            <svg className="w-7 h-7"><use href="#icon-logo" /></svg>
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

      <Sidebar currentView={currentView} onViewChange={handleNavigate} />

      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        {currentView !== 'WORKFLOW' && (
          <header className="h-14 flex items-center justify-end px-4 glass-panel border-b border-white/40 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <span className="text-xs text-subtext">{user.username}</span>
              <button onClick={() => setShowLogoutConfirm(true)} className="px-3 py-1.5 rounded-lg bg-white/50 hover:bg-white text-xs font-medium text-subtext hover:text-text transition-all">
                退出
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-hidden">
          {currentView === 'HOME' && <HomePage username={user.username} onNavigate={handleNavigate} onOpenWorkflow={handleOpenWorkflow} />}
          {currentView === 'WORKFLOW' && <WorkflowEditor onBack={() => handleNavigate('HOME')} workflowId={selectedWorkflowId} onUnsavedChange={setWorkflowHasUnsaved} />}
          {currentView === 'PROMPTS' && <PromptManager />}
          {currentView === 'SETTINGS' && <SettingsPage user={user} onUserUpdate={setUser} />}
        </div>
      </main>

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
