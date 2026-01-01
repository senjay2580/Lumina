import React, { useState, useEffect, useCallback } from 'react';
import { User, updateUsername, updatePassword, saveUser } from '../lib/auth';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { 
  getProviderTemplates, 
  getUserProviders, 
  saveUserProvider,
  AIProviderTemplate,
  AIProvider 
} from '../lib/ai-providers';

interface SettingsPageProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

// 颜色映射
const colorMap: Record<string, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  gray: 'bg-gray-500',
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUserUpdate }) => {
  const [username, setUsername] = useState(user.username);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // AI 提供商状态
  const [providerTemplates, setProviderTemplates] = useState<AIProviderTemplate[]>([]);
  const [userProviders, setUserProviders] = useState<Map<string, AIProvider>>(new Map());
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  
  // 编辑中的配置
  const [editingConfigs, setEditingConfigs] = useState<Record<string, { apiKey: string; baseUrl: string; enabled: boolean }>>({});
  
  const { toasts, removeToast, success, error } = useToast();

  // 加载 AI 提供商模板和用户配置
  useEffect(() => {
    const loadProviders = async () => {
      setLoadingProviders(true);
      try {
        const [templates, userConfigs] = await Promise.all([
          getProviderTemplates(),
          getUserProviders(user.id),
        ]);
        setProviderTemplates(templates);
        
        // 转换为 Map 方便查找
        const configMap = new Map<string, AIProvider>();
        userConfigs.forEach(c => configMap.set(c.providerKey, c));
        setUserProviders(configMap);
        
        // 初始化编辑状态
        const editConfigs: Record<string, { apiKey: string; baseUrl: string; enabled: boolean }> = {};
        templates.forEach(t => {
          const userConfig = configMap.get(t.providerKey);
          editConfigs[t.providerKey] = {
            apiKey: userConfig?.apiKey || '',
            baseUrl: userConfig?.baseUrl || t.baseUrl || '',
            enabled: userConfig?.isEnabled || false,
          };
        });
        setEditingConfigs(editConfigs);
      } catch (err) {
        console.error('加载 AI 配置失败:', err);
      } finally {
        setLoadingProviders(false);
      }
    };
    loadProviders();
  }, [user.id]);

  // 更新编辑中的配置
  const updateEditingConfig = useCallback((providerKey: string, key: string, value: string | boolean) => {
    setEditingConfigs(prev => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [key]: value,
      },
    }));
  }, []);

  // 保存 AI 提供商配置
  const handleSaveProvider = useCallback(async (providerKey: string) => {
    const template = providerTemplates.find(t => t.providerKey === providerKey);
    if (!template) return;
    
    const config = editingConfigs[providerKey];
    setSavingProvider(providerKey);
    
    try {
      const saved = await saveUserProvider(user.id, providerKey, {
        name: template.name,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        models: template.models,
      });
      
      if (saved) {
        setUserProviders(prev => new Map(prev).set(providerKey, saved));
        setEditingConfigs(prev => ({
          ...prev,
          [providerKey]: {
            ...prev[providerKey],
            enabled: saved.isEnabled,
          },
        }));
        success(`${template.name} 配置已保存`);
      }
    } catch (err: any) {
      error(err.message || '保存失败');
    } finally {
      setSavingProvider(null);
    }
  }, [user.id, providerTemplates, editingConfigs, success, error]);

  // 切换显示 API Key
  const toggleShowApiKey = (providerKey: string) => {
    setShowApiKey(prev => ({ ...prev, [providerKey]: !prev[providerKey] }));
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username === user.username) return;
    
    setSavingUsername(true);
    try {
      const updated = await updateUsername(user.id, username);
      saveUser(updated);
      onUserUpdate(updated);
      success('用户名已更新');
    } catch (err: any) {
      error(err.message || '更新失败');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      error('两次输入的密码不一致');
      return;
    }
    
    setSavingPassword(true);
    try {
      await updatePassword(user.id, oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success('密码已更新');
    } catch (err: any) {
      error(err.message || '更新失败');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* 页面标题 */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center shadow-sm">
              <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">设置</h1>
              <p className="text-gray-500 mt-1">管理你的账户和偏好设置</p>
            </div>
          </div>
        </div>

        {/* 用户信息卡片 */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-orange-50 border border-primary/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
              <p className="text-sm text-gray-500 mt-1">
                加入于 {new Date(user.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* 设置卡片容器 */}
        <div className="space-y-6">
          {/* 用户名设置 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">用户名</h3>
                  <p className="text-xs text-gray-500">修改你的显示名称</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleUpdateUsername} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">当前用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                  placeholder="输入新用户名"
                />
              </div>
              <button
                type="submit"
                disabled={savingUsername || username === user.username}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  savingUsername || username === user.username
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5'
                }`}
              >
                {savingUsername ? '保存中...' : '保存更改'}
              </button>
            </form>
          </div>

          {/* 密码设置 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">安全设置</h3>
                  <p className="text-xs text-gray-500">更新你的登录密码</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                  placeholder="输入当前密码"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                    placeholder="至少6位"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                    placeholder="再次输入"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  savingPassword || !oldPassword || !newPassword || !confirmPassword
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5'
                }`}
              >
                {savingPassword ? '更新中...' : '更新密码'}
              </button>
            </form>
          </div>

          {/* AI API 配置 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI 模型配置</h3>
                  <p className="text-xs text-gray-500">配置各 AI 厂商的 API Key</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {loadingProviders ? (
                <div className="px-6 py-8 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-gray-500">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                    </svg>
                    <span className="text-sm">加载配置中...</span>
                  </div>
                </div>
              ) : providerTemplates.map((template) => {
                const config = editingConfigs[template.providerKey] || { apiKey: '', baseUrl: '', enabled: false };
                const userConfig = userProviders.get(template.providerKey);
                const isExpanded = expandedProvider === template.providerKey;
                const isConfigured = userConfig?.isEnabled;
                const bgColor = colorMap[template.color] || 'bg-gray-500';
                
                return (
                  <div key={template.providerKey} className="overflow-hidden">
                    {/* 厂商头部 */}
                    <button
                      onClick={() => setExpandedProvider(isExpanded ? null : template.providerKey)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center text-white`}>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{template.name}</span>
                            {isConfigured && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded">已配置</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {template.models.length > 0 
                              ? template.models.map(m => m.name).join(', ')
                              : '自定义模型服务'
                            }
                          </p>
                        </div>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    
                    {/* 配置表单 */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-gray-50/50 space-y-4">
                        {/* API Key */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                          <div className="relative">
                            <input
                              type={showApiKey[template.providerKey] ? 'text' : 'password'}
                              value={config.apiKey}
                              onChange={(e) => updateEditingConfig(template.providerKey, 'apiKey', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all pr-12"
                              placeholder="sk-..."
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowApiKey(template.providerKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                            >
                              {showApiKey[template.providerKey] ? (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {/* Base URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Base URL (可选)</label>
                          <input
                            type="text"
                            value={config.baseUrl}
                            onChange={(e) => updateEditingConfig(template.providerKey, 'baseUrl', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                            placeholder={template.baseUrl || 'https://api.example.com/v1'}
                          />
                        </div>
                        
                        {/* 保存按钮 */}
                        <button
                          onClick={() => handleSaveProvider(template.providerKey)}
                          disabled={savingProvider === template.providerKey}
                          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingProvider === template.providerKey ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                              </svg>
                              保存中...
                            </>
                          ) : '保存配置'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 关于 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">关于</h3>
                  <p className="text-xs text-gray-500">应用信息</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">版本</span>
                <span className="text-gray-900 font-medium">1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-600">构建</span>
                <span className="text-gray-900 font-medium">2026.01.02</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
