// Lumina 提示词助手 - Background Service Worker

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  console.log('[Lumina Background] Command received:', command);
  if (command === 'toggle-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        console.log('[Lumina Background] Sending togglePanel to tab:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { action: 'togglePanel' })
          .then(() => console.log('[Lumina Background] Message sent successfully'))
          .catch(err => console.log('[Lumina Background] Error sending message:', err));
      }
    });
  }
});

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装，打开设置页面
    chrome.action.openPopup();
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStorageData') {
    chrome.storage.local.get(['user', 'supabaseUrl', 'supabaseKey'], (data) => {
      sendResponse(data);
    });
    return true; // 保持消息通道开放
  }
});
