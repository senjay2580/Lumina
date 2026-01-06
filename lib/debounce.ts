// 防抖和节流工具函数

/**
 * 防抖函数 - 延迟执行，多次调用只执行最后一次
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数 - 固定时间间隔内只执行一次
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * 带取消功能的防抖
 */
export function debounceWithCancel<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): { run: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return {
    run: (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

/**
 * 异步防抖 - 防止重复提交
 */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (timeoutId) clearTimeout(timeoutId);
    
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        if (pendingPromise) {
          resolve(undefined);
          return;
        }
        
        pendingPromise = fn(...args) as Promise<ReturnType<T>>;
        try {
          const result = await pendingPromise;
          resolve(result);
        } finally {
          pendingPromise = null;
        }
      }, delay);
    });
  };
}

/**
 * 防止重复点击（锁定）
 */
export function withLock<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let isLocked = false;
  
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (isLocked) return undefined;
    
    isLocked = true;
    try {
      return await fn(...args);
    } finally {
      isLocked = false;
    }
  };
}
