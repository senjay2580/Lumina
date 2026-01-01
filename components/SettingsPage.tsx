import React, { useState } from 'react';
import { User, updateUsername, updatePassword, saveUser } from '../lib/auth';
import { ToastContainer } from '../shared/Toast';
import { useToast } from '../shared/useToast';

interface SettingsPageProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUserUpdate }) => {
  const [username, setUsername] = useState(user.username);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const { toasts, removeToast, success, error } = useToast();

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
                {savingUsername ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    保存中...
                  </span>
                ) : '保存更改'}
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
                {savingPassword ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    更新中...
                  </span>
                ) : '更新密码'}
              </button>
            </form>
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
                <span className="text-gray-900 font-medium">2026.01.01</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
