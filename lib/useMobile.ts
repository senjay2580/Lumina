import { useEffect, useState } from 'react';

// 移动端断点统一标准（与 tailwind.config.js 的 max-md 对齐）
export const MOBILE_BREAKPOINT = 768;

/**
 * 监听窗口宽度，返回是否处于移动端断点。
 * SSR-safe：服务端渲染时默认返回 false。
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // 兼容 Safari < 14
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  return isMobile;
}

/**
 * 判断是否为触屏设备（pointer: coarse）。
 * 适合区分"小屏笔记本+鼠标" vs "iPad+手指"。
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  return coarse;
}
