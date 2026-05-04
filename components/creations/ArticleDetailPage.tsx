// 文章详情页（博客阅读体验：Anthropic 暖调配色 + 衬线 + 进度条 + 浮动目录 + 回顶）
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Calendar, ArrowUp, List, Clock, Tag, Maximize2, Minimize2, AlignCenter } from 'lucide-react';
import { marked } from 'marked';
import { getArticle, deleteArticle, type Article } from '../../lib/articles';
import { Confirm } from '../../shared/Confirm';

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
  compact: { article: 640, toc: 200, label: '紧凑' },
  standard: { article: 760, toc: 220, label: '标准' },
  wide: { article: 920, toc: 240, label: '宽阔' }
};

const WIDTH_STORAGE_KEY = 'lumina:article:width';

// slug 中文/英文混合
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
  const [widthMode, setWidthMode] = useState<WidthMode>(() => {
    if (typeof window === 'undefined') return 'standard';
    const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY) as WidthMode | null;
    return stored && stored in WIDTH_PRESETS ? stored : 'standard';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, widthMode);
    } catch {}
  }, [widthMode]);

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
  // 容器宽度：article + 间距 + toc，留出 padding
  const containerMaxWidth = preset.article + preset.toc + 64;

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);

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

  const html = useMemo(() => {
    if (!article?.content) return '';
    return marked.parse(article.content, { async: false }) as string;
  }, [article?.content]);

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
    headings.forEach((h, idx) => {
      const text = h.textContent?.trim() || '';
      if (!text) return;
      const id = h.id || slugify(text, idx);
      h.id = id;
      const level = Number(h.tagName.substring(1));
      items.push({ id, text, level });
    });
    setToc(items);
  }, [html]);

  // 滚动 → 进度条 / 回顶按钮 / 当前激活标题
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrolled = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, (scrolled / max) * 100) : 0;
      setProgress(pct);
      setShowBackTop(scrolled > 600);

      // 找到当前视口顶部最近的标题
      if (articleRef.current) {
        const headings = Array.from(
          articleRef.current.querySelectorAll<HTMLElement>('h1, h2, h3')
        );
        const offset = el.scrollTop + 120;
        let current = '';
        for (const h of headings) {
          if (h.offsetTop <= offset) current = h.id;
          else break;
        }
        setActiveId(current);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [html]);

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

  const scrollToHeading = (id: string) => {
    const el = articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    }
    setShowTocMobile(false);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="article-page w-full h-full relative" style={{ background: 'var(--bg)' }}>
      {/* 阅读进度条 */}
      <div
        className="article-progress"
        style={{ width: `${progress}%` }}
      />

      {/* 极光渐变背景 */}
      <div className="article-aurora" aria-hidden="true">
        <div className="article-aurora-blob article-aurora-blob-1" />
        <div className="article-aurora-blob article-aurora-blob-2" />
        <div className="article-aurora-blob article-aurora-blob-3" />
        <div className="article-aurora-grain" />
      </div>

      <div ref={scrollRef} className="article-scroll w-full h-full overflow-y-auto relative">
        {/* 顶部操作栏 */}
        <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(250, 249, 245, 0.72)', borderBottom: '1px solid rgba(232,230,220,0.6)' }}>
          <div
            className="mx-auto px-6 md:px-10 py-4 flex items-center justify-between"
            style={{ maxWidth: `${containerMaxWidth}px` }}
          >
            <button
              onClick={onBack}
              className="article-link-btn flex items-center gap-2"
            >
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
            <article className="article-body min-w-0">
              {/* 标题区 */}
              <header className="mb-12 pt-12">
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {article.tags.map((t) => (
                      <span key={t} className="article-tag">
                        {t}
                      </span>
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

              {/* 封面 */}
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

              {/* 摘要 */}
              {article.excerpt && (
                <p className="article-lede">{article.excerpt}</p>
              )}

              {/* 正文 */}
              <div
                ref={articleRef as React.RefObject<HTMLDivElement>}
                className="article-prose"
                dangerouslySetInnerHTML={{ __html: html }}
              />

              {/* 文末分隔 + 标签 */}
              <div className="article-footer">
                <div className="article-rule" />
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="w-4 h-4 text-stone-400" />
                    {article.tags.map((t) => (
                      <span key={t} className="article-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={scrollToTop}
                  className="article-link-btn flex items-center gap-2 mt-6"
                >
                  <ArrowUp className="w-4 h-4" />
                  回到顶部
                </button>
              </div>
            </article>

            {/* 侧边浮动目录（桌面） */}
            {toc.length > 0 && (
              <aside className="hidden lg:block">
                <nav className="sticky top-24 article-toc">
                  <div className="article-toc-title">目录</div>
                  <ul>
                    {toc.map((item) => (
                      <li
                        key={item.id}
                        style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                      >
                        <button
                          onClick={() => scrollToHeading(item.id)}
                          className={`article-toc-link ${activeId === item.id ? 'is-active' : ''}`}
                        >
                          {item.text}
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
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setShowTocMobile(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--bg)] shadow-xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="article-toc-title mb-4">目录</div>
            <ul className="article-toc">
              {toc.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                >
                  <button
                    onClick={() => scrollToHeading(item.id)}
                    className={`article-toc-link ${activeId === item.id ? 'is-active' : ''}`}
                  >
                    {item.text}
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
          --bg: #FAF9F5;
          --bg-alt: #F5F4EE;
          --ink: #1F1E1D;
          --ink-soft: #3A3936;
          --ink-muted: #6B6A65;
          --ink-faint: #8E8C85;
          --rule: #E8E6DC;
          --rule-strong: #D8D5C7;
          --accent: #D97757;
          --accent-soft: #F4D9CC;
          --code-bg: #F2F0E8;
          --selection: #F4D9CC;

          --serif: 'Fraunces', 'Source Serif Pro', 'Iowan Old Style', 'Georgia', serif;
          --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          --mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;

          color: var(--ink);
          font-family: var(--sans);
        }

        .article-page ::selection { background: var(--selection); color: var(--ink); }

        /* 动态网格：桌面端两栏 */
        .article-grid {
          display: grid;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .article-grid {
            grid-template-columns: minmax(0, var(--article-w, 760px)) var(--toc-w, 220px);
          }
        }
        .article-body { transition: max-width 0.3s ease; }

        /* 极光 / 弥光渐变背景 */
        .article-aurora {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(217, 119, 87, 0.10), transparent 70%),
            linear-gradient(180deg, #FBFAF6 0%, #F7F5EE 60%, #F4F2EA 100%);
        }
        .article-aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.55;
          mix-blend-mode: multiply;
          animation: auroraFloat 22s ease-in-out infinite alternate;
          will-change: transform;
        }
        .article-aurora-blob-1 {
          width: 520px; height: 520px;
          top: -160px; left: -120px;
          background: radial-gradient(circle at 35% 35%, #F4D9CC 0%, transparent 65%);
          animation-delay: 0s;
        }
        .article-aurora-blob-2 {
          width: 680px; height: 680px;
          top: 30%; right: -200px;
          background: radial-gradient(circle at 50% 50%, #E8E4F2 0%, transparent 65%);
          animation-delay: -7s;
        }
        .article-aurora-blob-3 {
          width: 460px; height: 460px;
          bottom: -140px; left: 30%;
          background: radial-gradient(circle at 50% 50%, #DCEAE0 0%, transparent 65%);
          animation-delay: -14s;
        }
        .article-aurora-grain {
          position: absolute;
          inset: 0;
          opacity: 0.04;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.7'/></svg>");
        }
        @keyframes auroraFloat {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(40px, -30px) scale(1.06); }
          100% { transform: translate(-30px, 40px) scale(0.95); }
        }
        @media (prefers-reduced-motion: reduce) {
          .article-aurora-blob { animation: none; }
        }

        /* 进度条 */
        .article-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 2px;
          background: var(--accent);
          z-index: 30;
          transition: width 0.08s linear;
          will-change: width;
        }

        /* 顶部按钮 */
        .article-link-btn {
          color: var(--ink-muted);
          font-family: var(--sans);
          font-size: 14px;
          padding: 6px 10px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .article-link-btn:hover { color: var(--ink); background: rgba(0,0,0,0.04); }

        .article-icon-btn {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-muted);
          border: 1px solid var(--rule);
          border-radius: 8px;
          background: transparent;
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
          background: transparent;
          transition: all 0.15s;
        }
        .article-secondary-btn:hover {
          background: var(--bg-alt);
          border-color: var(--ink);
        }

        .article-danger-btn {
          font-family: var(--sans);
          font-size: 14px;
          padding: 7px 14px;
          color: #B53D2E;
          border: 1px solid #E8C8C2;
          border-radius: 8px;
          background: transparent;
          transition: all 0.15s;
        }
        .article-danger-btn:hover {
          background: #FBEFEC;
          border-color: #B53D2E;
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
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          font-family: var(--sans);
          font-size: 14px;
          color: var(--ink-muted);
          letter-spacing: 0.01em;
        }
        .article-meta-sep { color: var(--ink-faint); }

        /* 封面 */
        .article-cover {
          margin: 32px 0 40px;
        }
        .article-cover img {
          width: 100%;
          height: auto;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(31,30,29,0.06);
        }

        /* 引言（lede）*/
        .article-lede {
          font-family: var(--serif);
          font-size: 22px;
          line-height: 1.55;
          color: var(--ink-soft);
          font-style: italic;
          padding: 16px 24px;
          margin: 32px 0 40px;
          border-left: 3px solid var(--accent);
          background: var(--bg-alt);
          border-radius: 0 8px 8px 0;
          letter-spacing: -0.005em;
        }

        /* 正文 prose */
        .article-prose {
          font-family: var(--serif);
          font-size: 19px;
          line-height: 1.75;
          letter-spacing: -0.003em;
          color: var(--ink);
          font-feature-settings: "liga","kern","onum";
        }
        .article-prose p { margin: 1.6em 0; }
        .article-prose p:first-child { margin-top: 0; }

        /* Drop cap：首段首字母 */
        .article-prose > p:first-of-type::first-letter {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 4.4em;
          line-height: 0.85;
          float: left;
          padding: 8px 12px 0 0;
          color: var(--ink);
        }

        /* 标题 */
        .article-prose h1 {
          font-family: var(--serif);
          font-weight: 700;
          font-size: 34px;
          line-height: 1.18;
          letter-spacing: -0.018em;
          margin: 2.4em 0 0.6em;
          color: var(--ink);
        }
        .article-prose h2 {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 28px;
          line-height: 1.25;
          letter-spacing: -0.014em;
          margin: 2.2em 0 0.55em;
          color: var(--ink);
          scroll-margin-top: 96px;
        }
        .article-prose h3 {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 22px;
          line-height: 1.3;
          letter-spacing: -0.01em;
          margin: 1.8em 0 0.5em;
          color: var(--ink);
          scroll-margin-top: 96px;
        }
        .article-prose h4 {
          font-family: var(--serif);
          font-weight: 600;
          font-size: 18px;
          line-height: 1.35;
          margin: 1.6em 0 0.5em;
          color: var(--ink);
        }

        /* 链接 */
        .article-prose a {
          color: var(--accent);
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }
        .article-prose a:hover {
          color: #B85B3F;
          text-decoration-thickness: 2px;
        }

        /* 强调 */
        .article-prose strong { font-weight: 700; color: var(--ink); }
        .article-prose em { font-style: italic; }

        /* 列表 */
        .article-prose ul, .article-prose ol {
          margin: 1.4em 0;
          padding-left: 1.5em;
        }
        .article-prose ul { list-style: disc; }
        .article-prose ul ul { list-style: circle; }
        .article-prose ol { list-style: decimal; }
        .article-prose li { margin: 0.45em 0; padding-left: 0.25em; }
        .article-prose li::marker { color: var(--accent); }

        /* 引用 */
        .article-prose blockquote {
          margin: 1.8em 0;
          padding: 4px 0 4px 24px;
          border-left: 3px solid var(--accent);
          font-family: var(--serif);
          font-style: italic;
          font-size: 18px;
          color: var(--ink-soft);
          background: transparent;
        }
        .article-prose blockquote p { margin: 0.6em 0; }

        /* 行内代码 */
        .article-prose code {
          font-family: var(--mono);
          font-size: 0.86em;
          background: var(--code-bg);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--ink);
          font-feature-settings: normal;
        }

        /* 代码块 */
        .article-prose pre {
          font-family: var(--mono);
          background: var(--code-bg);
          color: var(--ink);
          padding: 20px 24px;
          border-radius: 10px;
          font-size: 14.5px;
          line-height: 1.65;
          overflow-x: auto;
          margin: 1.6em 0;
          border: 1px solid var(--rule);
        }
        .article-prose pre code {
          background: transparent;
          padding: 0;
          font-size: inherit;
        }

        /* 图片 */
        .article-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 10px;
          margin: 1.8em auto;
          display: block;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(31,30,29,0.05);
        }

        /* 分割线 */
        .article-prose hr {
          border: 0;
          height: 1px;
          background: var(--rule);
          margin: 3em auto;
          width: 60%;
        }

        /* 表格 */
        .article-prose table {
          width: 100%;
          border-collapse: collapse;
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
          font-weight: 600;
          color: var(--ink);
          background: var(--bg-alt);
        }
        .article-prose tr:hover td { background: var(--bg-alt); }

        /* 文末 */
        .article-footer { margin-top: 64px; }
        .article-rule {
          height: 1px;
          background: var(--rule);
          margin: 32px 0 24px;
          width: 80px;
        }

        /* 浮动目录 */
        .article-toc {
          font-family: var(--sans);
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-muted);
          padding: 4px 0 4px 16px;
          border-left: 1px solid var(--rule);
        }
        .article-toc-title {
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 12px;
          padding-left: 16px;
        }
        .article-toc ul { list-style: none; padding: 0; margin: 0; }
        .article-toc li { margin: 4px 0; }
        .article-toc-link {
          display: block;
          width: 100%;
          text-align: left;
          padding: 4px 0;
          color: var(--ink-muted);
          font-size: 13px;
          transition: color 0.15s, transform 0.15s;
          line-height: 1.45;
        }
        .article-toc-link:hover { color: var(--ink); }
        .article-toc-link.is-active {
          color: var(--accent);
          font-weight: 500;
          transform: translateX(2px);
        }

        /* 回顶按钮 */
        .article-back-top {
          position: fixed;
          right: 28px;
          bottom: 32px;
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--ink);
          color: var(--bg);
          border-radius: 999px;
          box-shadow: 0 4px 12px rgba(31,30,29,0.18);
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px);
          transition: opacity 0.25s, transform 0.25s, background 0.15s;
          z-index: 30;
        }
        .article-back-top.is-visible {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .article-back-top:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}
