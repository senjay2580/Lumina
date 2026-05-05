// Markdown 导入导出工具
import { marked } from 'marked';
import katex from 'katex';

// HTML → Markdown：处理 TipTap 输出的常见标签
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // 块级换行 / 分割线
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 代码块（含或不含 <code> 包裹）
  md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, c) => {
    return '\n\n```\n' + decodeEntities(c).trim() + '\n```\n\n';
  });
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
    return '\n\n```\n' + decodeEntities(c).trim() + '\n```\n\n';
  });

  // 行内代码
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + decodeEntities(c) + '`');

  // 强调
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // 图片（不同属性顺序兼容）
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)');

  // 链接
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 引用
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const inner = content.replace(/<[^>]+>/g, '').trim();
    return '\n\n' + inner.split('\n').map((l: string) => '> ' + l.trim()).join('\n') + '\n\n';
  });

  // 列表
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return '\n\n' + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n').trim() + '\n\n';
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let i = 0;
    const items = content
      .split(/<li[^>]*>/i)
      .slice(1)
      .map((part: string) => part.split(/<\/li>/i)[0])
      .map((text: string) => `${++i}. ${text.trim()}`)
      .join('\n');
    return '\n\n' + items + '\n\n';
  });

  // 段落
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');

  // div / span 透传
  md = md.replace(/<\/?(div|span|figure|figcaption)[^>]*>/gi, '');

  // 兜底：剩余标签去除
  md = md.replace(/<[^>]+>/g, '');

  // 解码 HTML 实体
  md = decodeEntities(md);

  // 收敛多余空行
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Markdown → HTML：编辑器与详情页统一渲染
export function markdownToHtml(md: string): string {
  if (!md) return '';
  return marked.parse(md, { async: false }) as string;
}

function renderMathFormula(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false
    });
  } catch {
    return escapeHtml(source);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMathInText(text: string): Node[] {
  const nodes: Node[] = [];
  const re = /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\$)\$([^\n$]+?)\$(?!\$))/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(document.createTextNode(text.slice(last, m.index)));

    const displayMode = Boolean(m[2] || m[3]);
    const formula = (m[2] || m[3] || m[4] || m[5] || '').trim();
    const wrapper = document.createElement(displayMode ? 'div' : 'span');
    wrapper.className = displayMode ? 'article-math article-math-display' : 'article-math article-math-inline';
    wrapper.innerHTML = renderMathFormula(formula, displayMode);
    nodes.push(wrapper);
    last = re.lastIndex;
  }

  if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
  return nodes;
}

export function renderMathInHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined' || typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div id="__math_root">${html}</div>`, 'text/html');
  const root = doc.querySelector('#__math_root');
  if (!root) return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code, pre, kbd, samp, script, style, .katex')) return NodeFilter.FILTER_REJECT;
      return /(\$|\\\(|\\\[)/.test(node.textContent || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    const rendered = renderMathInText(node.textContent || '');
    if (rendered.length === 1 && rendered[0].nodeType === Node.TEXT_NODE) continue;
    node.replaceWith(...rendered);
  }

  return root.innerHTML;
}

export function articleContentToHtml(content: string): string {
  if (!content) return '';
  const html = looksLikeHtml(content) ? content : markdownToHtml(content);
  return renderMathInHtml(html);
}

// 内容看起来是 HTML 还是 Markdown
export function looksLikeHtml(content: string): boolean {
  return /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|code|img|strong|em|hr|br|a)[\s>]/i.test(content);
}

// 触发浏览器下载文本文件
export function downloadTextFile(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 文件名安全化
export function safeFileName(name: string, fallback = 'untitled'): string {
  const cleaned = (name || '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  return cleaned || fallback;
}

// 选择并读取本地 .md 文件内容
export function pickMarkdownFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result || '');
        resolve({ name: file.name, content });
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  });
}

// 从 markdown 提取第一行 # 作为标题（可选）
export function extractTitleFromMarkdown(md: string): string | undefined {
  if (!md) return undefined;
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : undefined;
}

// 把现有文章内容（可能是 HTML 或 MD）统一转成纯 Markdown 用于导出
export function articleContentToMarkdown(content: string): string {
  if (!content) return '';
  return looksLikeHtml(content) ? htmlToMarkdown(content) : content;
}

// 导入 markdown 时，统一转成 HTML（适配 TipTap 编辑器与详情页）
export function importedMarkdownToContent(md: string): string {
  return markdownToHtml(md);
}

