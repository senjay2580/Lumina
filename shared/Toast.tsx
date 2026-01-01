import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const styles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-green-50', icon: 'text-green-500', border: 'border-green-100' },
  error: { bg: 'bg-red-50', icon: 'text-red-500', border: 'border-red-100' },
  warning: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-100' },
  info: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-100' },
};

export const Toast: React.FC<ToastProps> = ({ id, type, message, duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const style = styles[type];

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose(id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-out min-w-[280px] max-w-[400px]
        ${style.bg} ${style.border}
        ${isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <div className={`shrink-0 ${style.icon}`}>{icons[type]}</div>
      <p className="flex-1 text-sm text-gray-700 font-medium">{message}</p>
      <button
        onClick={() => { setIsLeaving(true); setTimeout(() => onClose(id), 300); }}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 text-gray-400 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

// Toast Container
export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onRemove} />
      ))}
    </div>
  );
};
