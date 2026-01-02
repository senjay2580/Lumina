import { supabase } from './supabase';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';

export interface User {
  id: string;
  username: string;
  email: string | null;
  email_verified: boolean;
  created_at: string;
}

// Email validation regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 * @param email - The email address to validate
 * @returns true if email format is valid, false otherwise
 * Requirements: 1.3
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Generates a 6-digit verification code
 * Uses crypto.getRandomValues for secure random generation
 * @returns A 6-digit string code (000000-999999)
 * Requirements: 3.1, 6.3
 */
export const generateVerificationCode = (): string => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Generate a number between 0 and 999999
  const code = array[0] % 1000000;
  // Pad with leading zeros to ensure 6 digits
  return code.toString().padStart(6, '0');
};

// 简单的密码哈希（生产环境应使用 bcrypt）
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lumina_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 注册（用户名方式）
export const register = async (username: string, password: string): Promise<User> => {
  const trimmedUsername = username.trim().toLowerCase();
  
  if (!trimmedUsername || trimmedUsername.length < 2) {
    throw new Error('用户名至少需要2个字符');
  }
  
  if (password.length < 6) {
    throw new Error('密码至少需要6位');
  }

  // 检查用户名是否已存在
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', trimmedUsername)
    .single();

  if (existing) {
    throw new Error('用户名已被注册');
  }

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .insert({ username: trimmedUsername, password_hash: passwordHash })
    .select('id, username, email, email_verified, created_at')
    .single();

  if (error) {
    throw new Error('注册失败，请重试');
  }

  return data;
};


/**
 * 邮箱注册
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */
export const registerWithEmail = async (
  email: string, 
  password: string, 
  username?: string
): Promise<User> => {
  const trimmedEmail = email.trim().toLowerCase();
  
  // Validate email format
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }
  
  // Validate password length
  if (password.length < 6) {
    throw new Error('密码至少需要6位');
  }

  // Check if email already exists
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .single();

  if (existingEmail) {
    throw new Error('该邮箱已被注册');
  }

  // Generate username from email if not provided
  let finalUsername = username?.trim().toLowerCase();
  if (!finalUsername) {
    // Use email prefix as username, add random suffix if needed
    const emailPrefix = trimmedEmail.split('@')[0];
    finalUsername = emailPrefix;
    
    // Check if generated username exists, add random suffix if so
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', finalUsername)
      .single();
    
    if (existingUsername) {
      finalUsername = `${emailPrefix}_${Math.random().toString(36).substring(2, 6)}`;
    }
  } else {
    // Check if provided username already exists
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', finalUsername)
      .single();

    if (existingUsername) {
      throw new Error('用户名已被使用');
    }
  }

  const passwordHash = await hashPassword(password);

  // Create user with email
  const { data, error } = await supabase
    .from('users')
    .insert({ 
      username: finalUsername, 
      email: trimmedEmail,
      email_verified: false,
      password_hash: passwordHash 
    })
    .select('id, username, email, email_verified, created_at')
    .single();

  if (error) {
    throw new Error('注册失败，请重试');
  }

  // Generate verification code and save it
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { error: verificationError } = await supabase
    .from('email_verifications')
    .insert({
      email: trimmedEmail,
      code: verificationCode,
      type: 'registration',
      expires_at: expiresAt.toISOString(),
    });

  if (verificationError) {
    console.error('Failed to create verification record:', verificationError);
    // Don't fail registration, user can request new code later
  } else {
    // Send verification email
    try {
      await sendVerificationEmail(trimmedEmail, verificationCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration, user can request new code later
    }
  }

  return data;
};


// 登录（用户名方式 - 保持向后兼容）
export const login = async (username: string, password: string): Promise<User> => {
  const trimmedUsername = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, email_verified, created_at, password_hash')
    .eq('username', trimmedUsername)
    .single();

  if (error || !data) {
    throw new Error('用户名或密码错误');
  }

  if (data.password_hash !== passwordHash) {
    throw new Error('用户名或密码错误');
  }

  const { password_hash, ...user } = data;
  return user;
};

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * 邮箱或用户名登录（支持双重标识符）
 * Requirements: 2.1, 2.2, 2.3, 2.5, 6.1
 */
