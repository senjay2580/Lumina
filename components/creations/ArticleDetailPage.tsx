// 文章详情页（博客阅读体验：Anthropic 暖调 + 极光 + 浮动目录 + 进度条 + 导入导出）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Edit2, Trash2, Calendar, ArrowUp, List, Clock, Tag,
  Maximize2, Minimize2, AlignCenter, Download, FileDown, Image as ImageIcon, FileText, ChevronDown
} from 'lucide-react';
import { marked } from 'marked';
import { getArticle, deleteArticle, type Article } from '../../lib/articles';
import { Confirm } from '../../shared/Confirm';
import {
  articleContentToMarkdown,
  downloadTextFile,
  exportElementToPng,
  exportElementToPdf,
  safeFileName
} from '../../lib/markdown-io';

interface Props {
  articleId: string;
  initial?: Article | null;
  onBack: () => void;
  onEdit: (article: Article) => void;
  onDeleted: () => void;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

type WidthMode = 'compact' | 'standard' | 'wide';

const WIDTH_PRESETS: Record<WidthMode, { article: number; toc: number; label: string }> = {
  compact: { article: 760, toc: 220, label: '紧凑' },
  standard: { article: 880, toc: 240, label: '标准' },
  wide: { article: 1040, toc: 260, label: '宽阔' }
};

const WIDTH_STORAGE_KEY = 'lumina:article:width';

function slugify(text: string, fallbackIdx: number): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return base || `heading-${fallbackIdx}`;
}

