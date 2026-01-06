// React 防抖和节流 Hooks
import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * 防抖 Hook - 返回防抖后的函数
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  
  // 保持 fn 引用最新
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  
  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}

/**
 * 节流 Hook - 返回节流后的函数
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): T {
  const inThrottleRef = useRef(false);
  const fnRef = useRef(fn);
  
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  
  return useCallback((...args: Parameters<T>) => {
    if (!inThrottleRef.current) {
      fnRef.current(...args);
      inThrottleRef.current = true;
      setTimeout(() => { inThrottleRef.current = false; }, limit);
    }
  }, [limit]) as T;
}

/**
 * 防抖值 Hook - 返回防抖后的值
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * 防止重复点击 Hook
 */
export function useLock(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [isLocked, setIsLocked] = useState(false);
  
  const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (isLocked) return undefined;
    
    setIsLocked(true);
    try {
      return await fn();
    } finally {
      setIsLocked(false);
    }
  }, [isLocked]);
  
  return [isLocked, withLock];
}

/**
 * 异步操作 Hook - 带 loading 状态和防重复
 */
export function useAsyncAction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: { debounce?: number }
): {
  execute: (...args: Parameters<T>) => Promise<ReturnType<T> | undefined>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fnRef = useRef(fn);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  const execute = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (loading) return undefined;
    
    const doExecute = async () => {
      setLoading(true);
      setError(null);
      try {
        return await fnRef.current(...args);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        throw e;
      } finally {
        setLoading(false);
      }
    };
    
    if (options?.debounce) {
      return new Promise((resolve) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
          try {
            resolve(await doExecute());
          } catch {
            resolve(undefined);
          }
        }, options.debounce);
      });
    }
    
    return doExecute();
  }, [loading, options?.debounce]);
  
  return { execute, loading, error };
}