export const loginWithEmail = async (
  emailOrUsername: string, 
  password: string
): Promise<User & { emailNotVerified?: boolean }> => {
  const trimmedIdentifier = emailOrUsername.trim().toLowerCase();
  const isEmail = validateEmail(trimmedIdentifier);
  
  // Find user by email or username
  let userData: {
    id: string;
    username: string;
    email: string | null;
    email_verified: boolean;
    created_at: string;
    password_hash: string;
    login_attempts: number;
    locked_until: string | null;
  } | null = null;

  if (isEmail) {
    const { data } = await supabase
      .from('users')
      .select('id, username, email, email_verified, created_at, password_hash, login_attempts, locked_until')
      .eq('email', trimmedIdentifier)
      .single();
    userData = data;
  } else {
    const { data } = await supabase
      .from('users')
      .select('id, username, email, email_verified, created_at, password_hash, login_attempts, locked_until')
      .eq('username', trimmedIdentifier)
      .single();
    userData = data;
  }

  // Generic error message to prevent user enumeration
  const genericError = '邮箱或密码错误';

  if (!userData) {
    throw new Error(genericError);
  }

  // Check if account is locked
  if (userData.locked_until) {
    const lockedUntil = new Date(userData.locked_until);
    if (lockedUntil > new Date()) {
      throw new Error('账户已被锁定，请稍后再试');
    } else {
      // Lock period expired, reset login attempts
      await supabase
        .from('users')
        .update({ login_attempts: 0, locked_until: null })
        .eq('id', userData.id);
      userData.login_attempts = 0;
      userData.locked_until = null;
    }
  }

  // Verify password
  const passwordHash = await hashPassword(password);
  if (userData.password_hash !== passwordHash) {
    // Increment login attempts
    const newAttempts = (userData.login_attempts || 0) + 1;
    const updateData: { login_attempts: number; locked_until?: string } = {
      login_attempts: newAttempts,
    };

    // Lock account if max attempts reached
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', userData.id);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error('账户已被锁定，请稍后再试');
    }

    throw new Error(genericError);
  }

  // Successful login - reset login attempts
  await supabase
    .from('users')
    .update({ login_attempts: 0, locked_until: null })
    .eq('id', userData.id);

  const { password_hash, login_attempts, locked_until, ...user } = userData;
  
  // Return user with email verification status flag
  // Requirements 2.5: Allow login but indicate if email is not verified
  return {
    ...user,
    emailNotVerified: user.email && !user.email_verified ? true : undefined,
  };
};

// Rate limiting constants for verification codes
const VERIFICATION_CODE_COOLDOWN_MS = 60 * 1000; // 60 seconds
const VERIFICATION_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * 请求邮箱验证码
 * Requirements: 3.1, 3.2, 3.5, 3.6, 6.2
 */
export const requestEmailVerification = async (email: string): Promise<void> => {
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  // Check if user exists with this email
  const { data: user } = await supabase
    .from('users')
    .select('id, email_verified')
    .eq('email', trimmedEmail)
    .single();

  if (!user) {
    throw new Error('该邮箱未注册');
  }

  if (user.email_verified) {
    throw new Error('该邮箱已验证');
  }

  // Check rate limiting - look for recent unexpired verification codes
  const { data: recentCode } = await supabase
    .from('email_verifications')
    .select('created_at')
    .eq('email', trimmedEmail)
    .eq('type', 'registration')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentCode) {
    const createdAt = new Date(recentCode.created_at);
    const cooldownEnd = new Date(createdAt.getTime() + VERIFICATION_CODE_COOLDOWN_MS);
    
    if (cooldownEnd > new Date()) {
      const remainingSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
      throw new Error(`请求过于频繁，请${remainingSeconds}秒后再试`);
    }
  }

  // Mark old codes as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('email', trimmedEmail)
    .eq('type', 'registration')
    .eq('used', false);

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS);

  const { error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      email: trimmedEmail,
      code: verificationCode,
      type: 'registration',
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    throw new Error('创建验证码失败，请重试');
  }

  // Send verification email
  try {
    await sendVerificationEmail(trimmedEmail, verificationCode);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    throw new Error('发送验证邮件失败，请重试');
  }
};