export default function ArticleDetailPage({ articleId, initial, onBack, onEdit, onDeleted }: Props) {
  const [article, setArticle] = useState<Article | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [showTocMobile, setShowTocMobile] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'md' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [widthMode, setWidthMode] = useState<WidthMode>(() => {
    if (typeof window === 'undefined') return 'wide';
    const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY) as WidthMode | null;
    return stored && stored in WIDTH_PRESETS ? stored : 'wide';
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const articleBodyRef = useRef<HTMLElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, widthMode);
    } catch {}
  }, [widthMode]);

  // 点击外部关闭导出菜单
  useEffect(() => {
    if (!showExportMenu) return;
    const onClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showExportMenu]);

  const cycleWidth = () => {
    const order: WidthMode[] = ['compact', 'standard', 'wide'];
    const idx = order.indexOf(widthMode);
    setWidthMode(order[(idx + 1) % order.length]);
  };

  const widthIcon =
    widthMode === 'compact'
      ? <Minimize2 className="w-4 h-4" />
      : widthMode === 'wide'
      ? <Maximize2 className="w-4 h-4" />
      : <AlignCenter className="w-4 h-4" />;

  const preset = WIDTH_PRESETS[widthMode];
  const containerMaxWidth = preset.article + preset.toc + 64;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!initial) setLoading(true);
        const data = await getArticle(articleId);
        if (active) setArticle(data);
      } catch (err) {
        console.error('Failed to load article:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [articleId, initial]);

  // 解析 HTML 时同步注入 heading id 并生成 TOC，保证 id 在首次渲染就在 DOM 上
  const { html, tocFromHtml } = useMemo(() => {
    if (!article?.content) return { html: '', tocFromHtml: [] as TocItem[] };
    const raw = marked.parse(article.content, { async: false }) as string;
    if (typeof DOMParser === 'undefined') return { html: raw, tocFromHtml: [] };
    const doc = new DOMParser().parseFromString(`<div id="__article_root">${raw}</div>`, 'text/html');
    const root = doc.querySelector('#__article_root');
    if (!root) return { html: raw, tocFromHtml: [] };
    const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3');
    const seen = new Set<string>();
    const items: TocItem[] = [];
    headings.forEach((h, idx) => {
      const text = h.textContent?.trim() || '';
      if (!text) return;
      let id = slugify(text, idx);
      let suffix = 1;
      const baseId = id;
      while (seen.has(id)) id = `${baseId}-${++suffix}`;
      seen.add(id);
      h.setAttribute('id', id);
      const level = Number(h.tagName.substring(1));
      items.push({ id, text, level });
    });
    return { html: root.innerHTML, tocFromHtml: items };
  }, [article?.content]);

  useEffect(() => {
    setToc(tocFromHtml);
  }, [tocFromHtml]);

  const wordCount = useMemo(() => {
    if (!article?.content) return 0;
    const plain = article.content.replace(/<[^>]+>/g, '').replace(/[#>*`_\-\[\]\(\)]/g, '');
    const words = plain.match(/[一-龥]|[a-zA-Z]+/g);
    return words ? words.length : 0;
  }, [article?.content]);

  const readingMinutes = Math.max(1, Math.round(wordCount / 350));

  // 注入 heading id + 提取 TOC
  useEffect(() => {
    if (!articleRef.current || !html) return;
    const headings = articleRef.current.querySelectorAll<HTMLElement>('h1, h2, h3');
    const items: TocItem[] = [];
    const seen = new Set<string>();
    headings.forEach((h, idx) => {
      const text = h.textContent?.trim() || '';
      if (!text) return;
      let id = h.id || slugify(text, idx);
      // 防 id 重复
      let suffix = 1;
      let baseId = id;
      while (seen.has(id)) id = `${baseId}-${++suffix}`;
      seen.add(id);
      h.id = id;
      const level = Number(h.tagName.substring(1));
      items.push({ id, text, level });
    });
    setToc(items);
  }, [html]);

  // 滚动 → 进度条 / 回顶 / 当前激活标题
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrolled = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, (scrolled / max) * 100) : 0;
      setProgress(pct);
      setShowBackTop(scrolled > 600);

      if (articleRef.current) {
        const headings = Array.from(
          articleRef.current.querySelectorAll<HTMLElement>('h1, h2, h3')
        );
        // 找到最近视口顶部偏移 120px 处的标题
        const containerTop = el.getBoundingClientRect().top;
        let current = '';
        for (const h of headings) {
          const rect = h.getBoundingClientRect();
          const offset = rect.top - containerTop;
          if (offset <= 130) current = h.id;
          else break;
        }
        setActiveId(current);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [html, toc.length]);

  // 滚动到标题：用 getBoundingClientRect 在 scroll 容器内计算偏移
  const scrollToHeading = useCallback((id: string) => {
    const container = scrollRef.current;
    if (!container) return;
    // 优先 getElementById，再退到 querySelector
    let target: HTMLElement | null = null;
    if (articleRef.current) {
      target = articleRef.current.querySelector<HTMLElement>(`[id="${id}"]`);
    }
    if (!target) target = document.getElementById(id);
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const newTop = container.scrollTop + (targetRect.top - containerRect.top) - 96;
    container.scrollTo({ top: Math.max(0, newTop), behavior: 'smooth' });
    setShowTocMobile(false);
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!article) return;
    try {
      await deleteArticle(article.id);
      setConfirmOpen(false);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete article:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 导出
  const baseFileName = useMemo(
    () => safeFileName(article?.title || '无标题'),
    [article?.title]
  );

  const handleExportMd = () => {
    if (!article) return;
    setExporting('md');
    setShowExportMenu(false);
    try {
      const md = articleContentToMarkdown(article.content);
      // 加上 frontmatter 元信息
      const frontmatter = [
        '---',
        `title: ${article.title || '无标题'}`,
        `date: ${article.created_at}`,
        article.excerpt ? `excerpt: ${article.excerpt}` : null,
        article.tags && article.tags.length ? `tags: [${article.tags.map((t) => JSON.stringify(t)).join(', ')}]` : null,
        article.cover_url ? `cover: ${article.cover_url}` : null,
        '---',
        '',
        md
      ].filter((x) => x !== null).join('\n');
      downloadTextFile(`${baseFileName}.md`, frontmatter);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPng = async () => {
    if (!articleBodyRef.current) return;
    setExporting('png');
    setShowExportMenu(false);
    try {
      await exportElementToPng(articleBodyRef.current, `${baseFileName}.png`, {
        pixelRatio: 3,
        backgroundColor: '#FCFBF7',
        contentWidth: 880,
        padding: 120
      });
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('图片导出失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!articleBodyRef.current) return;
    setExporting('pdf');
    setShowExportMenu(false);
    try {
      await exportElementToPdf(articleBodyRef.current, `${baseFileName}.pdf`, {
        backgroundColor: '#FCFBF7',
        contentWidth: 720,
        padding: 72
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF 导出失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-stone-500">加载中...</div>
    );
  }
  if (!article) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <p className="text-stone-500">文章不存在或已被删除</p>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-stone-900 hover:bg-stone-900 hover:text-white transition-colors rounded-md"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="article-page w-full h-full relative">
      {/* 背景：极光 + 同心圆环 + 流式线条 */}
      <div className="article-bg-layer" aria-hidden="true">
        <div className="article-aurora-blob article-aurora-blob-1" />
        <div className="article-aurora-blob article-aurora-blob-2" />
        <div className="article-aurora-blob article-aurora-blob-3" />

        {/* 右上：同心圆环（accent 渐变描边） */}
        <svg className="article-bg-rings" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#D97757" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#D97757" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="300" cy="300" r="280" fill="none" stroke="url(#ringGrad)" strokeWidth="1.2" />
          <circle cx="300" cy="300" r="220" fill="none" stroke="url(#ringGrad)" strokeWidth="0.8" />
          <circle cx="300" cy="300" r="160" fill="none" stroke="url(#ringGrad)" strokeWidth="0.6" />
        </svg>

        {/* 顶部：Windsurf 风格流式线条 */}
        <svg
          className="article-bg-flow"
          viewBox="0 0 1600 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="flowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D97757" stopOpacity="0" />
              <stop offset="50%" stopColor="#D97757" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#D97757" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="flowGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C58A6F" stopOpacity="0" />
              <stop offset="50%" stopColor="#C58A6F" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#C58A6F" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="flowGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A8957F" stopOpacity="0" />
              <stop offset="50%" stopColor="#A8957F" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#A8957F" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,160 Q200,80 400,160 T800,160 T1200,160 T1600,160"
            fill="none"
            stroke="url(#flowGrad1)"
            strokeWidth="1.6"
            strokeDasharray="6 5"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-22" dur="6s" repeatCount="indefinite" />
          </path>
          <path
            d="M0,200 Q260,120 520,200 T1040,200 T1600,200"
            fill="none"
            stroke="url(#flowGrad2)"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="18" dur="7s" repeatCount="indefinite" />
          </path>
          <path
            d="M0,120 Q300,200 600,120 T1200,120 T1600,120"
            fill="none"
            stroke="url(#flowGrad3)"
            strokeWidth="1"
            strokeDasharray="4 4"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="8s" repeatCount="indefinite" />
          </path>
          <path
            d="M0,240 Q220,160 440,240 T880,240 T1320,240 T1600,240"
            fill="none"
            stroke="url(#flowGrad1)"
            strokeWidth="0.8"
            strokeDasharray="3 5"
            opacity="0.7"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="9s" repeatCount="indefinite" />
          </path>
        </svg>

        <div className="article-bg-grain" />
      </div>

      {/* 阅读进度条 */}
      <div className="article-progress" style={{ width: `${progress}%` }} />

      <div ref={scrollRef} className="article-scroll w-full h-full overflow-y-auto relative">
        {/* 顶部操作栏 */}
        <div className="article-topbar">
          <div
            className="mx-auto px-6 md:px-10 py-4 flex items-center justify-between"
            style={{ maxWidth: `${containerMaxWidth}px` }}
          >
            <button onClick={onBack} className="article-link-btn flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回列表
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={cycleWidth}
                className="article-icon-btn"
                title={`阅读宽度：${preset.label}（点击切换）`}
                aria-label="切换阅读宽度"
              >
                {widthIcon}
              </button>
              <button
                onClick={() => setShowTocMobile((v) => !v)}
                className="article-icon-btn lg:hidden"
                title="目录"
                aria-label="目录"
              >
                <List className="w-4 h-4" />
              </button>

              {/* 导出下拉菜单 */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  className="article-secondary-btn flex items-center gap-1"
                  disabled={exporting !== null}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{exporting ? '导出中…' : '导出'}</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                </button>
                {showExportMenu && (
                  <div className="article-export-menu">
                    <button onClick={handleExportMd} className="article-export-item">
                      <FileText className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">导出 Markdown</div>
                        <div className="article-export-sub">.md 文件，含 frontmatter</div>
                      </div>
                    </button>
                    <button onClick={handleExportPng} className="article-export-item">
                      <ImageIcon className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">导出图片</div>
                        <div className="article-export-sub">高清 PNG（3x 像素）</div>
                      </div>
                    </button>
                    <button onClick={handleExportPdf} className="article-export-item">
                      <FileDown className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">导出 PDF</div>
                        <div className="article-export-sub">A4 排版，多页拼接</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => onEdit(article)}
                className="article-secondary-btn flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">编辑</span>
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="article-danger-btn flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">删除</span>
              </button>
            </div>
          </div>
        </div>

        {/* 文章正文 */}
        <div
          className="article-container mx-auto px-6 md:px-10 pb-32 relative"
          style={{ maxWidth: `${containerMaxWidth}px` }}
        >
          <div
            className="article-grid gap-12"
            style={
              {
                '--article-w': `${preset.article}px`,
                '--toc-w': `${preset.toc}px`
              } as React.CSSProperties
            }
          >
            <article ref={articleBodyRef} className="article-body min-w-0">
              {/* 标题区 */}
              <header className="mb-12 pt-12 relative">
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {article.tags.map((t) => (
                      <span key={t} className="article-tag">{t}</span>
                    ))}
                  </div>
                )}
                <h1 className="article-title">{article.title || '无标题'}</h1>

                <div className="article-meta">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(article.created_at)}
                  </span>
                  <span className="article-meta-sep">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {readingMinutes} 分钟阅读
                  </span>
                  {article.updated_at && article.updated_at !== article.created_at && (
                    <>
                      <span className="article-meta-sep">·</span>
                      <span>更新于 {formatDate(article.updated_at)}</span>
                    </>
                  )}
                </div>
              </header>

              {article.cover_url && (
                <figure className="article-cover">
                  <img
                    src={article.cover_url}
                    alt={article.title || ''}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </figure>
              )}

              {article.excerpt && (
                <p className="article-lede">{article.excerpt}</p>
              )}

              <div
                ref={articleRef}
                className="article-prose"
                dangerouslySetInnerHTML={{ __html: html }}
              />

              {/* 文末分隔 + 装饰 SVG */}
              <div className="article-footer">
                <svg
                  className="article-footer-flourish"
                  viewBox="0 0 200 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0 12 H80 M120 12 H200"
                    stroke="#D8D5C7"
                    strokeWidth="1"
                  />
                  <circle cx="100" cy="12" r="3.5" fill="none" stroke="#D97757" strokeOpacity="0.7" />
                  <circle cx="100" cy="12" r="1" fill="#D97757" />
                </svg>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-8">
                    <Tag className="w-4 h-4 text-stone-400" />
                    {article.tags.map((t) => (
                      <span key={t} className="article-tag">{t}</span>
                    ))}
                  </div>
                )}
                <button onClick={scrollToTop} className="article-link-btn flex items-center gap-2 mt-6">
                  <ArrowUp className="w-4 h-4" />
                  回到顶部
                </button>
              </div>
            </article>

            {/* 侧边浮动目录（桌面） */}
            {toc.length > 0 && (
              <aside className="hidden lg:block">
                <nav className="sticky top-24 article-toc-wrap">
                  <div className="article-toc-header">
                    <span className="article-toc-dot" />
                    <span>目录</span>
                  </div>
                  <ul className="article-toc">
                    {toc.map((item) => (
                      <li
                        key={item.id}
                        style={{ paddingLeft: `${(item.level - 1) * 14}px` }}
                      >
                        <button
                          type="button"
                          onClick={() => scrollToHeading(item.id)}
                          className={`article-toc-link ${activeId === item.id ? 'is-active' : ''}`}
                          title={item.text}
                        >
                          <span className="article-toc-bar" />
                          <span className="article-toc-text">{item.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* 移动端目录抽屉 */}
      {showTocMobile && toc.length > 0 && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowTocMobile(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-xl p-6 overflow-y-auto"
            style={{ background: '#FCFBF7' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="article-toc-header mb-4">
              <span className="article-toc-dot" />
              <span>目录</span>
            </div>
            <ul className="article-toc">
              {toc.map((item) => (
                <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 14}px` }}>
                  <button
                    type="button"
                    onClick={() => scrollToHeading(item.id)}
                    className={`article-toc-link ${activeId === item.id ? 'is-active' : ''}`}
                  >
                    <span className="article-toc-bar" />
                    <span className="article-toc-text">{item.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 回到顶部浮动按钮 */}
      <button
        onClick={scrollToTop}
        className={`article-back-top ${showBackTop ? 'is-visible' : ''}`}
        aria-label="回到顶部"
        title="回到顶部"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <Confirm
        isOpen={confirmOpen}
        title="删除文章"
        message={`确定要删除"${article.title || '无标题'}"吗？`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .article-page {
          --bg: #FCFBF7;
          --bg-alt: #F6F4ED;
          --ink: #1F1E1D;
          --ink-soft: #3A3936;
          --ink-muted: #6B6A65;
          --ink-faint: #8E8C85;
          --rule: #E8E6DC;
          --rule-strong: #D8D5C7;
          --accent: #D97757;
          --accent-soft: #F4D9CC;
          --accent-deep: #B85B3F;
          --code-bg: #F2F0E8;
          --selection: #F4D9CC;

          --serif: 'Fraunces', 'Source Serif Pro', 'Iowan Old Style', 'Georgia', serif;
          --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          --mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;

          color: var(--ink);
          font-family: var(--sans);
          background: linear-gradient(180deg, #FCFBF7 0%, #FAF8F2 60%, #F8F6EE 100%);
          isolation: isolate;
        }

        .article-page ::selection { background: var(--selection); color: var(--ink); }

        /* 背景层 */
        .article-bg-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .article-aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.22;
          mix-blend-mode: multiply;
          animation: auroraFloat 30s ease-in-out infinite alternate;
          will-change: transform;
        }
        .article-aurora-blob-1 {
          width: 560px; height: 560px;
          top: -180px; left: -160px;
          background: radial-gradient(circle at 35% 35%, #F4D9CC 0%, transparent 70%);
        }
        .article-aurora-blob-2 {
          width: 720px; height: 720px;
          top: 40%; right: -240px;
          background: radial-gradient(circle at 50% 50%, #ECE6F2 0%, transparent 70%);
          animation-delay: -10s;
        }
        .article-aurora-blob-3 {
          width: 500px; height: 500px;
          bottom: -160px; left: 40%;
          background: radial-gradient(circle at 50% 50%, #E0E8E2 0%, transparent 70%);
          animation-delay: -20s;
        }

        @keyframes auroraFloat {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(40px, -30px) scale(1.06); }
          100% { transform: translate(-30px, 40px) scale(0.95); }
        }
        @media (prefers-reduced-motion: reduce) {
          .article-aurora-blob { animation: none; }
        }

        /* 同心圆环（右上远景） */
        .article-bg-rings {
          position: absolute;
          width: 720px; height: 720px;
          top: 60px; right: -260px;
          opacity: 0.55;
          pointer-events: none;
        }

        /* Windsurf 风格流式线条（顶部横向） */
        .article-bg-flow {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 320px;
          opacity: 0.55;
          pointer-events: none;
        }

        .article-bg-grain {
          position: absolute;
          inset: 0;
          opacity: 0.025;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.7'/></svg>");
        }

        /* 进度条 */
        .article-progress {
          position: absolute;
          top: 0; left: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--accent), var(--accent-deep));
          z-index: 30;
          transition: width 0.08s linear;
        }

        /* 顶栏 */
        .article-topbar {
          position: sticky; top: 0;
          z-index: 20;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          background: rgba(252, 251, 247, 0.78);
          border-bottom: 1px solid rgba(232, 230, 220, 0.6);
        }

        /* 网格 */
        .article-grid {
          display: grid;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .article-grid {
            grid-template-columns: minmax(0, var(--article-w, 1040px)) var(--toc-w, 260px);
          }
        }
        .article-body { transition: max-width 0.3s ease; position: relative; z-index: 1; }

        /* 按钮 */
        .article-link-btn {
          color: var(--ink-muted);
          font-family: var(--sans);
          font-size: 14px;
          padding: 6px 10px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          background: transparent;
          border: none;
        }
        .article-link-btn:hover { color: var(--ink); background: rgba(0,0,0,0.04); }

        .article-icon-btn {
          width: 36px; height: 36px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--ink-muted);
          border: 1px solid var(--rule);
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          transition: all 0.15s;
        }
        .article-icon-btn:hover {
          color: var(--ink);
          background: var(--bg-alt);
          border-color: var(--rule-strong);
        }

        .article-secondary-btn {
          font-family: var(--sans);
          font-size: 14px;
          padding: 7px 14px;
          color: var(--ink);
          border: 1px solid var(--rule-strong);
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          transition: all 0.15s;
        }
        .article-secondary-btn:hover {
          background: var(--bg-alt);
          border-color: var(--ink);
        }
        .article-secondary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .article-danger-btn {
          font-family: var(--sans);
          font-size: 14px;
          padding: 7px 14px;
          color: #B53D2E;
          border: 1px solid #E8C8C2;
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          transition: all 0.15s;
        }
        .article-danger-btn:hover {
          background: #FBEFEC;
          border-color: #B53D2E;
        }

        /* 导出菜单 */
        .article-export-menu {
          position: absolute;
          right: 0; top: calc(100% + 8px);
          width: 220px;
          background: #FFFFFF;
          border: 1px solid var(--rule);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 4px 12px rgba(31,30,29,0.06), 0 12px 32px rgba(31,30,29,0.10);
          z-index: 50;
          font-family: var(--sans);
        }
        .article-export-item {
          display: flex; align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          color: var(--ink);
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.15s;
        }
        .article-export-item:hover { background: var(--bg-alt); }
        .article-export-item svg { color: var(--accent); flex-shrink: 0; }
        .article-export-sub {
          font-size: 12px;
          color: var(--ink-faint);
          margin-top: 1px;
        }

        /* 标签 */
        .article-tag {
          display: inline-block;
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          padding: 4px 10px;
          color: var(--accent);
          background: var(--accent-soft);
          border-radius: 999px;
          text-transform: uppercase;
        }

        /* 标题 */
        .article-title {
          font-family: var(--serif);
          font-weight: 700;
          font-size: clamp(34px, 5vw, 52px);
          line-height: 1.12;
          letter-spacing: -0.022em;
          color: var(--ink);
          margin: 0 0 24px;
          font-feature-settings: "ss01","liga","kern";
        }

        .article-meta {
          display: flex; align-items: center;
          flex-wrap: wrap; gap: 8px;
          font-family: var(--sans);
          font-size: 14px;
          color: var(--ink-muted);
          letter-spacing: 0.01em;
        }
        .article-meta-sep { color: var(--ink-faint); }

        /* 封面 */
        .article-cover { margin: 32px 0 40px; }
        .article-cover img {
          width: 100%; height: auto;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 12px 32px rgba(31,30,29,0.08);
        }

        /* lede（引言） */
        .article-lede {
          font-family: var(--serif);
          font-size: 22px;
          line-height: 1.55;
          color: var(--ink-soft);
          font-style: italic;
          padding: 18px 26px;
          margin: 32px 0 40px;
          background: linear-gradient(135deg, rgba(244,217,204,0.25), rgba(244,217,204,0.05));
          border-radius: 12px;
          letter-spacing: -0.005em;
        }

        /* 正文 */
        .article-prose {
          font-family: var(--serif);
          font-size: 19px;
          line-height: 1.78;
          letter-spacing: -0.003em;
          color: var(--ink);
          font-feature-settings: "liga","kern","onum";
        }
        .article-prose p { margin: 1.6em 0; }
        .article-prose p:first-child { margin-top: 0; }

        /* drop cap */
        .article-prose > p:first-of-type::first-letter {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 4.4em;
          line-height: 0.85;
          float: left;
          padding: 8px 12px 0 0;
          color: var(--ink);
        }

        .article-prose h1 {
          font-family: var(--serif); font-weight: 700;
          font-size: 34px; line-height: 1.18;
          letter-spacing: -0.018em;
          margin: 2.4em 0 0.6em; color: var(--ink);
          scroll-margin-top: 100px;
        }
        .article-prose h2 {
          font-family: var(--serif); font-weight: 600;
          font-size: 28px; line-height: 1.25;
          letter-spacing: -0.014em;
          margin: 2.2em 0 0.55em; color: var(--ink);
          scroll-margin-top: 100px;
        }
        .article-prose h3 {
          font-family: var(--serif); font-weight: 600;
          font-size: 22px; line-height: 1.3;
          letter-spacing: -0.01em;
          margin: 1.8em 0 0.5em; color: var(--ink);
          scroll-margin-top: 100px;
        }
        .article-prose h4 {
          font-family: var(--serif); font-weight: 600;
          font-size: 18px; line-height: 1.35;
          margin: 1.6em 0 0.5em; color: var(--ink);
        }

        .article-prose a {
          color: var(--accent);
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }
        .article-prose a:hover {
          color: var(--accent-deep);
          text-decoration-thickness: 2px;
        }

        .article-prose strong { font-weight: 700; color: var(--ink); }
        .article-prose em { font-style: italic; }

        .article-prose ul, .article-prose ol {
          margin: 1.4em 0; padding-left: 1.5em;
        }
        .article-prose ul { list-style: disc; }
        .article-prose ul ul { list-style: circle; }
        .article-prose ol { list-style: decimal; }
        .article-prose li { margin: 0.45em 0; padding-left: 0.25em; }
        .article-prose li::marker { color: var(--accent); }

        .article-prose blockquote {
          margin: 1.8em 0;
          padding: 6px 0 6px 24px;
          border-left: 3px solid var(--accent);
          font-family: var(--serif);
          font-style: italic;
          font-size: 18px;
          color: var(--ink-soft);
          background: transparent;
        }
        .article-prose blockquote p { margin: 0.6em 0; }

        .article-prose code {
          font-family: var(--mono);
          font-size: 0.86em;
          background: var(--code-bg);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--ink);
        }

        .article-prose pre {
          font-family: var(--mono);
          background: var(--code-bg);
          color: var(--ink);
          padding: 20px 24px;
          border-radius: 12px;
          font-size: 14.5px;
          line-height: 1.65;
          overflow-x: auto;
          margin: 1.6em 0;
          border: 1px solid var(--rule);
        }
        .article-prose pre code {
          background: transparent; padding: 0; font-size: inherit;
        }

        .article-prose img {
          max-width: 100%; height: auto;
          border-radius: 12px;
          margin: 1.8em auto;
          display: block;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(31,30,29,0.06);
        }

        .article-prose hr {
          border: 0; height: 1px;
          background: var(--rule);
          margin: 3em auto;
          width: 60%;
        }

        .article-prose table {
          width: 100%; border-collapse: collapse;
          margin: 1.6em 0;
          font-family: var(--sans);
          font-size: 15px;
        }
        .article-prose th, .article-prose td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--rule);
          text-align: left;
        }
        .article-prose th {
          font-weight: 600; color: var(--ink);
          background: var(--bg-alt);
        }
        .article-prose tr:hover td { background: var(--bg-alt); }

        /* 文末 */
        .article-footer { margin-top: 80px; }
        .article-footer-flourish {
          width: 200px; height: 24px;
          margin: 24px 0;
        }

        /* 浮动目录 */
        .article-toc-wrap {
          font-family: var(--sans);
          padding: 18px 0;
        }
        .article-toc-header {
          display: flex; align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 16px;
          padding-left: 14px;
        }
        .article-toc-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 3px rgba(217,119,87,0.2);
        }
        .article-toc {
          list-style: none; padding: 0; margin: 0;
          font-size: 13.5px;
          line-height: 1.6;
        }
        .article-toc li { margin: 2px 0; }
        .article-toc-link {
          display: flex; align-items: stretch;
          gap: 12px;
          width: 100%;
          padding: 6px 0 6px 0;
          color: var(--ink-muted);
          font-size: 13.5px;
          background: transparent;
          border: none;
          cursor: pointer;
          line-height: 1.5;
          text-align: left;
          transition: color 0.18s;
          position: relative;
        }
        .article-toc-bar {
          width: 2px;
          background: var(--rule);
          flex-shrink: 0;
          border-radius: 2px;
          transition: background 0.18s, transform 0.18s;
          transform-origin: top;
        }
        .article-toc-text {
          padding-right: 4px;
          transition: color 0.18s, transform 0.18s, font-weight 0.18s;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .article-toc-link:hover .article-toc-text { color: var(--ink); }
        .article-toc-link:hover .article-toc-bar { background: var(--rule-strong); }
        .article-toc-link.is-active .article-toc-bar {
          background: var(--accent);
          transform: scaleY(1.04);
        }
        .article-toc-link.is-active .article-toc-text {
          color: var(--accent);
          font-weight: 500;
        }

        /* 回顶按钮 */
        .article-back-top {
          position: fixed;
          right: 28px; bottom: 32px;
          width: 46px; height: 46px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--ink);
          color: var(--bg);
          border-radius: 999px;
          border: none;
          box-shadow: 0 4px 12px rgba(31,30,29,0.18);
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px);
          transition: opacity 0.25s, transform 0.25s, background 0.15s;
          z-index: 30;
          cursor: pointer;
        }
        .article-back-top.is-visible {
          opacity: 1; pointer-events: auto;
          transform: translateY(0);
        }
        .article-back-top:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}
