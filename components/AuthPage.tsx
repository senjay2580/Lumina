import React, { useState, useEffect, useCallback } from 'react';
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
    <div className="flex items-center justify-center gap-3 mb-8">
      <div className="w-12 h-12">
        <svg className="w-full h-full" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8C00" />
              <stop offset="50%" stopColor="#FF6B00" />
              <stop offset="100%" stopColor="#E85D00" />
            </linearGradient>
            <linearGradient id="authLogoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FF6B00" />
            </linearGradient>
            <filter id="authLogoGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#authLogoGlow)">
            <path fill="url(#authLogoGradient)" fillRule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clipRule="evenodd"/>
            <circle cx="12" cy="12" r="2.5" fill="url(#authLogoGradient2)" />
          </g>
        </svg>
      </div>
      <h1 className="text-3xl text-primary" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700 }}>
        Lumina
      </h1>
    </div>
  );

  // Render login/register tab switcher
  const renderTabSwitcher = () => {
    if (mode !== 'login' && mode !== 'register') return null;
    
    return (
      <div className="flex gap-2 p-1.5 bg-white/50 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            mode === 'login' ? 'bg-white shadow-md text-text' : 'text-subtext hover:text-text'
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            mode === 'register' ? 'bg-white shadow-md text-text' : 'text-subtext hover:text-text'
          }`}
        >
          注册
        </button>
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
        className="flex items-center gap-2 text-subtext hover:text-text mb-4 transition-colors"
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
        <label className="block text-sm font-medium text-subtext">邮箱或用户名</label>
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
          autoComplete="current-password"
          className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => switchMode('forgot-password')}
          className="text-sm text-primary hover:underline"
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
        <label className="block text-sm font-medium text-subtext">
          邮箱 <span className="text-xs text-gray-400">(推荐)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="请输入邮箱地址"
          autoComplete="email"
          className={`w-full px-4 py-3 rounded-xl bg-white/60 border outline-none transition-all text-text placeholder:text-gray-400 ${
            emailError 
              ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200' 
              : 'border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
          }`}
        />
        {emailError && (
          <p className="text-xs text-red-500 mt-1">{emailError}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-subtext">
          用户名 {!email && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={email ? '可选，留空将自动生成' : '请输入用户名'}
          required={!email}
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
          placeholder="请输入密码（至少6位）"
          required
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
        />
      </div>

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
    </>
  );

  // Render email verification form
  const renderVerifyEmailForm = () => {
    const emailToVerify = pendingVerificationEmail || email;
    
    return (
      <>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-subtext">
            验证码已发送至 <span className="text-text font-medium">{emailToVerify}</span>
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
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <p className="text-subtext">输入您的邮箱地址，我们将发送重置码</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-subtext">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="请输入注册邮箱"
          required
          autoComplete="email"
          className={`w-full px-4 py-3 rounded-xl bg-white/60 border outline-none transition-all text-text placeholder:text-gray-400 ${
            emailError 
              ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200' 
              : 'border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
          }`}
        />
        {emailError && (
          <p className="text-xs text-red-500 mt-1">{emailError}</p>
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
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <p className="text-subtext">
            重置码已发送至 <span className="text-text font-medium">{emailToReset}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-subtext mb-2">验证码</label>
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
            <label className="block text-sm font-medium text-subtext">新密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-subtext">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-text placeholder:text-gray-400"
            />
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
        <p className="text-center text-sm text-subtext mt-6">
          还没有账号？
          <button
            type="button"
            onClick={() => switchMode('register')}
            className="text-primary font-medium hover:underline ml-1"
          >
            立即注册
          </button>
        </p>
      );
    }
    
    if (mode === 'register') {
      return (
        <p className="text-center text-sm text-subtext mt-6">
          已有账号？
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-primary font-medium hover:underline ml-1"
          >
            去登录
          </button>
        </p>
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
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Decorative Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-orange-300/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {renderLogo()}

        {/* Glass Card */}
        <div className="glass-card rounded-3xl p-8 shadow-xl">
          {renderBackButton()}
          {renderTabSwitcher()}
          
          {/* Mode Title for secondary modes */}
          {mode !== 'login' && mode !== 'register' && (
            <h2 className="text-xl font-semibold text-text text-center mb-6">{getTitle()}</h2>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {renderFormContent()}

            {/* Submit button - hide for verify-email mode since VerificationInput handles it */}
            {mode !== 'verify-email' && (
              <button
                type="submit"
                disabled={isSubmitDisabled()}
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
                ) : getSubmitText()}
              </button>
            )}

            {/* Verify button for verify-email mode */}
            {mode === 'verify-email' && (
              <button
                type="submit"
                disabled={isSubmitDisabled()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white font-medium shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-6"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    验证中...
                  </span>
                ) : '验证邮箱'}
              </button>
            )}
          </form>
        </div>

        {renderFooter()}
      </div>
    </div>
  );
};