/**
 * 验证邮箱
 * Requirements: 3.3, 3.4
 * Supports both registration and email_change verification types
 */
export const verifyEmail = async (email: string, code: string): Promise<void> => {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  if (!trimmedCode || trimmedCode.length !== 6) {
    throw new Error('验证码错误或已过期');
  }

  // Find valid verification code (support both registration and email_change types)
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('id, expires_at, type')
    .eq('email', trimmedEmail)
    .eq('code', trimmedCode)
    .in('type', ['registration', 'email_change'])
    .eq('used', false)
    .single();

  if (!verification) {
    throw new Error('验证码错误或已过期');
  }

  // Check if code is expired
  const expiresAt = new Date(verification.expires_at);
  if (expiresAt < new Date()) {
    throw new Error('验证码错误或已过期');
  }

  // Mark code as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('id', verification.id);

  // Update user's email_verified status
  const { error: updateError } = await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('email', trimmedEmail);

  if (updateError) {
    throw new Error('验证失败，请重试');
  }
};

/**
 * 重新发送验证码（别名函数，方便调用）
 * Requirements: 3.5
 */
export const resendVerificationCode = async (email: string): Promise<void> => {
  return requestEmailVerification(email);
};

/**
 * 请求密码重置
 * Requirements: 4.1, 4.2, 4.3
 * Note: Always returns success to prevent email enumeration
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  // Check if user exists with this email
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .single();

  // Always return success to prevent email enumeration (Requirement 4.2)
  if (!user) {
    // Silently return without sending email
    return;
  }

  // Check rate limiting - look for recent unexpired reset codes
  const { data: recentCode } = await supabase
    .from('email_verifications')
    .select('created_at')
    .eq('email', trimmedEmail)
    .eq('type', 'password_reset')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentCode) {
    const createdAt = new Date(recentCode.created_at);
    const cooldownEnd = new Date(createdAt.getTime() + VERIFICATION_CODE_COOLDOWN_MS);
    
    if (cooldownEnd > new Date()) {
      const remainingSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
      throw new Error(`请求过于频繁，请${remainingSeconds}秒后再试`);
    }
  }

  // Mark old reset codes as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('email', trimmedEmail)
    .eq('type', 'password_reset')
    .eq('used', false);

  // Generate new reset code
  const resetCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS);

  const { error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      email: trimmedEmail,
      code: resetCode,
      type: 'password_reset',
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error('Failed to create reset code:', insertError);
    // Don't reveal error to user
    return;
  }

  // Send password reset email
  try {
    await sendPasswordResetEmail(trimmedEmail, resetCode);
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    // Don't reveal error to user
  }
};

/**
 * 重置密码
 * Requirements: 4.4, 4.5, 4.6
 */
export const resetPassword = async (
  email: string, 
  code: string, 
  newPassword: string
): Promise<void> => {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  if (!trimmedCode || trimmedCode.length !== 6) {
    throw new Error('验证码错误或已过期');
  }

  // Validate new password length (Requirement 4.6)
  if (newPassword.length < 6) {
    throw new Error('密码至少需要6位');
  }

  // Find valid reset code
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('id, expires_at')
    .eq('email', trimmedEmail)
    .eq('code', trimmedCode)
    .eq('type', 'password_reset')
    .eq('used', false)
    .single();

  if (!verification) {
    throw new Error('验证码错误或已过期');
  }

  // Check if code is expired
  const expiresAt = new Date(verification.expires_at);
  if (expiresAt < new Date()) {
    throw new Error('验证码错误或已过期');
  }

  // Mark code as used (invalidate the reset token - Requirement 4.4)
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('id', verification.id);

  // Update user's password
  const newHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('email', trimmedEmail);

  if (updateError) {
    throw new Error('重置密码失败，请重试');
  }
};

// 验证用户是否存在于数据库中
export const verifyUserExists = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    console.error('User verification failed:', error);
    return false;
  }
  return true;
};

// 本地存储
const STORAGE_KEY = 'lumina_user';

export const saveUser = (user: User) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
};

export const getStoredUser = (): User | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

// 验证存储的用户是否仍然有效（数据库中存在）
export const validateStoredUser = async (): Promise<User | null> => {
  const stored = getStoredUser();
  if (!stored) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, email_verified, created_at')
    .eq('id', stored.id)
    .single();
  
  if (error || !data) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  
  return data;
};

