import React from 'react';

interface NavigationProps {
  currentView: 'WORKFLOW' | 'PROMPTS';
  onViewChange: (view: 'WORKFLOW' | 'PROMPTS') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  const navItems = [
    { id: 'WORKFLOW', label: 'Workflow', icon: '#icon-workflow' },
    { id: 'PROMPTS', label: 'Prompts', icon: '#icon-prompt' },
  ];

  return (
    <nav className="w-20 lg:w-64 glass-panel border-r border-white/40 flex flex-col py-6 gap-2 shrink-0 transition-all duration-300">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as any)}
            className={`
              relative flex items-center gap-3 px-4 py-3 mx-3 rounded-xl transition-all duration-300 group
              ${isActive ? 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'hover:bg-white/40'}
            `}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}
            <svg className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-subtext group-hover:text-text'}`}>
              <use href={item.icon} />
            </svg>
            <span className={`hidden lg:block font-medium ${isActive ? 'text-text' : 'text-subtext group-hover:text-text'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};