// 在屏幕上但视觉隐藏地构造一个导出专用容器，把源节点的内容克隆进来
// 必须保留布局可见（layout in render tree），否则 html-to-image / html2canvas 拍出来是空白
function buildExportContainer(
  source: HTMLElement,
  options: { contentWidth: number; padding: number; backgroundColor: string }
): { container: HTMLElement; cleanup: () => void } {
  const total = options.contentWidth + options.padding * 2;

  const container = document.createElement('div');
  container.setAttribute('data-export-frame', '1');
  // 让浏览器实际渲染（保留 layout），但用户看不到
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.zIndex = '-1';
  container.style.opacity = '0.001'; // 几乎不可见，但保留 paint
  container.style.pointerEvents = 'none';
  container.style.width = `${total}px`;
  container.style.padding = `${options.padding}px`;
  container.style.background = options.backgroundColor;
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = "'Fraunces','Source Serif Pro','Iowan Old Style','Georgia',serif";
  container.style.color = '#1F1E1D';
  // 复制所需 CSS 变量到容器，让 var(--xxx) 在克隆树里也生效
  container.style.setProperty('--bg', '#FCFBF7');
  container.style.setProperty('--bg-alt', '#F6F4ED');
  container.style.setProperty('--ink', '#1F1E1D');
  container.style.setProperty('--ink-soft', '#3A3936');
  container.style.setProperty('--ink-muted', '#6B6A65');
  container.style.setProperty('--ink-faint', '#8E8C85');
  container.style.setProperty('--rule', '#E8E6DC');
  container.style.setProperty('--rule-strong', '#D8D5C7');
  container.style.setProperty('--accent', '#D97757');
  container.style.setProperty('--accent-soft', '#F4D9CC');
  container.style.setProperty('--accent-deep', '#B85B3F');
  container.style.setProperty('--code-bg', '#F2F0E8');
  container.style.setProperty('--serif', "'Fraunces','Source Serif Pro','Iowan Old Style','Georgia',serif");
  container.style.setProperty('--sans', "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif");
  container.style.setProperty('--mono', "'JetBrains Mono','IBM Plex Mono',ui-monospace,monospace");

  const inner = document.createElement('div');
  inner.style.width = `${options.contentWidth}px`;
  inner.style.margin = '0 auto';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = 'none';
  clone.style.width = '100%';
  clone.style.transition = 'none';

  inner.appendChild(clone);
  container.appendChild(inner);
  document.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  };
}

// 高清导出 PNG
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
  options?: { pixelRatio?: number; backgroundColor?: string; contentWidth?: number; padding?: number }
): Promise<void> {
  const { toPng } = await import('html-to-image');
  const contentWidth = options?.contentWidth ?? 880;
  const padding = options?.padding ?? 120;
  const bg = options?.backgroundColor ?? '#FCFBF7';
  const { container, cleanup } = buildExportContainer(el, { contentWidth, padding, backgroundColor: bg });
  try {
    // 等两帧让浏览器完成布局
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toPng(container, {
      pixelRatio: options?.pixelRatio ?? 3,
      backgroundColor: bg,
      cacheBust: true,
      width: container.offsetWidth,
      height: container.offsetHeight,
      style: { opacity: '1' }
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    cleanup();
  }
}

// 导出 PDF：A4 / 多页拼接
export async function exportElementToPdf(
  el: HTMLElement,
  filename: string,
  options?: { backgroundColor?: string; contentWidth?: number; padding?: number }
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);

  const contentWidth = options?.contentWidth ?? 720;
  const padding = options?.padding ?? 72;
  const bg = options?.backgroundColor ?? '#FCFBF7';
  const { container, cleanup } = buildExportContainer(el, { contentWidth, padding, backgroundColor: bg });
  try {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    // html2canvas 不读 opacity，但会读取 visibility/display；我们用 onclone 把容器透明度还原
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: bg,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
      onclone: (doc) => {
        const target = doc.querySelector<HTMLElement>('[data-export-frame="1"]');
        if (target) {
          target.style.opacity = '1';
          target.style.position = 'static';
        }
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / pageWidth;
    const imgHeightPt = canvas.height / ratio;

    let position = 0;
    let remaining = imgHeightPt;
    while (remaining > 0) {
      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeightPt);
      remaining -= pageHeight;
      if (remaining > 0) {
        pdf.addPage();
        position -= pageHeight;
      }
    }
    pdf.save(filename);
  } finally {
    cleanup();
  }
}
