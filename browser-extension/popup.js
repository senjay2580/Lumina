// Lumina 提示词助手 - Popup 脚本

// ============================================
// Supabase 配置
// ============================================
const SUPABASE_URL = 'https://lladwhzdcfrvrkbendmw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYWR3aHpkY2ZydnJrYmVuZG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNjIzMzQsImV4cCI6MjA4MjgzODMzNH0.EKPw8NuRALVvl--vEoYxmSmIv1Kvl3yUsBuCwsZ6zT4';

// 状态
let currentUser = null;
let prompts = [];
let categories = [];
let selectedCategory = 'ALL';
let currentPrompt = null;

// DOM 元素
const loginPage = document.getElementById('login-page');
const mainPage = document.getElementById('main-page');
const detailPage = document.getElementById('detail-page');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const searchInput = document.getElementById('search-input');
const categoriesContainer = document.getElementById('categories');
const promptsList = document.getElementById('prompts-list');
const userName = document.getElementById('user-name');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
});

// ============================================
// 简单的 Markdown 渲染器
// ============================================
function renderMarkdown(text) {
  if (!text) return '';
  
  let html = text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 标题
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 引用
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // 无序列表
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // 水平线
    .replace(/^---$/gm, '<hr>')
    // 换行
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // 包装列表项
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // 合并连续的 ul
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  // 合并连续的 blockquote
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
  
  return `<p>${html}</p>`;
}

// ============================================
// Supabase REST API 调用
// ============================================
async function supabaseQuery(table, options = {}) {
  let endpoint = `${SUPABASE_URL}/rest/v1/${table}`;
  const params = new URLSearchParams();
  
  if (options.select) params.append('select', options.select);
  if (options.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      params.append(col, `eq.${val}`);
    }
  }
  if (options.is) {
    for (const [col, val] of Object.entries(options.is)) {
      params.append(col, `is.${val}`);
    }
  }
  if (options.order) {
    params.append('order', options.order);
  }
  
  const queryString = params.toString();
  if (queryString) endpoint += '?' + queryString;
  
  const response = await fetch(endpoint, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return options.single ? data[0] : data;
}

// 检查认证状态
async function checkAuth() {
  const { user } = await chrome.storage.local.get('user');
  
  if (user) {
    currentUser = user;
    showMainPage();
    await loadData();
  } else {
    showLoginPage();
  }
}

// 设置事件监听
function setupEventListeners() {
  // 登录表单
  loginForm.addEventListener('submit', handleLogin);
  
  // 退出登录
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  
  // 搜索
  searchInput.addEventListener('input', renderPrompts);
  
  // 返回按钮
  document.getElementById('back-btn').addEventListener('click', () => {
    showMainPage();
  });
  
  // 详情页复制按钮
  document.getElementById('detail-copy-btn').addEventListener('click', async () => {
    if (!currentPrompt) return;
    const content = stripHtml(currentPrompt.content);
    await navigator.clipboard.writeText(content);
    
    const btn = document.getElementById('detail-copy-btn');
    btn.textContent = '已复制';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '复制';
      btn.classList.remove('copied');
    }, 1500);
  });
}

// 处理登录
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  
  loginBtn.disabled = true;
  loginBtn.querySelector('span').textContent = '登录中...';
  loginBtn.querySelector('.spinner').classList.remove('hidden');
  loginError.textContent = '';
  
  try {
    const passwordHash = await hashPassword(password);
    const isEmail = username.includes('@');
    const user = await supabaseQuery('users', {
      select: 'id,username,email,email_verified,created_at,password_hash',
      eq: isEmail ? { email: username.toLowerCase() } : { username: username.toLowerCase() },
      single: true
    });
    
    if (!user) {
      throw new Error('用户名或密码错误');
    }
    
    if (user.password_hash !== passwordHash) {
      throw new Error('用户名或密码错误');
    }
    
    const { password_hash, ...userData } = user;
    currentUser = userData;
    await chrome.storage.local.set({ user: userData });
    
    showMainPage();
    await loadData();
    
  } catch (err) {
    loginError.textContent = err.message || '登录失败';
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector('span').textContent = '登录';
    loginBtn.querySelector('.spinner').classList.add('hidden');
  }
}

// 密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lumina_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 退出登录
async function handleLogout() {
  currentUser = null;
  await chrome.storage.local.remove('user');
  showLoginPage();
}

// 显示登录页
function showLoginPage() {
  loginPage.classList.remove('hidden');
  mainPage.classList.add('hidden');
  detailPage.classList.add('hidden');
}

