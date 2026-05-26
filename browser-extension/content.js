// Lumina 提示词助手 - Content Script (精简版)
// 不注入任何可见 UI，仅作为「popup → 当前页面」的执行通道：
//   1) 监听 'insertPrompt' 消息，把文本插入到当前网页激活的输入框/可编辑元素
//   2) 顶部弹出短暂通知告知用户结果

(function () {
  'use strict';

  // 监听来自 popup / background 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.action === 'insertPrompt') {
      insertPromptToActiveElement(message.content || '');
    }
    sendResponse({ success: true });
    return true;
  });

  // 把文本插入到当前激活的输入框/可编辑元素；找不到则复制到剪贴板
  function insertPromptToActiveElement(content) {
    const activeElement = document.activeElement;

    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)
    ) {
      if (activeElement.isContentEditable) {
        document.execCommand('insertText', false, content);
      } else {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const value = activeElement.value;
        activeElement.value = value.substring(0, start) + content + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + content.length;
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showNotification('已插入提示词');
    } else {
      navigator.clipboard.writeText(content).catch(() => {});
      showNotification('已复制到剪贴板（未找到输入框）');
    }
  }

  function showNotification(message) {
    const existing = document.getElementById('lumina-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'lumina-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('lumina-notification-hide');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  console.log('[Lumina] Content script loaded (lean mode).');
})();
