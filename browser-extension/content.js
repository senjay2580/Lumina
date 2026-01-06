// Lumina 提示词助手 - Content Script
// 侧边栏面板 - 类似 Edge Copilot

(function() {
  'use strict';

  // Supabase 配置
  const SUPABASE_URL = 'https://lladwhzdcfrvrkbendmw.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYWR3aHpkY2ZydnJrYmVuZG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNjIzMzQsImV4cCI6MjA4MjgzODMzNH0.EKPw8NuRALVvl--vEoYxmSmIv1Kvl3yUsBuCwsZ6zT4';

  let panel = null;
  let isOpen = false;
  let prompts = [];
  let categories = [];
  let currentUser = null;
  let selectedCategory = 'ALL';
  let searchQuery = '';
  let currentPrompt = null;
  let isResizing = false;

  // 监听来自 popup 和 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Lumina] Message received:', message.action);
    switch (message.action) {
      case 'togglePanel':
        console.log('[Lumina] Toggling panel from message');
        togglePanel();
        break;
      case 'syncData':
        prompts = message.data.prompts || [];
        categories = message.data.categories || [];
        currentUser = message.data.user;
        if (panel) renderPromptsList();
        break;
      case 'insertPrompt':
        insertPromptToActiveElement(message.content);
        break;
    }
    sendResponse({ success: true });
    return true;
  });

  // 切换面板显示
  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // 打开面板
  async function openPanel() {
    if (panel) {
      panel.style.display = 'flex';
      isOpen = true;
      return;
    }

    // 从存储加载用户数据
    const storage = await chrome.storage.local.get(['user']);
    currentUser = storage.user;

    if (!currentUser) {
      showNotification('请先在插件中登录');
      return;
    }

    // 加载数据
    await loadData();

    createPanel();
    isOpen = true;
  }

  // 关闭面板
  function closePanel() {
    if (panel) {
      panel.style.display = 'none';
      isOpen = false;
    }
  }

  // 加载数据
  async function loadData() {
    if (!currentUser) return;
    
    try {
      const catResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/prompt_categories?user_id=eq.${currentUser.id}&order=created_at.asc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      categories = await catResponse.json();

      const promptResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/prompts?user_id=eq.${currentUser.id}&deleted_at=is.null&order=updated_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      prompts = await promptResponse.json();
    } catch (err) {
      console.error('Load data error:', err);
    }
  }

  // 创建面板
  function createPanel() {
    panel = document.createElement('div');
    panel.id = 'lumina-prompt-panel';
    panel.innerHTML = `
      <div class="lumina-resize-handle" id="lumina-resize"></div>
      
      <!-- 列表视图 -->
      <div class="lumina-list-view" id="lumina-list-view">
        <div class="lumina-panel-header">
          <div class="lumina-panel-title">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="lumina-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FF8C00"/>
                  <stop offset="50%" stop-color="#FF6B00"/>
                  <stop offset="100%" stop-color="#E85D00"/>
                </linearGradient>
                <linearGradient id="lumina-g2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#FFB347"/>
                  <stop offset="100%" stop-color="#FF6B00"/>
                </linearGradient>
              </defs>
              <g fill="none">
                <path fill="url(#lumina-g1)" fill-rule="evenodd" d="M10.2 6L8 8a1 1 0 0 0 1.4 1.4A21 21 0 0 1 12 7.2a21 21 0 0 1 2.6 2.2A1 1 0 0 0 16.1 8l-2.2-2l2.6-1c1.2-.1 1.8 0 2.2.4c.4.5.6 1.6 0 3.4c-.7 1.8-2.1 3.9-4 5.8c-2 2-4 3.4-5.9 4c-1.8.7-3 .5-3.4 0c-.3-.3-.5-1-.3-2a9 9 0 0 1 1-2.7L8 16a1 1 0 0 0 1.3-1.5c-1.9-1.9-3.3-4-4-5.8c-.6-1.8-.4-3 0-3.4c.4-.3 1-.5 2.2-.3c.7.1 1.6.5 2.6 1ZM12 4.9c1.5-.8 2.9-1.4 4.2-1.7C17.6 3 19 3 20 4.1c1.3 1.3 1.2 3.5.4 5.5a15 15 0 0 1-1.2 2.4c.8 1.5 1.4 3 1.7 4.2c.2 1.4 0 2.9-1 3.9s-2.4 1.1-3.8.9c-1.3-.3-2.7-.9-4.2-1.7l-2.4 1.2c-2 .8-4.2 1-5.6-.4c-1-1-1.1-2.5-.9-3.9A12 12 0 0 1 4.7 12a15 15 0 0 1-1.2-2.4c-.8-2-1-4.2.4-5.6C5 3 6.5 3 8 3.1c1.2.3 2.6.9 4 1.7ZM14 18a9 9 0 0 0 2.7 1c1 .2 1.7 0 2-.3c.4-.4.6-1 .4-2.1a9 9 0 0 0-1-2.7A23.4 23.4 0 0 1 14 18" clip-rule="evenodd"/>
                <path fill="url(#lumina-g2)" d="M14 12a2 2 0 1 1-4 0a2 2 0 0 1 4 0"/>
              </g>
            </svg>
            <span>Lumina 提示词</span>
          </div>
          <button class="lumina-panel-close" id="lumina-close-btn">×</button>
        </div>
        <div class="lumina-panel-search">
          <svg class="lumina-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="lumina-search" placeholder="搜索提示词..." />
        </div>
        <div class="lumina-panel-categories" id="lumina-categories"></div>
        <div class="lumina-panel-list" id="lumina-prompts-list"></div>
      </div>
      
      <!-- 详情视图 -->
      <div class="lumina-detail-view" id="lumina-detail-view">
        <div class="lumina-detail-header">
          <button class="lumina-back-btn" id="lumina-back-btn">←</button>
          <div class="lumina-detail-title-wrap">
            <span class="lumina-detail-cat" id="lumina-detail-cat"></span>
            <div class="lumina-detail-title" id="lumina-detail-title"></div>
          </div>
        </div>
        <div class="lumina-detail-content">
          <div class="lumina-md-content" id="lumina-detail-md"></div>
        </div>
        <div class="lumina-detail-footer">
          <button class="lumina-detail-btn secondary" id="lumina-detail-copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            复制
          </button>
          <button class="lumina-detail-btn primary" id="lumina-detail-insert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            插入
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // 事件绑定
    document.getElementById('lumina-close-btn').addEventListener('click', closePanel);
    document.getElementById('lumina-search').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderPromptsList();
    });
    document.getElementById('lumina-back-btn').addEventListener('click', showListView);
    document.getElementById('lumina-detail-copy').addEventListener('click', copyCurrentPrompt);
    document.getElementById('lumina-detail-insert').addEventListener('click', insertCurrentPrompt);

    // 拖拽调整宽度
    setupResize();

    renderCategories();
    renderPromptsList();
  }

  // 设置拖拽调整宽度
  function setupResize() {
    const handle = document.getElementById('lumina-resize');
    let startX, startWidth;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      handle.classList.add('active');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const diff = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + diff, 320), 600);
      panel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.getElementById('lumina-resize').classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // 显示列表视图
  function showListView() {
    document.getElementById('lumina-list-view').classList.remove('hidden');
    document.getElementById('lumina-detail-view').classList.remove('active');
    currentPrompt = null;
  }

  // 显示详情视图
  function showDetailView(prompt) {
    currentPrompt = prompt;
    
    const category = categories.find(c => c.id === prompt.category_id);
    const categoryName = category?.name || '未分类';
    const categoryColor = category?.color || 'gray';
    
    const catEl = document.getElementById('lumina-detail-cat');
    catEl.textContent = categoryName;
    catEl.className = `lumina-detail-cat lumina-cat-${categoryColor}`;
    
    document.getElementById('lumina-detail-title').textContent = prompt.title;
    
    const content = stripHtml(prompt.content);
    document.getElementById('lumina-detail-md').innerHTML = renderMarkdown(content);
    
    document.getElementById('lumina-list-view').classList.add('hidden');
    document.getElementById('lumina-detail-view').classList.add('active');
  }

  // 复制当前提示词
  async function copyCurrentPrompt() {
    if (!currentPrompt) return;
    const content = stripHtml(currentPrompt.content);
    await navigator.clipboard.writeText(content);
    showNotification('已复制到剪贴板');
  }

  // 插入当前提示词
  function insertCurrentPrompt() {
    if (!currentPrompt) return;
    const content = stripHtml(currentPrompt.content);
    insertPromptToActiveElement(content);
    closePanel();
  }

  // 渲染分类
  function renderCategories() {
    const container = document.getElementById('lumina-categories');
    if (!container) return;

    container.innerHTML = `
      <button class="lumina-cat-btn ${selectedCategory === 'ALL' ? 'active' : ''}" data-id="ALL">全部</button>
      ${categories.map(cat => `
        <button class="lumina-cat-btn ${selectedCategory === cat.id ? 'active' : ''}" data-id="${cat.id}">${escapeHtml(cat.name)}</button>
      `).join('')}
    `;

    container.querySelectorAll('.lumina-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.id;
        renderCategories();
        renderPromptsList();
      });
    });
  }

  // 渲染提示词列表
  function renderPromptsList() {
    const container = document.getElementById('lumina-prompts-list');
    if (!container) return;

    const filtered = prompts.filter(p => {
      const matchCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const matchSearch = !searchQuery || 
        p.title.toLowerCase().includes(searchQuery) || 
        p.tags?.some(t => t.toLowerCase().includes(searchQuery));
      return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="lumina-prompts-grid"><div class="lumina-empty">没有找到提示词</div></div>';
      return;
    }

    container.innerHTML = `<div class="lumina-prompts-grid">${filtered.map(prompt => {
      const category = categories.find(c => c.id === prompt.category_id);
      const categoryName = category?.name || '未分类';
      const categoryColor = category?.color || 'gray';
      const content = stripHtml(prompt.content);

      return `
        <div class="lumina-prompt-item" data-id="${prompt.id}">
          <div class="lumina-prompt-header">
            <span class="lumina-prompt-cat lumina-cat-${categoryColor}">${escapeHtml(categoryName)}</span>
            <div class="lumina-prompt-actions">
              <button class="lumina-btn-copy" data-content="${escapeHtml(content)}" title="复制">📋</button>
            </div>
          </div>
          <div class="lumina-prompt-title">${escapeHtml(prompt.title)}</div>
          <div class="lumina-prompt-content">${escapeHtml(content.substring(0, 120))}${content.length > 120 ? '...' : ''}</div>
        </div>
      `;
    }).join('')}</div>`;

    // 绑定事件
    container.querySelectorAll('.lumina-prompt-item').forEach(item => {
      const promptId = item.dataset.id;
      const prompt = prompts.find(p => p.id === promptId);

      // 复制按钮
      item.querySelector('.lumina-btn-copy').addEventListener('click', async (e) => {
        e.stopPropagation();
        const content = e.target.closest('.lumina-btn-copy').dataset.content;
        await navigator.clipboard.writeText(content);
        showNotification('已复制到剪贴板');
      });

      // 点击卡片打开详情
      item.addEventListener('click', () => {
        if (prompt) showDetailView(prompt);
      });
    });
  }

  // Markdown 渲染
  function renderMarkdown(text) {
    if (!text) return '';
    
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
    
    return `<p>${html}</p>`;
  }

  // 插入提示词到当前活动元素
  function insertPromptToActiveElement(content) {
    const activeElement = document.activeElement;
    
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    )) {
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
      navigator.clipboard.writeText(content);
      showNotification('已复制到剪贴板（未找到输入框）');
    }
  }

  // 显示通知
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

  // 工具函数
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 监听快捷键
  document.addEventListener('keydown', (e) => {
    const isAltShiftL = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && 
      (e.key === 'L' || e.key === 'l' || e.code === 'KeyL');
    
    if (isAltShiftL) {
      console.log('[Lumina] Alt+Shift+L detected, toggling panel');
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
      return false;
    }
    
    if (e.key === 'Escape' && isOpen) {
      closePanel();
    }
  }, true);

  console.log('[Lumina] Content script loaded. Press Alt+Shift+L to open panel.');

})();