// 显示主页
function showMainPage() {
  loginPage.classList.add('hidden');
  mainPage.classList.remove('hidden');
  detailPage.classList.add('hidden');
  userName.textContent = currentUser?.username || '';
}

// 显示详情页
function showDetailPage(prompt) {
  currentPrompt = prompt;
  
  const category = categories.find(c => c.id === prompt.category_id);
  const categoryName = category?.name || '未分类';
  const categoryColor = category?.color || 'gray';
  
  document.getElementById('detail-category').textContent = categoryName;
  document.getElementById('detail-category').className = `prompt-category cat-${categoryColor}`;
  document.getElementById('detail-title').textContent = prompt.title;
  
  // 渲染标签
  const tagsContainer = document.getElementById('detail-tags');
  if (prompt.tags?.length) {
    tagsContainer.innerHTML = prompt.tags.map(tag => 
      `<span class="prompt-tag">#${escapeHtml(tag)}</span>`
    ).join('');
  } else {
    tagsContainer.innerHTML = '';
  }
  
  // 渲染内容（支持 MD）
  const content = stripHtml(prompt.content);
  document.getElementById('detail-content').innerHTML = renderMarkdown(content);
  
  loginPage.classList.add('hidden');
  mainPage.classList.add('hidden');
  detailPage.classList.remove('hidden');
}

// 加载数据
async function loadData() {
  if (!currentUser) return;
  
  promptsList.innerHTML = '<div class="loading">加载中...</div>';
  
  try {
    categories = await supabaseQuery('prompt_categories', {
      select: '*',
      eq: { user_id: currentUser.id },
      order: 'created_at.asc'
    }) || [];
    
    prompts = await supabaseQuery('prompts', {
      select: '*',
      eq: { user_id: currentUser.id },
      is: { deleted_at: 'null' },
      order: 'updated_at.desc'
    }) || [];
    
    renderCategories();
    renderPrompts();
    
    // 同步到 content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'syncData',
          data: { prompts, categories, user: currentUser }
        }).catch(() => {});
      }
    });
    
  } catch (err) {
    console.error('Load data error:', err);
    promptsList.innerHTML = '<div class="empty-state">加载失败，请重试</div>';
  }
}

// 渲染分类
function renderCategories() {
  categoriesContainer.innerHTML = `
    <button class="category-btn ${selectedCategory === 'ALL' ? 'active' : ''}" data-id="ALL">全部</button>
    ${categories.map(cat => `
      <button class="category-btn ${selectedCategory === cat.id ? 'active' : ''}" data-id="${cat.id}">${cat.name}</button>
    `).join('')}
  `;
  
  categoriesContainer.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.id;
      renderCategories();
      renderPrompts();
    });
  });
}

// 渲染提示词列表
function renderPrompts() {
  const search = searchInput.value.toLowerCase();
  
  const filtered = prompts.filter(p => {
    const matchCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    const matchSearch = !search || 
      p.title.toLowerCase().includes(search) || 
      p.tags?.some(t => t.toLowerCase().includes(search));
    return matchCategory && matchSearch;
  });
  
  if (filtered.length === 0) {
    promptsList.innerHTML = '<div class="empty-state">没有找到提示词</div>';
    return;
  }
  
  promptsList.innerHTML = filtered.map(prompt => {
    const category = categories.find(c => c.id === prompt.category_id);
    const categoryName = category?.name || '未分类';
    const categoryColor = category?.color || 'gray';
    const content = stripHtml(prompt.content);
    
    return `
      <div class="prompt-card" data-id="${prompt.id}">
        <div class="prompt-card-header">
          <span class="prompt-category cat-${categoryColor}">${categoryName}</span>
          <button class="prompt-copy-btn" data-content="${escapeHtml(content)}">复制</button>
        </div>
        <div class="prompt-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-content">${escapeHtml(content)}</div>
        ${prompt.tags?.length ? `
          <div class="prompt-tags">
            ${prompt.tags.map(tag => `<span class="prompt-tag">#${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // 复制按钮事件
  promptsList.querySelectorAll('.prompt-copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const content = btn.dataset.content;
      await navigator.clipboard.writeText(content);
      
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 1500);
    });
  });
  
  // 卡片点击 - 打开详情页
  promptsList.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const promptId = card.dataset.id;
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) {
        showDetailPage(prompt);
      }
    });
  });
}

// 工具函数
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
