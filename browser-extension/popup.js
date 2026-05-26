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
// 编辑/新建：null = 不在编辑态；'new' = 新建；prompt 对象 = 编辑现有
let editingPrompt = null;

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

  // 新建按钮
  document.getElementById('new-btn').addEventListener('click', () => showEditPage(null));

  // 返回按钮
  document.getElementById('back-btn').addEventListener('click', () => {
    showMainPage();
  });

  // 详情页编辑按钮
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    if (currentPrompt) showEditPage(currentPrompt);
  });

  // 详情页复制按钮
  document.getElementById('detail-copy-btn').addEventListener('click', async () => {
    if (!currentPrompt) return;
    const content = stripHtml(currentPrompt.content);
    await navigator.clipboard.writeText(content);

    const btn = document.getElementById('detail-copy-btn');
    const originalText = btn.textContent;
    btn.textContent = '已复制';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1500);
  });

  // 编辑页：返回 / 取消 / 保存
  document.getElementById('edit-back-btn').addEventListener('click', cancelEdit);
  document.getElementById('edit-cancel-btn').addEventListener('click', cancelEdit);
  document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
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
          <div class="prompt-card-actions">
            <button class="prompt-edit-btn" data-id="${prompt.id}" title="编辑">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button class="prompt-copy-btn" data-content="${escapeHtml(content)}">复制</button>
          </div>
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

  // 编辑按钮事件
  promptsList.querySelectorAll('.prompt-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const promptId = btn.dataset.id;
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) showEditPage(prompt);
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

// ============================================
// 编辑 / 新建
// ============================================
function showEditPage(promptOrNull) {
  editingPrompt = promptOrNull || 'new';

  const titleInput = document.getElementById('edit-title');
  const categorySelect = document.getElementById('edit-category');
  const contentArea = document.getElementById('edit-content');
  const modeLabel = document.getElementById('edit-mode-label');
  const errorEl = document.getElementById('edit-error');
  errorEl.textContent = '';

  // 填充分类下拉（含"未分类"）
  categorySelect.innerHTML =
    '<option value="">未分类</option>' +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  if (promptOrNull && typeof promptOrNull === 'object') {
    modeLabel.textContent = '编辑提示词';
    titleInput.value = promptOrNull.title || '';
    categorySelect.value = promptOrNull.category_id || '';
    contentArea.value = htmlToMarkdownLite(promptOrNull.content || '');
  } else {
    modeLabel.textContent = '新建提示词';
    titleInput.value = '';
    categorySelect.value = '';
    contentArea.value = '';
  }

  loginPage.classList.add('hidden');
  mainPage.classList.add('hidden');
  detailPage.classList.add('hidden');
  document.getElementById('edit-page').classList.remove('hidden');

  setTimeout(() => titleInput.focus(), 50);
}

function cancelEdit() {
  document.getElementById('edit-page').classList.add('hidden');
  if (editingPrompt && typeof editingPrompt === 'object') {
    showDetailPage(editingPrompt);
  } else {
    showMainPage();
  }
  editingPrompt = null;
}

async function saveEdit() {
  const titleInput = document.getElementById('edit-title');
  const categorySelect = document.getElementById('edit-category');
  const contentArea = document.getElementById('edit-content');
  const errorEl = document.getElementById('edit-error');
  const saveBtn = document.getElementById('edit-save-btn');

  const title = titleInput.value.trim();
  const mdContent = contentArea.value;
  const categoryId = categorySelect.value || null;

  if (!title) { errorEl.textContent = '标题不能为空'; titleInput.focus(); return; }
  if (!mdContent.trim()) { errorEl.textContent = '内容不能为空'; contentArea.focus(); return; }
  errorEl.textContent = '';

  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = '保存中...';
  saveBtn.querySelector('.spinner').classList.remove('hidden');

  try {
    const htmlContent = renderMarkdown(mdContent);
    const isEditing = editingPrompt && typeof editingPrompt === 'object';
    let saved;
    if (isEditing) {
      saved = await updatePromptApi(editingPrompt.id, {
        title, content: htmlContent, category_id: categoryId
      });
    } else {
      saved = await createPromptApi({
        title, content: htmlContent, category_id: categoryId
      });
    }

    // 刷新内存列表
    if (isEditing) {
      const idx = prompts.findIndex(p => p.id === editingPrompt.id);
      if (idx >= 0) prompts[idx] = { ...prompts[idx], ...saved };
    } else if (saved) {
      prompts.unshift(saved);
    }

    document.getElementById('edit-page').classList.add('hidden');
    if (isEditing && saved) {
      showDetailPage(saved);
    } else {
      showMainPage();
      renderPrompts();
    }
    editingPrompt = null;
  } catch (err) {
    console.error('[Lumina] 保存失败:', err);
    errorEl.textContent = (err && err.message) || '保存失败，请稍后再试';
  } finally {
    saveBtn.disabled = false;
    saveBtn.querySelector('span').textContent = '保存';
    saveBtn.querySelector('.spinner').classList.add('hidden');
  }
}

// ============================================
// Supabase CRUD（写入）
// ============================================
async function createPromptApi(fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: currentUser.id,
      title: fields.title,
      content: fields.content,
      category_id: fields.category_id || null,
      tags: []
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`创建失败 (${res.status}) ${text.slice(0, 120)}`);
  }
  const arr = await res.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

async function updatePromptApi(id, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prompts?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      title: fields.title,
      content: fields.content,
      category_id: fields.category_id || null,
      updated_at: new Date().toISOString()
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`更新失败 (${res.status}) ${text.slice(0, 120)}`);
  }
  const arr = await res.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

// HTML → 极简 markdown 反向（编辑回填用，尽量保留标记可读性）
function htmlToMarkdownLite(html) {
  if (!html) return '';
  if (!/<[a-z]/i.test(html)) return html;
  let s = html;
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) =>
    '\n' + inner.replace(/<[^>]+>/g, '').split(/\n/).map(l => l.trim() ? '> ' + l.trim() : '').join('\n') + '\n');
  s = s.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<hr\s*\/?>/gi, '\n---\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
  s = s.replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<\/?p[^>]*>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('textarea');
  tmp.innerHTML = s;
  s = tmp.value;
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
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
