import React, { useState, useCallback } from 'react';
import { getStoredUser } from '../lib/auth';
import { preloadTrashData } from '../lib/usePreloadData';

export type ViewType = 'HOME' | 'WORKFLOW' | 'PROMPTS' | 'SETTINGS' | 'TRASH';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  username?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, collapsed = false, onCollapsedChange, username, onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const user = getStoredUser();

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapsedChange?.(newState);
  };

  // 预加载回收站数据（鼠标悬停时）
  const handleTrashHover = useCallback(() => {
    if (user?.id && currentView !== 'TRASH') {
      preloadTrashData(user.id);
    }
  }, [user?.id, currentView]);

  // 主导航项（不包含设置）
  const mainNavItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'HOME',
      label: '主页',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
    {
      id: 'WORKFLOW',
      label: '工作流',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
        </svg>
      )
    },
    {
      id: 'PROMPTS',
      label: '提示词',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    },
    {
      id: 'TRASH',
      label: '回收站',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      )
    }
  ];

  return (
    <aside 
      className={`relative flex flex-col shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-56'}`}
      style={{
        background: 'linear-gradient(180deg, rgba(255,107,0,0.03) 0%, rgba(255,255,255,0.8) 30%, rgba(147,197,253,0.05) 100%)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.6)',
        zIndex: 30
      }}
    >
      {/* 弥散光效 */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-24 h-24 bg-blue-400/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Logo */}
      <div className={`h-14 flex items-center gap-2.5 border-b border-white/40 relative z-10 ${isCollapsed ? 'px-3 justify-center' : 'px-4'}`}>
        <div className="w-8 h-8 shrink-0">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF8C00" />
                <stop offset="50%" stopColor="#FF6B00" />
                <stop offset="100%" stopColor="#E85D00" />
              </linearGradient>
              <linearGradient id="logoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFB347" />
                <stop offset="100%" stopColor="#FF6B00" />
              </linearGradient>
              <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g filter="url(#logoGlow)">
              <path fill="url(#logoGradient)" fillRule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clipRule="evenodd"/>
              <circle cx="12" cy="12" r="2.5" fill="url(#logoGradient2)" />
            </g>
          </svg>
        </div>
        {!isCollapsed && (
          <span className="text-xl text-primary" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700 }}>Lumina</span>
        )}
      </div>

      {/* 主导航 */}
      <nav className={`flex-1 py-4 space-y-1 relative z-10 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {mainNavItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => onViewChange(item.id)}
              onMouseEnter={item.id === 'TRASH' ? handleTrashHover : undefined}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                isCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
              } ${
                isActive 
                  ? 'bg-white/80 shadow-sm text-gray-900 backdrop-blur-sm' 
                  : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
              }`}
            >
              {isActive && !isCollapsed && <div className="w-1 h-5 bg-primary rounded-full -ml-1" />}
              <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
              {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* 收缩按钮 */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:shadow-lg transition-all z-50"
      >
        <svg 
          className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* 底部：设置 + 用户信息 */}
      <div className={`border-t border-white/40 relative z-10 ${isCollapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {/* 设置按钮 */}
        <button 
          onClick={() => onViewChange('SETTINGS')}
          title={isCollapsed ? '设置' : undefined}
          className={`w-full flex items-center gap-3 rounded-xl transition-all mb-3 ${
            isCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
          } ${
            currentView === 'SETTINGS' 
              ? 'bg-white/80 shadow-sm text-gray-900 backdrop-blur-sm' 
              : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
          }`}
        >
          {currentView === 'SETTINGS' && !isCollapsed && <div className="w-1 h-5 bg-primary rounded-full -ml-1" />}
          <span className={currentView === 'SETTINGS' ? 'text-primary' : ''}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          {!isCollapsed && <span className="font-medium text-sm">设置</span>}
        </button>

        {/* 用户信息 */}
        {username && (
          <div 
            className={`flex items-center gap-3 rounded-xl cursor-pointer hover:bg-white/50 transition-all ${
              isCollapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
            }`}
            onClick={onLogout}
            title={isCollapsed ? `${username} - 点击退出` : '点击退出登录'}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-sm font-medium shadow-sm shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{username}</p>
                <p className="text-xs text-gray-400">点击退出</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
