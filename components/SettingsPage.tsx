import React, { useState, useEffect, useCallback } from 'react';
import { User, updateUsername, updatePassword, saveUser, updateEmail, requestEmailVerification, verifyEmail, validateEmail, resendEmailChangeVerification } from '../lib/auth';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { VerificationInput } from '../shared/VerificationInput';
import { AIProviderIcon } from '../shared/AIProviderIcons';
import { 
  getProviderTemplates, 
  getUserProviders, 
  saveUserProvider,
  setDefaultProvider,
  AIProviderTemplate,
  AIProvider 
} from '../lib/ai-providers';
import {
  getFeishuBindingFromDB,
  generateFeishuBindCode,
  unbindFeishu,
  FeishuBindingStatus,
  FeishuBindCode,
} from '../lib/feishu';

interface SettingsPageProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

// 设置分类标签
type SettingsTab = 'account' | 'ai' | 'integrations' | 'about';

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [username, setUsername] = useState(user.username);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // 邮箱管理状态
  const [emailMode, setEmailMode] = useState<'view' | 'change' | 'verify'>('view');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);

  // AI 提供商状态
  const [providerTemplates, setProviderTemplates] = useState<AIProviderTemplate[]>([]);
  const [userProviders, setUserProviders] = useState<Map<string, AIProvider>>(new Map());
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  
  // 编辑中的配置
  const [editingConfigs, setEditingConfigs] = useState<Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isDefault: boolean; defaultModel: string }>>({});
  
  // 飞书绑定状态
  const [feishuBinding, setFeishuBinding] = useState<FeishuBindingStatus | null>(null);
  const [feishuBindCode, setFeishuBindCode] = useState<FeishuBindCode | null>(null);
  const [loadingFeishu, setLoadingFeishu] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unbindingFeishu, setUnbindingFeishu] = useState(false);
  const [feishuCodeCountdown, setFeishuCodeCountdown] = useState(0);

  const { toasts, removeToast, success, error } = useToast();

  // 计算密码强度
  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    
    if (score <= 2) return { level: 1, label: '弱', color: 'bg-red-500' };
    if (score <= 4) return { level: 2, label: '中', color: 'bg-amber-500' };
    if (score <= 5) return { level: 3, label: '强', color: 'bg-green-500' };
    return { level: 4, label: '很强', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // 邮箱验证倒计时
  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  // 飞书绑定码倒计时
  useEffect(() => {
    if (feishuCodeCountdown > 0) {
      const timer = setTimeout(() => setFeishuCodeCountdown(feishuCodeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (feishuCodeCountdown === 0 && feishuBindCode) {
      setFeishuBindCode(null);
    }
  }, [feishuCodeCountdown, feishuBindCode]);

  // 加载飞书绑定状态
  useEffect(() => {
    const loadFeishuBinding = async () => {
      setLoadingFeishu(true);
      try {
        const status = await getFeishuBindingFromDB(user.id);
        setFeishuBinding(status);
      } catch (err) {
        console.error('加载飞书绑定状态失败:', err);
      } finally {
        setLoadingFeishu(false);
      }
    };
    loadFeishuBinding();
  }, [user.id]);

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
        
        const configMap = new Map<string, AIProvider>();
        userConfigs.forEach(c => configMap.set(c.providerKey, c));
        setUserProviders(configMap);
        
        const editConfigs: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isDefault: boolean; defaultModel: string }> = {};
        templates.forEach(t => {
          const userConfig = configMap.get(t.providerKey);
          editConfigs[t.providerKey] = {
            apiKey: userConfig?.apiKey || '',
            baseUrl: userConfig?.baseUrl || t.baseUrl || '',
            enabled: userConfig?.isEnabled || false,
            isDefault: userConfig?.isDefault || false,
            defaultModel: userConfig?.defaultModel || (t.models.length > 0 ? t.models[0].id : ''),
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

  const updateEditingConfig = useCallback((providerKey: string, key: string, value: string | boolean) => {
    setEditingConfigs(prev => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], [key]: value },
    }));
  }, []);

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
        isDefault: config.isDefault,
        defaultModel: config.defaultModel,
      });
      
      if (saved) {
        setUserProviders(prev => new Map(prev).set(providerKey, saved));
        setEditingConfigs(prev => ({
          ...prev,
          [providerKey]: { ...prev[providerKey], enabled: saved.isEnabled },
        }));
        success(`${template.name} 配置已保存`);
      }
    } catch (err: any) {
      error(err.message || '保存失败');
    } finally {
      setSavingProvider(null);
    }
  }, [user.id, providerTemplates, editingConfigs, success, error]);

  const handleSetDefault = useCallback(async (providerKey: string) => {
    const userConfig = userProviders.get(providerKey);
    if (!userConfig) {
      error('请先保存配置');
      return;
    }
    
    try {
      const result = await setDefaultProvider(user.id, userConfig.id);
      if (result) {
        setUserProviders(prev => {
          const newMap = new Map(prev);
          newMap.forEach((v, k) => {
            newMap.set(k, { ...v, isDefault: k === providerKey });
          });
          return newMap;
        });
        setEditingConfigs(prev => {
          const newConfigs = { ...prev };
          Object.keys(newConfigs).forEach(k => {
            newConfigs[k] = { ...newConfigs[k], isDefault: k === providerKey };
          });
          return newConfigs;
        });
        success('已设为默认');
      }
    } catch (err: any) {
      error(err.message || '设置失败');
    }
  }, [user.id, userProviders, success, error]);

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

  const handleResendVerification = async () => {
    if (!user.email || sendingVerification) return;
    
    setSendingVerification(true);
    try {
      await requestEmailVerification(user.email);
      setEmailCountdown(60);
      success('验证邮件已发送');
    } catch (err: any) {
      error(err.message || '发送失败');
    } finally {
      setSendingVerification(false);
    }
  };

  const handleStartChangeEmail = () => {
    setEmailMode('change');
    setNewEmail('');
    setEmailPassword('');
    setVerificationCode('');
  };

  const handleCancelChangeEmail = () => {
    setEmailMode('view');
    setNewEmail('');
    setEmailPassword('');
    setVerificationCode('');
    setPendingVerifyEmail(null);
  };

  const handleSubmitNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(newEmail)) {
      error('请输入有效的邮箱地址');
      return;
    }
    if (!emailPassword) {
      error('请输入当前密码');
      return;
    }
    
    setSavingEmail(true);
    try {
      await updateEmail(user.id, newEmail, emailPassword);
      setPendingVerifyEmail(newEmail);
      setEmailMode('verify');
      setEmailCountdown(60);
      success('验证码已发送到新邮箱');
    } catch (err: any) {
      error(err.message || '更新失败');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleVerifyNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingVerifyEmail || verificationCode.length !== 6) {
      error('请输入6位验证码');
      return;
    }
    
    setVerifyingEmail(true);
    try {
      await verifyEmail(pendingVerifyEmail, verificationCode);
      const updatedUser = { ...user, email: pendingVerifyEmail, email_verified: true };
      saveUser(updatedUser);
      onUserUpdate(updatedUser);
      setEmailMode('view');
      setVerificationCode('');
      setPendingVerifyEmail(null);
      success('邮箱已更新并验证');
    } catch (err: any) {
      error(err.message || '验证失败');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleResendNewEmailCode = async () => {
    if (!pendingVerifyEmail || emailCountdown > 0) return;
    
    setSendingVerification(true);
    try {
      await resendEmailChangeVerification(pendingVerifyEmail);
      setEmailCountdown(60);
      success('验证码已重新发送');
    } catch (err: any) {
      error(err.message || '发送失败');
    } finally {
      setSendingVerification(false);
    }
  };

  const handleGenerateFeishuCode = async () => {
    setGeneratingCode(true);
    try {
      const code = await generateFeishuBindCode(user.id);
      setFeishuBindCode(code);
      setFeishuCodeCountdown(code.expires_in);
      success('绑定码已生成');
    } catch (err: any) {
      error(err.message || '生成绑定码失败');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleUnbindFeishu = async () => {
    if (!confirm('确定要解除飞书绑定吗？')) return;
    
    setUnbindingFeishu(true);
    try {
      await unbindFeishu(user.id);
      setFeishuBinding({ bound: false });
      setFeishuBindCode(null);
      success('已解除飞书绑定');
    } catch (err: any) {
      error(err.message || '解绑失败');
    } finally {
      setUnbindingFeishu(false);
    }
  };

  const refreshFeishuBinding = async () => {
    try {
      const status = await getFeishuBindingFromDB(user.id);
      setFeishuBinding(status);
      if (status.bound) {
        setFeishuBindCode(null);
        setFeishuCodeCountdown(0);
      }
    } catch (err) {
      console.error('刷新绑定状态失败:', err);
    }
  };

  // 标签配置
  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'account',
      label: '账户',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: 'ai',
      label: 'AI 模型',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      key: 'integrations',
      label: '集成',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      key: 'about',
      label: '关于',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full h-full overflow-y-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 页面头部 */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/20">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
              <p className="text-gray-500">{user.email || '未设置邮箱'}</p>
            </div>
          </div>

          {/* 顶部标签导航 */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        <div>
          {/* 账户设置 */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* 双栏布局 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 用户名卡片 */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <h3 className="font-medium text-gray-900">用户名</h3>
                    </div>
                    <form onSubmit={handleUpdateUsername}>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all mb-3"
                        placeholder="输入用户名"
                      />
                      <button
                        type="submit"
                        disabled={savingUsername || username === user.username}
                        className={`w-full px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          savingUsername || username === user.username
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                        }`}
                      >
                        {savingUsername ? '保存中...' : '保存'}
                      </button>
                    </form>
                  </div>

                  {/* 邮箱卡片 */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </div>
                      <h3 className="font-medium text-gray-900">邮箱</h3>
                    </div>

                    {emailMode === 'view' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{user.email || '未设置'}</span>
                            {user.email && (
                              user.email_verified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  已验证
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                  未验证
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {user.email && !user.email_verified && (
                            <button
                              onClick={handleResendVerification}
                              disabled={sendingVerification || emailCountdown > 0}
                              className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-50"
                            >
                              {emailCountdown > 0 ? `${emailCountdown}s` : '发送验证'}
                            </button>
                          )}
                          <button
                            onClick={handleStartChangeEmail}
                            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                          >
                            {user.email ? '修改' : '添加'}
                          </button>
                        </div>
                      </div>
                    )}

                    {emailMode === 'change' && (
                      <form onSubmit={handleSubmitNewEmail} className="space-y-3">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                          placeholder="新邮箱地址"
                          required
                        />
                        <input
                          type="password"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                          placeholder="当前密码"
                          required
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={handleCancelChangeEmail} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                            取消
                          </button>
                          <button type="submit" disabled={savingEmail} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
                            {savingEmail ? '发送中...' : '发送验证码'}
                          </button>
                        </div>
                      </form>
                    )}

                    {emailMode === 'verify' && (
                      <form onSubmit={handleVerifyNewEmail} className="space-y-3">
                        <p className="text-sm text-gray-600 text-center">验证码已发送至 <span className="font-medium">{pendingVerifyEmail}</span></p>
                        <VerificationInput value={verificationCode} onChange={setVerificationCode} countdown={emailCountdown} onResend={handleResendNewEmailCode} disabled={verifyingEmail} />
                        <div className="flex gap-2">
                          <button type="button" onClick={handleCancelChangeEmail} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
                            取消
                          </button>
                          <button type="submit" disabled={verifyingEmail || verificationCode.length !== 6} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
                            {verifyingEmail ? '验证中...' : '确认'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {/* 密码修改 - 全宽卡片 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h3 className="font-medium text-gray-900">修改密码</h3>
                  </div>
                  <form onSubmit={handleUpdatePassword}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                        placeholder="当前密码"
                        required
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                        placeholder="新密码（至少6位）"
                        required
                        minLength={6}
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                        placeholder="确认新密码"
                        required
                      />
                    </div>
                    {newPassword && (
                      <div className="mb-3 space-y-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div key={level} className={`h-1.5 flex-1 rounded-full transition-all ${level <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${passwordStrength.level === 1 ? 'text-red-600' : passwordStrength.level === 2 ? 'text-amber-600' : 'text-green-600'}`}>
                            密码强度: {passwordStrength.label}
                          </span>
                          <span className="text-gray-400">建议使用大小写字母、数字和特殊字符</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                      className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                        savingPassword || !oldPassword || !newPassword || !confirmPassword
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                      }`}
                    >
                      {savingPassword ? '更新中...' : '更新密码'}
                    </button>
                  </form>
                </div>

                {/* 账户信息 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500">账户创建时间</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(user.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
              </div>
            )}

            {/* AI 模型配置 */}
            {activeTab === 'ai' && (
              <div className="space-y-4">

                {loadingProviders ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3 text-gray-500">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                      </svg>
                      <span>加载配置中...</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {providerTemplates.map((template) => {
                      const config = editingConfigs[template.providerKey] || { apiKey: '', baseUrl: '', enabled: false, isDefault: false, defaultModel: '' };
                      const userConfig = userProviders.get(template.providerKey);
                      const isExpanded = expandedProvider === template.providerKey;
                      const isConfigured = userConfig?.isEnabled;
                      const isDefault = userConfig?.isDefault || false;
                      
                      return (
                        <div key={template.providerKey} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isExpanded ? 'lg:col-span-2 border-primary/30' : 'border-gray-100'}`}>
                          <button
                            onClick={() => setExpandedProvider(isExpanded ? null : template.providerKey)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                <AIProviderIcon providerKey={template.providerKey} size={24} />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 text-sm">{template.name}</span>
                                  {isConfigured && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded">已配置</span>}
                                  {isDefault && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">默认</span>}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {template.models.length > 0 ? template.models.slice(0, 2).map(m => m.name).join(', ') + (template.models.length > 2 ? '...' : '') : '自定义模型'}
                                </p>
                              </div>
                            </div>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                          
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 bg-gray-50/50 border-t border-gray-100">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1.5">API Key</label>
                                  <div className="relative">
                                    <input
                                      type={showApiKey[template.providerKey] ? 'text' : 'password'}
                                      value={config.apiKey}
                                      onChange={(e) => updateEditingConfig(template.providerKey, 'apiKey', e.target.value)}
                                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all pr-10 text-sm"
                                      placeholder="sk-..."
                                    />
                                    <button type="button" onClick={() => toggleShowApiKey(template.providerKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                                      {showApiKey[template.providerKey] ? (
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                      ) : (
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{template.models.length > 0 ? '默认模型' : '模型名称'}</label>
                                  {template.models.length > 0 ? (
                                    <select value={config.defaultModel} onChange={(e) => updateEditingConfig(template.providerKey, 'defaultModel', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all text-sm">
                                      {template.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                                    </select>
                                  ) : (
                                    <input type="text" value={config.defaultModel} onChange={(e) => updateEditingConfig(template.providerKey, 'defaultModel', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all text-sm" placeholder="gpt-4o, claude-3-5-sonnet..." />
                                  )}
                                </div>
                                
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Base URL {template.providerKey === 'custom' ? '' : '(可选)'}</label>
                                  <input type="text" value={config.baseUrl} onChange={(e) => updateEditingConfig(template.providerKey, 'baseUrl', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 ring-primary/20 outline-none transition-all text-sm" placeholder={template.baseUrl || 'https://api.example.com/v1'} />
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                <button onClick={() => handleSaveProvider(template.providerKey)} disabled={savingProvider === template.providerKey} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                  {savingProvider === template.providerKey ? (<><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0110 10" strokeLinecap="round" /></svg>保存中...</>) : '保存'}
                                </button>
                                {isConfigured && !isDefault && (
                                  <button onClick={() => handleSetDefault(template.providerKey)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors">
                                    设为默认
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 集成设置 */}
            {activeTab === 'integrations' && (
              <div className="space-y-4">
                {/* 飞书绑定卡片 */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-[#3370ff]/10 flex-shrink-0">
                        <div 
                          className="w-8 h-8"
                          style={{
                            backgroundImage: 'url(https://lf-package-cn.feishucdn.com/obj/feishu-static/developer/console/frontend/images/899fa60e60151c73aaea2e25871102dc.svg)',
                            backgroundPosition: '0 0',
                            backgroundSize: 'auto 32px',
                            backgroundRepeat: 'no-repeat'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-medium text-gray-900">飞书</h3>
                          {feishuBinding?.bound && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded-full">已连接</span>}
                        </div>
                        <p className="text-xs text-gray-500">通过飞书快速添加资源</p>
                      </div>
                    </div>
                      {loadingFeishu ? (
                      <div className="flex items-center justify-center py-4">
                        <svg className="w-5 h-5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                        </svg>
                      </div>
                    ) : feishuBinding?.bound ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          {feishuBinding.feishu_avatar ? (
                            <img src={feishuBinding.feishu_avatar} alt={feishuBinding.feishu_name} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 text-sm">{feishuBinding.feishu_name || '飞书用户'}</span>
                            <p className="text-xs text-gray-500">绑定于 {feishuBinding.bound_at ? new Date(feishuBinding.bound_at).toLocaleDateString('zh-CN') : '未知'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={refreshFeishuBinding} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">刷新状态</button>
                          <button onClick={handleUnbindFeishu} disabled={unbindingFeishu} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50">
                            {unbindingFeishu ? '解绑中...' : '解除绑定'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {feishuBindCode ? (
                          <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="text-center mb-3">
                              <p className="text-xs text-gray-600 mb-2">在飞书中私聊机器人发送：</p>
                              <div className="font-mono text-lg font-bold text-primary tracking-wider bg-white px-4 py-2 rounded-lg inline-block">/bind {feishuBindCode.code}</div>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-3">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              <span>{feishuCodeCountdown > 0 ? `${Math.floor(feishuCodeCountdown / 60)}:${(feishuCodeCountdown % 60).toString().padStart(2, '0')} 后过期` : '已过期'}</span>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button onClick={handleGenerateFeishuCode} disabled={generatingCode} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700 hover:bg-gray-50 transition-all border border-gray-200">重新生成</button>
                              <button onClick={refreshFeishuBinding} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:shadow-lg hover:shadow-primary/20 transition-all">我已绑定</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-2 text-xs text-gray-500">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                              <span>添加「Lumina 资源助手」机器人</span>
                            </div>
                            <div className="flex gap-2 text-xs text-gray-500">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                              <span>获取绑定码后在飞书中发送 /bind 绑定码</span>
                            </div>
                            <button onClick={handleGenerateFeishuCode} disabled={generatingCode} className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${generatingCode ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'}`}>
                              {generatingCode ? '生成中...' : '获取绑定码'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 更多集成占位 */}
                <div className="p-5 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                  <p className="text-sm text-gray-400">更多集成即将推出</p>
                </div>
              </div>
            )}

            {/* 关于 */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                {/* 版本信息 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">版本</p>
                        <p className="font-medium text-gray-900">1.0.0</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">构建日期</p>
                        <p className="font-medium text-gray-900">2026.01.02</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 链接 */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
                  <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                      </svg>
                      <span className="text-sm text-gray-700">GitHub</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                  </a>
                  <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm text-gray-700">使用文档</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                  </a>
                  <a href="#" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span className="text-sm text-gray-700">反馈问题</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                  </a>
                </div>

                {/* 版权 */}
                <div className="text-center text-xs text-gray-400 py-2">
                  © 2026 Lumina. All rights reserved.
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
