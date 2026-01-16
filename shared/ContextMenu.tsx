import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [isVisible, setIsVisible] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    // 先渲染但不可见，等计算完位置后再显示
    const adjustPosition = () => {
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8; // 距离视口边缘的最小距离
        
        let newX = x;
        let newY = y;
        
        // 水平方向：如果右边超出，向左调整
        if (x + rect.width > viewportWidth - padding) {
          newX = Math.max(padding, x - rect.width);
        }
        
        // 垂直方向：如果下方超出，向上弹出
        if (y + rect.height > viewportHeight - padding) {
          // 计算向上弹出的位置
          newY = y - rect.height;
          // 如果向上也超出，则贴近底部
          if (newY < padding) {
            newY = viewportHeight - rect.height - padding;
          }
        }
        
        // 确保不超出左边界和上边界
        newX = Math.max(padding, newX);
        newY = Math.max(padding, newY);
        
        setPosition({ x: newX, y: newY });
        setIsPositioned(true);
        requestAnimationFrame(() => setIsVisible(true));
      }
    };
    
    // 使用 requestAnimationFrame 确保 DOM 已渲染
    requestAnimationFrame(adjustPosition);
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ 
        left: position.x, 
        top: position.y,
        visibility: isPositioned ? 'visible' : 'hidden'
      }}
      className={`
        fixed z-50 min-w-[160px] py-1.5 bg-white rounded-xl shadow-xl border border-gray-100
        transition-all duration-150 origin-top-left
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
    >
      {items.map((item, index) => (
        item.divider ? (
          <div key={index} className="my-1.5 border-t border-gray-100" />
        ) : (
          <button
            key={index}
            onClick={() => { item.onClick(); onClose(); }}
            className={`
              w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors
              ${item.danger 
                ? 'text-red-500 hover:bg-red-50' 
                : 'text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            {item.icon && <span className="w-4 h-4 opacity-60">{item.icon}</span>}
            {item.label}
          </button>
        )
      ))}
    </div>
  );
};

// Hook for context menu
export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  data?: any;
}

export const useContextMenu = () => {
  const [state, setState] = useState<ContextMenuState>({ isOpen: false, x: 0, y: 0 });

  const open = (e: React.MouseEvent, data?: any) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ isOpen: true, x: e.clientX, y: e.clientY, data });
  };

  const close = () => setState({ isOpen: false, x: 0, y: 0, data: undefined });

  return { ...state, open, close };
};
