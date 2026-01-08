// 悬浮卡片组件 - 深色背景提示框（无箭头）
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface HoverCardProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function HoverCard({ 
  content, 
  children, 
  className = '',
  delay = 300
}: HoverCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showCard = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        
        // 显示在元素上方，水平居中
        const top = rect.top - 8;
        const left = rect.left + rect.width / 2;
        
        setPosition({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideCard = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
      >
        {children}
      </div>
      
      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              ref={cardRef}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 10000,
              }}
              className="pointer-events-none"
            >
              <div className="bg-gray-800 text-white text-sm px-4 py-3 rounded-lg shadow-xl max-w-xs">
                <p className="leading-relaxed">{content}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default HoverCard;
