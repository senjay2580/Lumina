// AI 编辑器工具栏 - 简化为单个 AI 按钮
import React, { useState, useEffect } from 'react';
import { Settings, ChevronDown, Check } from 'lucide-react';
import { getStoredUser } from '../lib/auth';
import { hasEnabledProvider, getEnabledProviders, getDefaultProvider, setDefaultProvider, setDefaultModel, AIProvider } from '../lib/ai-providers';

interface AIEditorToolbarProps {
  isOpen: boolean;
  onToggle: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const AIEditorToolbar: React.FC<AIEditorToolbarProps> = ({
  isOpen,
  onToggle,
  loading = false,
  disabled = false,
}) => {
  const user = getStoredUser();
  const userId = user?.id || '';
  const [hasProvider, setHasProvider] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [defaultProviderData, setDefaultProviderData] = useState<AIProvider | null>(null);

  useEffect(() => {
    if (userId) {
      hasEnabledProvider(userId).then(setHasProvider);
      getEnabledProviders(userId).then(setProviders);
      getDefaultProvider(userId).then(setDefaultProviderData);
    }
  }, [userId]);

  const handleSelectModel = async (providerId: string, modelId: string) => {
    await setDefaultProvider(userId, providerId);
    await setDefaultModel(userId, providerId, modelId);
    // 刷新数据
    const newDefault = await getDefaultProvider(userId);
    setDefaultProviderData(newDefault);
    setShowSettings(false);
  };

  const displayName = defaultProviderData 
    ? `${defaultProviderData.name}${defaultProviderData.defaultModel ? ` / ${defaultProviderData.defaultModel}` : ''}`
    : '未选择模型';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
      <button
        onClick={onToggle}
        disabled={disabled || loading}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          isOpen 
            ? 'bg-primary text-white shadow-sm' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={isOpen ? '关闭 AI 助手' : '打开 AI 助手'}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path 
            d="M12 2L14.09 8.26L21 9.27L16 14.14L17.18 21.02L12 17.77L6.82 21.02L8 14.14L3 9.27L9.91 8.26L12 2Z" 
            fill={isOpen ? 'currentColor' : 'none'}
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
        AI 助手
        {isOpen && (
          <svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </button>

      {/* 设置按钮 */}
      <div className="relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          disabled={!hasProvider}
          className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-all ${
            hasProvider 
              ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title={hasProvider ? '选择模型' : '请先配置 AI 提供商'}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="max-w-[120px] truncate">{hasProvider ? displayName : '未配置'}</span>
          {hasProvider && <ChevronDown className="w-3 h-3" />}
        </button>

        {/* 下拉菜单 */}
        {showSettings && hasProvider && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
              {providers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">没有可用的提供商</div>
              ) : (
                providers.map(provider => (
                  <div key={provider.id}>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50">
                      {provider.name}
                    </div>
                    {provider.models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => handleSelectModel(provider.id, model.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="text-gray-700">{model.name || model.id}</span>
                        {defaultProviderData?.id === provider.id && defaultProviderData?.defaultModel === model.id && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 加载指示器 */}
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          处理中...
        </div>
      )}

      {/* 未配置提示 */}
      {!hasProvider && (
        <span className="text-xs text-amber-600">
          请先在设置中配置 AI 提供商
        </span>
      )}
    </div>
  );
};

export default AIEditorToolbar;