export const clearUser = () => {
  localStorage.removeItem(STORAGE_KEY);
};


// 更新用户名
export const updateUsername = async (userId: string, newUsername: string): Promise<User> => {
  const trimmedUsername = newUsername.trim().toLowerCase();
  
  if (!trimmedUsername || trimmedUsername.length < 2) {
    throw new Error('用户名至少需要2个字符');
  }

  // 检查用户名是否已存在
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', trimmedUsername)
    .neq('id', userId)
    .single();

  if (existing) {
    throw new Error('用户名已被使用');
  }

  const { data, error } = await supabase
    .from('users')
    .update({ username: trimmedUsername })
    .eq('id', userId)
    .select('id, username, email, email_verified, created_at')
    .single();

  if (error) {
    throw new Error('更新失败，请重试');
  }

  return data;
};

// 更新密码
export const updatePassword = async (userId: string, oldPassword: string, newPassword: string): Promise<void> => {
  if (newPassword.length < 6) {
    throw new Error('新密码至少需要6位');
  }

  const oldHash = await hashPassword(oldPassword);
  
  // 验证旧密码
  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  if (!user || user.password_hash !== oldHash) {
    throw new Error('当前密码错误');
  }

  const newHash = await hashPassword(newPassword);

  const { error } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', userId);

  if (error) {
    throw new Error('更新失败，请重试');
  }
};

/**
 * 更新邮箱（需要验证新邮箱）
 * Requirements: 5.1
 */
export const updateEmail = async (
  userId: string, 
  newEmail: string, 
  password: string
): Promise<void> => {
  const trimmedEmail = newEmail.trim().toLowerCase();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  // Verify current password
  const passwordHash = await hashPassword(password);
  const { data: user } = await supabase
    .from('users')
    .select('password_hash, email')
    .eq('id', userId)
    .single();

  if (!user || user.password_hash !== passwordHash) {
    throw new Error('密码错误');
  }

  // Check if new email is same as current
  if (user.email === trimmedEmail) {
    throw new Error('新邮箱与当前邮箱相同');
  }

  // Check if new email already exists
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .single();

  if (existingEmail) {
    throw new Error('该邮箱已被使用');
  }

  // Update email and set email_verified to false
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      email: trimmedEmail, 
      email_verified: false 
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error('更新邮箱失败，请重试');
  }

  // Generate and send verification code for new email
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS);

  await supabase
    .from('email_verifications')
    .insert({
      email: trimmedEmail,
      code: verificationCode,
      type: 'email_change',
      expires_at: expiresAt.toISOString(),
    });

  try {
    await sendVerificationEmail(trimmedEmail, verificationCode);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    // Don't fail the update, user can request new code later
  }
};

/**
 * 重新发送邮箱更改验证码
 * Requirements: 5.1
 */
export const resendEmailChangeVerification = async (email: string): Promise<void> => {
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!validateEmail(trimmedEmail)) {
    throw new Error('请输入有效的邮箱地址');
  }

  // Check rate limiting - look for recent unexpired verification codes
  const { data: recentCode } = await supabase
    .from('email_verifications')
    .select('created_at')
    .eq('email', trimmedEmail)
    .eq('type', 'email_change')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentCode) {
    const createdAt = new Date(recentCode.created_at);
    const cooldownEnd = new Date(createdAt.getTime() + VERIFICATION_CODE_COOLDOWN_MS);
    
    if (cooldownEnd > new Date()) {
      const remainingSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
      throw new Error(`请求过于频繁，请${remainingSeconds}秒后再试`);
    }
  }

  // Mark old codes as used
  await supabase
    .from('email_verifications')
    .update({ used: true })
    .eq('email', trimmedEmail)
    .eq('type', 'email_change')
    .eq('used', false);

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS);

  const { error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      email: trimmedEmail,
      code: verificationCode,
      type: 'email_change',
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    throw new Error('创建验证码失败，请重试');
  }

  // Send verification email
  try {
    await sendVerificationEmail(trimmedEmail, verificationCode);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    throw new Error('发送验证邮件失败，请重试');
  }
};
