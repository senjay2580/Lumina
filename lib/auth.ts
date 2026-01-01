import { supabase } from './supabase';

export interface User {
  id: string;
  username: string;
  created_at: string;
}

// 简单的密码哈希（生产环境应使用 bcrypt）
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lumina_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 注册
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
    .select('id, username, created_at')
    .single();

  if (error) {
    throw new Error('注册失败，请重试');
  }

  return data;
};

// 登录
export const login = async (username: string, password: string): Promise<User> => {
  const trimmedUsername = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, created_at, password_hash')
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
    .select('id, username, created_at')
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
    .select('id, username, created_at')
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
