// Markdown 导入导出工具
import { marked } from 'marked';

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

// 高清导出 PNG：基于 html-to-image，pixelRatio 默认 2.5x
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
  options?: { pixelRatio?: number; backgroundColor?: string }
): Promise<void> {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(el, {
    pixelRatio: options?.pixelRatio ?? 2.5,
    backgroundColor: options?.backgroundColor ?? '#FAF9F5',
    cacheBust: true
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 导出 PDF：A4 / 多页拼接
export async function exportElementToPdf(
  el: HTMLElement,
  filename: string,
  options?: { backgroundColor?: string }
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: options?.backgroundColor ?? '#FAF9F5',
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight
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
}
