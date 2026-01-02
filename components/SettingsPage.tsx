import React, { useState, useEffect, useCallback } from 'react';
import { User, updateUsername, updatePassword, saveUser, updateEmail, requestEmailVerification, verifyEmail, validateEmail, resendEmailChangeVerification } from '../lib/auth';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';
import { VerificationInput } from '../shared/VerificationInput';
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
  const [editingConfigs, setEditingConfigs] = useState<Record<string, { apiKey: string; baseUrl: string; enabled: boolean }>>({});
  
  const { toasts, removeToast, success, error } = useToast();

  // 计算密码强度
  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };
    
    let score = 0;
    
    // 长度检查
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // 包含数字
    if (/\d/.test(password)) score += 1;
    
    // 包含小写字母
    if (/[a-z]/.test(password)) score += 1;
    
    // 包含大写字母
    if (/[A-Z]/.test(password)) score += 1;
    
    // 包含特殊字符
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

  // 重新发送验证邮件
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

  // 开始修改邮箱流程
  const handleStartChangeEmail = () => {
    setEmailMode('change');
    setNewEmail('');
    setEmailPassword('');
    setVerificationCode('');
  };

  // 取消修改邮箱
  const handleCancelChangeEmail = () => {
    setEmailMode('view');
    setNewEmail('');
    setEmailPassword('');
    setVerificationCode('');
    setPendingVerifyEmail(null);
  };

  // 提交新邮箱
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

  // 验证新邮箱
  const handleVerifyNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pendingVerifyEmail || verificationCode.length !== 6) {
      error('请输入6位验证码');
      return;
    }
    
    setVerifyingEmail(true);
    try {
      await verifyEmail(pendingVerifyEmail, verificationCode);
      // 更新本地用户信息
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

  // 重新发送新邮箱验证码
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

  return (
    <div className="w-full h-full overflow-y-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div className="max-w-5xl mx-auto px-8 py-10">
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
          {/* 邮箱管理 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">邮箱管理</h3>
                  <p className="text-xs text-gray-500">管理邮箱地址和验证状态</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {emailMode === 'view' && (
                <div className="space-y-4">
                  {/* 当前邮箱显示 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">当前邮箱</label>
                      {user.email ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900">{user.email}</span>
                          {user.email_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              已验证
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              未验证
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">未设置邮箱</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {/* 未验证时显示重新发送按钮 */}
                    {user.email && !user.email_verified && (
                      <button
                        onClick={handleResendVerification}
                        disabled={sendingVerification || emailCountdown > 0}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                          sendingVerification || emailCountdown > 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {sendingVerification ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                              <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                            </svg>
                            发送中...
                          </>
                        ) : emailCountdown > 0 ? (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {emailCountdown}s 后可重发
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 4v6h-6" />
                              <path d="M1 20v-6h6" />
                              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            重新发送验证邮件
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* 修改邮箱按钮 */}
                    <button
                      onClick={handleStartChangeEmail}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {user.email ? '修改邮箱' : '添加邮箱'}
                    </button>
                  </div>
                </div>
              )}

              {emailMode === 'change' && (
                <form onSubmit={handleSubmitNewEmail} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">新邮箱地址</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                      placeholder="请输入新邮箱地址"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                      placeholder="请输入当前密码以确认身份"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingEmail || !newEmail || !emailPassword}
                      className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                        savingEmail || !newEmail || !emailPassword
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                      }`}
                    >
                      {savingEmail ? '提交中...' : '发送验证码'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelChangeEmail}
                      className="px-5 py-2.5 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}

              {emailMode === 'verify' && (
                <form onSubmit={handleVerifyNewEmail} className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">
                      验证码已发送至 <span className="font-medium text-gray-900">{pendingVerifyEmail}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">请输入6位数字验证码</p>
                  </div>
                  
                  <VerificationInput
                    value={verificationCode}
                    onChange={setVerificationCode}
                    countdown={emailCountdown}
                    onResend={handleResendNewEmailCode}
                    disabled={verifyingEmail}
                  />
                  
                  <div className="flex gap-3 pt-2 justify-center">
                    <button
                      type="submit"
                      disabled={verifyingEmail || verificationCode.length !== 6}
                      className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                        verifyingEmail || verificationCode.length !== 6
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                      }`}
                    >
                      {verifyingEmail ? '验证中...' : '确认验证'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelChangeEmail}
                      className="px-5 py-2.5 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* 账户设置 - 用户名和密码合并 */}
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
                  <h3 className="font-semibold text-gray-900">账户设置</h3>
                  <p className="text-xs text-gray-500">管理用户名和密码</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* 用户名 */}
              <form onSubmit={handleUpdateUsername}>
                <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                    placeholder="输入新用户名"
                  />
                  <button
                    type="submit"
                    disabled={savingUsername || username === user.username}
                    className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                      savingUsername || username === user.username
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                    }`}
                  >
                    {savingUsername ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>

              <div className="border-t border-gray-100"></div>

              {/* 密码 */}
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">修改密码</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 ring-primary/20 outline-none transition-all"
                  placeholder="当前密码"
                  required
                />
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
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
                  {/* 密码强度指示器 */}
                  {newPassword && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              level <= passwordStrength.level
                                ? passwordStrength.color
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${
                          passwordStrength.level === 1 ? 'text-red-600' :
                          passwordStrength.level === 2 ? 'text-amber-600' :
                          passwordStrength.level >= 3 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          密码强度: {passwordStrength.label}
                        </span>
                        <span className="text-gray-400">
                          建议使用大小写字母、数字和特殊字符
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                    savingPassword || !oldPassword || !newPassword || !confirmPassword
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20'
                  }`}
                >
                  {savingPassword ? '更新中...' : '更新密码'}
                </button>
              </form>
            </div>
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
