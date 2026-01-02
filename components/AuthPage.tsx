import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  login, 
  register, 
  registerWithEmail,
  loginWithEmail,
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  saveUser, 
  validateEmail,
  User 
} from '../lib/auth';
import { ToastContainer, useToast, VerificationInput } from '../shared';

// Extended AuthMode to support email authentication flows
type AuthMode = 'login' | 'register' | 'forgot-password' | 'verify-email' | 'reset-password';

interface AuthPageProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  // Core state
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Countdown timer for verification code resend
  const [countdown, setCountdown] = useState(0);
  
  // Email validation state
  const [emailError, setEmailError] = useState('');
  
  // Track if user needs to verify email after login
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  
  const { toasts, removeToast, success, error } = useToast();

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Email validation on change
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError('请输入有效的邮箱地址');
    } else {
      setEmailError('');
    }
  }, []);

  // Mode switching with state preservation
  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setEmailError('');
    // Preserve email when switching between related modes
    if (newMode === 'login' || newMode === 'register') {
      // Keep email for convenience
    }
  }, []);

  // Handle registration form submission
  const handleRegister = async () => {
    if (password !== confirmPassword) {
      error('两次密码不一致');
      return;
    }

    if (email && !validateEmail(email)) {
      error('请输入有效的邮箱地址');
      return;
    }

    try {
      if (email) {
        // Register with email
        await registerWithEmail(email, password, username || undefined);
        success('注册成功！请查收验证邮件');
        setPendingVerificationEmail(email);
        setCountdown(60);
        setMode('verify-email');
      } else {
        // Legacy username-only registration
        await register(username, password);
        success('注册成功！请登录');
        setMode('login');
      }
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      error(err.message || '注册失败');
    }
  };

  // Handle login form submission
  const handleLogin = async () => {
    try {
      // Use email login if input looks like email, otherwise use username login
      const identifier = email || username;
      let user;
      
      if (validateEmail(identifier)) {
        const result = await loginWithEmail(identifier, password);
        user = result;
        
        // Check if email needs verification
        if (result.emailNotVerified) {
          success('登录成功，但邮箱尚未验证');
        } else {
          success('登录成功');
        }
      } else {
        user = await login(identifier, password);
        success('登录成功');
      }
      
      saveUser(user);
      setTimeout(() => onAuthSuccess(user), 500);
    } catch (err: any) {
      error(err.message || '登录失败');
    }
  };

  // Handle email verification
  const handleVerifyEmail = async () => {
    const emailToVerify = pendingVerificationEmail || email;
    if (!emailToVerify) {
      error('请输入邮箱地址');
      return;
    }

    try {
      await verifyEmail(emailToVerify, verificationCode);
      success('邮箱验证成功！请登录');
      setVerificationCode('');
      setPendingVerificationEmail('');
      setMode('login');
    } catch (err: any) {
      error(err.message || '验证失败');
    }
  };

  // Handle resend verification code
  const handleResendVerification = async () => {
    const emailToVerify = pendingVerificationEmail || email;
    if (!emailToVerify) {
      error('请输入邮箱地址');
      return;
    }

    try {
      await requestEmailVerification(emailToVerify);
      success('验证码已发送');
      setCountdown(60);
    } catch (err: any) {
      error(err.message || '发送失败');
    }
  };

  // Handle forgot password request
  const handleForgotPassword = async () => {
    if (!email || !validateEmail(email)) {
      error('请输入有效的邮箱地址');
      return;
    }

    try {
      await requestPasswordReset(email);
      success('重置码已发送到您的邮箱');
      setPendingVerificationEmail(email);
      setCountdown(60);
      setMode('reset-password');
    } catch (err: any) {
      error(err.message || '发送失败');
    }
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (password !== confirmPassword) {
      error('两次密码不一致');
      return;
    }

    if (password.length < 6) {
      error('密码至少需要6位');
      return;
    }

    const emailToReset = pendingVerificationEmail || email;
    if (!emailToReset) {
      error('请输入邮箱地址');
      return;
    }

    try {
      await resetPassword(emailToReset, verificationCode, password);
      success('密码重置成功！请登录');
      setVerificationCode('');
      setPassword('');
      setConfirmPassword('');
      setPendingVerificationEmail('');
      setMode('login');
    } catch (err: any) {
      error(err.message || '重置失败');
    }
  };

  // Main form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      switch (mode) {
        case 'register':
          await handleRegister();
          break;
        case 'login':
          await handleLogin();
          break;
        case 'verify-email':
          await handleVerifyEmail();
          break;
        case 'forgot-password':
          await handleForgotPassword();
          break;
        case 'reset-password':
          await handleResetPassword();
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // Get title based on current mode
  const getTitle = () => {
    switch (mode) {
      case 'login': return '登录';
      case 'register': return '注册';
      case 'forgot-password': return '找回密码';
      case 'verify-email': return '验证邮箱';
      case 'reset-password': return '重置密码';
    }
  };

  // Get submit button text
  const getSubmitText = () => {
    if (loading) return '处理中...';
    switch (mode) {
      case 'login': return '登录';
      case 'register': return '注册';
      case 'forgot-password': return '发送重置码';
      case 'verify-email': return '验证';
      case 'reset-password': return '重置密码';
    }
  };

  // Render the logo component
  const renderLogo = () => (
    <motion.div 
      className="flex items-center justify-center gap-4 mb-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* 3D Logo container */}
      <motion.div 
        className="relative w-16 h-16"
        whileHover={{ scale: 1.05, rotateY: 10 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {/* Shadow layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl blur-lg opacity-40 translate-y-2" />
        {/* Main logo box */}
        <div className="relative w-full h-full bg-gradient-to-br from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-2xl p-3 shadow-xl"
          style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)' }}
        >
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#FFE4CC" />
              </linearGradient>
              <linearGradient id="authLogoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#FFD4A8" />
              </linearGradient>
            </defs>
            <g>
              <path fill="url(#authLogoGradient)" fillRule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clipRule="evenodd"/>
              <circle cx="12" cy="12" r="2.5" fill="url(#authLogoGradient2)" />
            </g>
          </svg>
        </div>
      </motion.div>
      
      {/* Logo text with gradient */}
      <h1 className="text-4xl font-bold bg-gradient-to-r from-[#FF8C00] via-[#FF6B00] to-[#E85D00] bg-clip-text text-transparent"
        style={{ fontFamily: "'Quicksand', sans-serif", textShadow: '0 2px 10px rgba(255, 107, 0, 0.2)' }}
      >
        Lumina
      </h1>
    </motion.div>
  );

  // Render login/register tab switcher
  const renderTabSwitcher = () => {
    if (mode !== 'login' && mode !== 'register') return null;
    
    return (
      <div className="flex gap-1 p-1.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl mb-6 shadow-inner">
        <motion.button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative ${
            mode === 'login' 
              ? 'text-white' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {mode === 'login' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute inset-0 bg-gradient-to-r from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-xl shadow-lg"
              style={{ boxShadow: '0 4px 15px -3px rgba(255, 107, 0, 0.4)' }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">登录</span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => switchMode('register')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative ${
            mode === 'register' 
              ? 'text-white' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {mode === 'register' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute inset-0 bg-gradient-to-r from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-xl shadow-lg"
              style={{ boxShadow: '0 4px 15px -3px rgba(255, 107, 0, 0.4)' }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">注册</span>
        </motion.button>
      </div>
    );
  };

  // Render back button for secondary modes
  const renderBackButton = () => {
    if (mode === 'login' || mode === 'register') return null;
    
    return (
      <button
        type="button"
        onClick={() => {
          setPendingVerificationEmail('');
          setVerificationCode('');
          switchMode('login');
        }}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        返回登录
      </button>
    );
  };

  // Render login form
  const renderLoginForm = () => (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">邮箱或用户名</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#FF6B00]">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <input
            type="text"
            value={email || username}
            onChange={(e) => {
              const value = e.target.value;
              if (validateEmail(value) || value.includes('@')) {
                setEmail(value);
                setUsername('');
              } else {
                setUsername(value);
                setEmail('');
              }
            }}
            placeholder="请输入邮箱或用户名"
            required
            autoComplete="username"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">密码</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            required
            autoComplete="current-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => switchMode('forgot-password')}
          className="text-sm text-[#FF6B00] font-medium hover:text-[#E85D00] hover:underline transition-colors"
        >
          忘记密码？
        </button>
      </div>
    </>
  );

  // Render register form
  const renderRegisterForm = () => (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          邮箱 <span className="text-xs text-gray-400 font-normal">(推荐)</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="请输入邮箱地址"
            autoComplete="email"
            className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm ${
              emailError 
                ? 'bg-red-50/50 border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100' 
                : 'bg-gradient-to-r from-gray-50 to-orange-50/30 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10'
            }`}
          />
        </div>
        {emailError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
            </svg>
            {emailError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          用户名 {!email && <span className="text-red-500">*</span>}
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={email ? '可选，留空将自动生成' : '请输入用户名'}
            required={!email}
            autoComplete="username"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">密码</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码（至少6位）"
            required
            autoComplete="new-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">确认密码</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入密码"
            required
            autoComplete="new-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>
    </>
  );

  // Render email verification form
  const renderVerifyEmailForm = () => {
    const emailToVerify = pendingVerificationEmail || email;
    
    return (
      <>
        <div className="text-center mb-6">
          <motion.div 
            className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-2xl flex items-center justify-center shadow-xl"
            style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.4)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </motion.div>
          <p className="text-gray-600">
            验证码已发送至 <span className="text-gray-800 font-semibold">{emailToVerify}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">请输入6位数字验证码</p>
        </div>

        <VerificationInput
          value={verificationCode}
          onChange={setVerificationCode}
          countdown={countdown}
          onResend={handleResendVerification}
          disabled={loading}
        />
      </>
    );
  };

  // Render forgot password form
  const renderForgotPasswordForm = () => (
    <>
      <div className="text-center mb-6">
        <motion.div 
          className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-2xl flex items-center justify-center shadow-xl"
          style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.4)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </motion.div>
        <p className="text-gray-600">输入您的邮箱地址，我们将发送重置码</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">邮箱</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="请输入注册邮箱"
            required
            autoComplete="email"
            className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm ${
              emailError 
                ? 'bg-red-50/50 border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100' 
                : 'bg-gradient-to-r from-gray-50 to-orange-50/30 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10'
            }`}
          />
        </div>
        {emailError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
            </svg>
            {emailError}
          </p>
        )}
      </div>
    </>
  );

  // Render reset password form
  const renderResetPasswordForm = () => {
    const emailToReset = pendingVerificationEmail || email;
    
    return (
      <>
        <div className="text-center mb-6">
          <motion.div 
            className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#FF8C00] via-[#FF6B00] to-[#E85D00] rounded-2xl flex items-center justify-center shadow-xl"
            style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.4)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </motion.div>
          <p className="text-gray-600">
            重置码已发送至 <span className="text-gray-800 font-semibold">{emailToReset}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">验证码</label>
            <VerificationInput
              value={verificationCode}
              onChange={setVerificationCode}
              countdown={countdown}
              onResend={async () => {
                try {
                  await requestPasswordReset(emailToReset);
                  success('重置码已重新发送');
                  setCountdown(60);
                } catch (err: any) {
                  error(err.message || '发送失败');
                }
              }}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">新密码</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                required
                autoComplete="new-password"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">确认新密码</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                required
                autoComplete="new-password"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-gradient-to-r from-gray-50 to-orange-50/30 border-2 border-gray-100 focus:border-[#FF6B00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF6B00]/10 outline-none transition-all text-gray-800 placeholder:text-gray-400 shadow-sm"
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  // Render form content based on mode
  const renderFormContent = () => {
    switch (mode) {
      case 'login':
        return renderLoginForm();
      case 'register':
        return renderRegisterForm();
      case 'verify-email':
        return renderVerifyEmailForm();
      case 'forgot-password':
        return renderForgotPasswordForm();
      case 'reset-password':
        return renderResetPasswordForm();
    }
  };

  // Render footer links
  const renderFooter = () => {
    if (mode === 'login') {
      return (
        <motion.p 
          className="text-center text-sm text-gray-500 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          还没有账号？
          <button
            type="button"
            onClick={() => switchMode('register')}
            className="text-[#FF6B00] font-semibold hover:text-[#E85D00] hover:underline ml-1 transition-colors"
          >
            立即注册
          </button>
        </motion.p>
      );
    }
    
    if (mode === 'register') {
      return (
        <motion.p 
          className="text-center text-sm text-gray-500 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          已有账号？
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-[#FF6B00] font-semibold hover:text-[#E85D00] hover:underline ml-1 transition-colors"
          >
            去登录
          </button>
        </motion.p>
      );
    }
    
    return null;
  };

  // Check if submit should be disabled
  const isSubmitDisabled = () => {
    if (loading) return true;
    
    switch (mode) {
      case 'verify-email':
        return verificationCode.length !== 6;
      case 'reset-password':
        return verificationCode.length !== 6 || !password || !confirmPassword;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{
        background: 'linear-gradient(135deg, #FFF8F0 0%, #FFF5EB 25%, #FFFAF5 50%, #FFF0E5 75%, #FFFAF5 100%)'
      }}
    >
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating gradient orbs */}
        <motion.div 
          className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(255,140,0,0.15) 0%, rgba(255,107,0,0.05) 70%, transparent 100%)' }}
          animate={{ 
            x: [0, 30, 0], 
            y: [0, -20, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-[10%] right-[5%] w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.12) 0%, rgba(255,140,0,0.04) 70%, transparent 100%)' }}
          animate={{ 
            x: [0, -40, 0], 
            y: [0, 30, 0],
            scale: [1, 1.15, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div 
          className="absolute top-[40%] right-[30%] w-[400px] h-[400px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(255,179,71,0.1) 0%, transparent 70%)' }}
          animate={{ 
            x: [0, 50, 0], 
            y: [0, -40, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Scrolling text background */}
        <div className="absolute inset-0 flex flex-col justify-center gap-16 opacity-[0.03]">
          <motion.div 
            className="whitespace-nowrap text-[180px] font-black tracking-tight"
            style={{ color: '#FF6B00' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          >
            LUMINA · AI WORKFLOW · ORCHESTRATOR · LUMINA · AI WORKFLOW · ORCHESTRATOR · 
          </motion.div>
          <motion.div 
            className="whitespace-nowrap text-[180px] font-black tracking-tight"
            style={{ color: '#E85D00' }}
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          >
            CREATE · AUTOMATE · INNOVATE · CREATE · AUTOMATE · INNOVATE · 
          </motion.div>
          <motion.div 
            className="whitespace-nowrap text-[180px] font-black tracking-tight"
            style={{ color: '#FF8C00' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          >
            WORKFLOW · PROMPTS · AI · WORKFLOW · PROMPTS · AI · 
          </motion.div>
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 1px 1px, #FF6B00 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} 
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {renderLogo()}

        {/* Glass Card with 3D effect */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          {/* Card shadow layers for 3D effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200/50 to-orange-300/30 rounded-3xl translate-y-2 blur-xl" />
          <div className="absolute inset-0 bg-white/80 rounded-3xl translate-y-1 shadow-lg" />
          
          {/* Main card */}
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl p-8 shadow-2xl border border-white/60"
            style={{ 
              boxShadow: '0 25px 60px -15px rgba(255, 107, 0, 0.15), 0 10px 30px -10px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)' 
            }}
          >
          {renderBackButton()}
          {renderTabSwitcher()}
          
          {/* Mode Title for secondary modes */}
          {mode !== 'login' && mode !== 'register' && (
            <h2 className="text-xl font-bold text-gray-800 text-center mb-6">{getTitle()}</h2>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {renderFormContent()}

            {/* Submit button - hide for verify-email mode since VerificationInput handles it */}
            {mode !== 'verify-email' && (
              <motion.button
                type="submit"
                disabled={isSubmitDisabled()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6B00] to-[#E85D00] text-white font-semibold shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 relative overflow-hidden"
                style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.5)' }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                {loading ? (
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    处理中...
                  </span>
                ) : <span className="relative z-10">{getSubmitText()}</span>}
              </motion.button>
            )}

            {/* Verify button for verify-email mode */}
            {mode === 'verify-email' && (
              <motion.button
                type="submit"
                disabled={isSubmitDisabled()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6B00] to-[#E85D00] text-white font-semibold shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-6 relative overflow-hidden"
                style={{ boxShadow: '0 10px 30px -5px rgba(255, 107, 0, 0.5)' }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                {loading ? (
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    验证中...
                  </span>
                ) : <span className="relative z-10">验证邮箱</span>}
              </motion.button>
            )}
          </form>
          </div>
        </motion.div>

        {renderFooter()}
      </div>
    </div>
  );
};
