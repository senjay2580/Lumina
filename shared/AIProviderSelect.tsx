// AI 提供商选择器组件
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Settings } from 'lucide-react';
import { 
  AIProvider, 
  getEnabledProviders, 
  getDefaultProvider,
  setDefaultProvider 
} from '../lib/ai-providers';
import { AIProviderIcon } from './AIProviderIcons';

interface AIProviderSelectProps {
  userId: string;
  value?: string; // provider id
  onChange?: (provider: AIProvider) => void;
  onOpenSettings?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showModels?: boolean;
  className?: string;
  placeholder?: string;
}

export const AIProviderSelect: React.FC<AIProviderSelectProps> = ({
  userId,
  value,
  onChange,
  onOpenSettings,
  size = 'md',
  showModels = false,
  className = '',
  placeholder = '选择 AI 模型'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载提供商列表
  useEffect(() => {
    const loadProviders = async () => {
      setLoading(true);
      try {
        const [enabledProviders, defaultProvider] = await Promise.all([
          getEnabledProviders(userId),
          getDefaultProvider(userId)
        ]);
        setProviders(enabledProviders);
        
        // 如果有指定值，使用指定值；否则使用默认值
        if (value) {
          const found = enabledProviders.find(p => p.id === value);
          setSelectedProvider(found || defaultProvider);
        } else {
          setSelectedProvider(defaultProvider);
        }
      } catch (err) {
        console.error('加载 AI 提供商失败:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      loadProviders();
    }
  }, [userId, value]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setIsOpen(false);
    onChange?.(provider);
  };

  const handleSetDefault = async (e: React.MouseEvent, provider: AIProvider) => {
    e.stopPropagation();
    await setDefaultProvider(userId, provider.id);
    // 更新本地状态
    setProviders(prev => prev.map(p => ({
      ...p,
      isDefault: p.id === provider.id
    })));
  };

  // 尺寸样式
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${sizeClasses[size]} bg-gray-100 rounded-lg text-gray-400 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        <span>加载中...</span>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <button
        onClick={onOpenSettings}
        className={`flex items-center gap-2 ${sizeClasses[size]} bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors ${className}`}
      >
        <Settings className={iconSizes[size]} />
        <span>配置 AI</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${sizeClasses[size]} bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all w-full`}
      >
        {selectedProvider ? (
          <>
            <div className="w-5 h-5 flex items-center justify-center">
              <AIProviderIcon providerKey={selectedProvider.providerKey} size={20} />
            </div>
            <span className="flex-1 text-left text-gray-900 truncate">
              {selectedProvider.name}
              {selectedProvider.defaultModel && (
                <span className="text-gray-500 ml-1">
                  · {selectedProvider.models.find(m => m.id === selectedProvider.defaultModel)?.name || selectedProvider.defaultModel}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <Settings className={`${iconSizes[size]} text-gray-400`} />
            <span className="flex-1 text-left text-gray-400">{placeholder}</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {providers.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleSelect(provider)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    selectedProvider?.id === provider.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <AIProviderIcon providerKey={provider.providerKey} size={24} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{provider.name}</span>
                      {provider.isDefault && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">默认</span>
                      )}
                    </div>
                    {showModels && provider.models.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {provider.models.map(m => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!provider.isDefault && (
                      <button
                        onClick={(e) => handleSetDefault(e, provider)}
                        className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="设为默认"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    )}
                    {selectedProvider?.id === provider.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {onOpenSettings && (
              <div className="border-t border-gray-100 p-2">
                <button
                  onClick={() => { setIsOpen(false); onOpenSettings(); }}
                  className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  管理 AI 配置
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 简化版：只显示当前选中的提供商（用于紧凑空间）
export const AIProviderBadge: React.FC<{
  provider: AIProvider | null;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ provider, onClick, size = 'sm' }) => {
  if (!provider) return null;
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-2.5 py-1.5 text-sm gap-2'
  };
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center ${sizeClasses[size]} bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors`}
    >
      <AIProviderIcon providerKey={provider.providerKey} size={16} />
      <span className="text-gray-700">{provider.name}</span>
    </button>
  );
};

export default AIProviderSelect;
