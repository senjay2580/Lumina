import React, { useState } from 'react';

export type ViewType = 'HOME' | 'WORKFLOW' | 'PROMPTS' | 'SETTINGS';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, collapsed = false, onCollapsedChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapsedChange?.(newState);
  };

  const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
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
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
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
      id: 'SETTINGS',
      label: '设置',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
      
      <div className={`h-14 flex items-center gap-3 border-b border-white/40 relative z-10 ${isCollapsed ? 'px-3 justify-center' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
          <svg className="w-5 h-5"><use href="#icon-logo" /></svg>
        </div>
        {!isCollapsed && (
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Lumina</span>
        )}
      </div>

      <nav className={`flex-1 py-4 space-y-1 relative z-10 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => onViewChange(item.id)}
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

      <div className={`p-4 border-t border-white/40 relative z-10 ${isCollapsed ? 'hidden' : ''}`}>
        <p className="text-[10px] text-gray-400 text-center">Lumina v1.0</p>
      </div>
    </aside>
  );
};
