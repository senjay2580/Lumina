// PWA: Service Worker 注册 + 新版本检测。
// 由 index.tsx 在应用挂载后调用。
// 检测到更新时会派发 'lumina:sw-update' 自定义事件，由 UI 层接收并弹出"刷新使用新版本"提示。

let registration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // 仅在生产 / 已部署的 https 或 localhost 环境注册
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      registration = reg;

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('lumina:sw-update'));
          }
        });
      });

      // 每小时检查一次更新
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) {
      console.warn('[PWA] SW registration failed', err);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

export function applyServiceWorkerUpdate(): void {
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}
