import React, { useState } from 'react';
import { login, register, saveUser, User } from '../lib/auth';
import { ToastContainer, useToast } from '../shared';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toasts, removeToast, success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          error('两次密码不一致');
          setLoading(false);
          return;
        }
        
        await register(username, password);
        success('注册成功！请登录');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const user = await login(username, password);
        saveUser(user);
        success('登录成功');
        setTimeout(() => onAuthSuccess(user), 500);
      }
    } catch (err: any) {
      error(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Decorative Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-orange-300/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <svg className="w-7 h-7"><use href="#icon-logo" /></svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Lumina
          </h1>
        </div>

        {/* Glass Card */}
        <div className="glass-card rounded-3xl p-8 shadow-xl">
          {/* Tab Switcher */}
          <div className="flex gap-2 p-1.5 bg-white/50 rounded-2xl mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                mode === 'login' ? 'bg-white shadow-md text-text' : 'text-subtext hover:text-text'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                mode === 'register' ? 'bg-white shadow-md text-text' : 'text-subtext hover:text-text'
              }`}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-subtext">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-subtext">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-subtext">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  处理中...
                </span>
              ) : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-subtext mt-6">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-primary font-medium hover:underline ml-1"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
};
