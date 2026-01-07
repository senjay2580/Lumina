// 资源/文件夹操作菜单组件 - 组合模式统一处理
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  MoreHorizontal,
  ExternalLink,
  Edit3,
  Copy,
  Download,
  Archive,
  ArchiveRestore,
  Trash2,
  FolderOutput,
  Check
} from 'lucide-react';

// 菜单项类型
export interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

interface ResourceItemMenuProps {
  items: MenuItem[];
  trigger?: 'button' | 'context'; // 触发方式
  buttonClassName?: string;
  dark?: boolean;
}

export function ResourceItemMenu({
  items,
  trigger = 'button',
  buttonClassName,
  dark = false
}: ResourceItemMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // 计算菜单位置
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // 估算菜单高度
      const visibleItems = items.filter(i => !i.hidden);
      const menuHeight = visibleItems.length * 36 + 16;
      const menuWidth = 140;
      
      let top = rect.bottom + 4;
      let left = rect.right - menuWidth;
      
      // 如果下方空间不够，显示在上方
      if (top + menuHeight > viewportHeight - 8) {
        top = rect.top - menuHeight - 4;
      }
      
      // 确保不超出左边界
      if (left < 8) {
        left = 8;
      }
      
      // 确保不超出右边界
      if (left + menuWidth > viewportWidth - 8) {
        left = viewportWidth - menuWidth - 8;
      }
      
      setMenuPosition({ top, left });
    }
  }, [showMenu, items]);

  const visibleItems = items.filter(i => !i.hidden);
  if (visibleItems.length === 0) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className={buttonClassName || `p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
          dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
        }`}
      >
        <MoreHorizontal className={`w-4 h-4 ${dark ? 'text-gray-400' : 'text-gray-400'}`} />
      </button>
      
      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleItems.map((item, index) => (
              <React.Fragment key={item.key}>
                {item.danger && index > 0 && (
                  <div className="border-t border-gray-100 my-1" />
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); item.onClick(); }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    item.danger 
                      ? 'text-red-500 hover:bg-red-50' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
}

// 右键菜单组件
interface ContextMenuProps {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = position.x;
      let y = position.y;
      
      if (x + rect.width > viewportWidth - 8) {
        x = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight - 8) {
        y = viewportHeight - rect.height - 8;
      }
      
      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const visibleItems = items.filter(i => !i.hidden);

  return createPortal(
    <>
      <div 
        className="fixed inset-0 z-[9998]" 
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ position: 'fixed', top: adjustedPosition.y, left: adjustedPosition.x }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-[9999] min-w-[140px]"
      >
        {visibleItems.map((item, index) => (
          <React.Fragment key={item.key}>
            {item.danger && index > 0 && (
              <div className="border-t border-gray-100 my-1" />
            )}
            <button 
              onClick={() => { onClose(); item.onClick(); }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                item.danger 
                  ? 'text-red-500 hover:bg-red-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          </React.Fragment>
        ))}
      </motion.div>
    </>,
    document.body
  );
}

// 预定义的菜单项生成器
export const menuItemGenerators = {
  open: (onClick: () => void): MenuItem => ({
    key: 'open',
    label: '打开',
    icon: <ExternalLink className="w-3.5 h-3.5" />,
    onClick
  }),
  
  edit: (onClick: () => void): MenuItem => ({
    key: 'edit',
    label: '编辑',
    icon: <Edit3 className="w-3.5 h-3.5" />,
    onClick
  }),
  
  rename: (onClick: () => void): MenuItem => ({
    key: 'rename',
    label: '重命名',
    icon: <Edit3 className="w-3.5 h-3.5" />,
    onClick
  }),
  
  copy: (onClick: () => void, copied?: boolean): MenuItem => ({
    key: 'copy',
    label: copied ? '已复制' : '复制',
    icon: copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />,
    onClick
  }),
  
  download: (onClick: () => void): MenuItem => ({
    key: 'download',
    label: '下载',
    icon: <Download className="w-3.5 h-3.5" />,
    onClick
  }),
  
  moveOut: (onClick: () => void): MenuItem => ({
    key: 'moveOut',
    label: '移出文件夹',
    icon: <FolderOutput className="w-3.5 h-3.5" />,
    onClick
  }),
  
  archive: (onClick: () => void, isArchived: boolean): MenuItem => ({
    key: 'archive',
    label: isArchived ? '取消归档' : '归档',
    icon: isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />,
    onClick
  }),
  
  delete: (onClick: () => void): MenuItem => ({
    key: 'delete',
    label: '删除',
    icon: <Trash2 className="w-3.5 h-3.5" />,
    onClick,
    danger: true
  })
};

export default ResourceItemMenu;
