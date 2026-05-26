// Lumina 提示词助手 - Background Service Worker
// 精简版：不再处理任何「打开侧边栏」的快捷键，仅保留 storage 数据查询通道。

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.action.openPopup();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.action === 'getStorageData') {
    chrome.storage.local.get(['user', 'supabaseUrl', 'supabaseKey'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});
