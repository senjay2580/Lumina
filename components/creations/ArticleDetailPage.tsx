// 文章详情页（博客阅读体验：Anthropic 暖调 + 极光 + 浮动目录 + 进度条 + 导入导出）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Edit2, Trash2, Calendar, ArrowUp, List, Clock, Tag,
  Download, FileDown, Image as ImageIcon, FileText, ChevronDown, Upload,
  Play, Pause, Square, MessageSquare, Send, Sparkles, Gauge
} from 'lucide-react';
import { marked } from 'marked';
import {
  getArticle, createArticle, getNotes, addNote, deleteNote,
  getRelatedArticles, type Article, type ArticleNote
} from '../../lib/articles';
import {
  pickMarkdownFile, importedMarkdownToContent, extractTitleFromMarkdown
} from '../../lib/markdown-io';
import {
  articleContentToMarkdown,
  downloadTextFile,
  exportElementToPng,
  exportElementToPdf,
  safeFileName
} from '../../lib/markdown-io';
import {
  TtsEngine, collectReadableSegments,
  CURATED_VOICES, DEFAULT_VOICE_KEY, resolveVoiceName,
  type TtsState as TtsEngineState,
  type SegChangeReason
} from '../../lib/tts';

interface Props {
  articleId: string;
  initial?: Article | null;
  onBack: () => void;
  onEdit: (article: Article) => void;
  onImported?: (article: Article) => void;
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
  wide: { article: 1120, toc: 260, label: '宽阔' }
};

const WIDTH_STORAGE_KEY = 'lumina:article:width';

// 精选朗读音色清单从 lib/tts 引入（保持单一事实源）
const VOICE_STORAGE_KEY = 'lumina:tts:voice-key';

function slugify(text: string, fallbackIdx: number): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return base || `heading-${fallbackIdx}`;
}

export default function ArticleDetailPage({ articleId, initial, onBack, onEdit, onImported }: Props) {
  const [article, setArticle] = useState<Article | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [showTocMobile, setShowTocMobile] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'md' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [tocVisible, setTocVisible] = useState(true);
  const [widthMode, setWidthMode] = useState<WidthMode>(() => {
    if (typeof window === 'undefined') return 'wide';
    const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY) as WidthMode | null;
    return stored && stored in WIDTH_PRESETS ? stored : 'wide';
  });

  // 笔记
  const [notes, setNotes] = useState<ArticleNote[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // 相关文章
  const [related, setRelated] = useState<{ article: Article; score: number }[]>([]);

  // TTS（所有逻辑在 lib/tts.ts 的 TtsEngine 类里，组件只持有 ref + 显示状态）
  const [ttsState, setTtsState] = useState<TtsEngineState>('idle');
  const [ttsRate, setTtsRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const v = parseFloat(window.localStorage.getItem('lumina:tts:rate') || '1');
    return isNaN(v) ? 1 : v;
  });
  const [ttsIdx, setTtsIdx] = useState(0);
  const [ttsTotal, setTtsTotal] = useState(0);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsVoiceKey, setTtsVoiceKey] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_VOICE_KEY;
    return window.localStorage.getItem(VOICE_STORAGE_KEY) || DEFAULT_VOICE_KEY;
  });
  const ttsEngineRef = useRef<TtsEngine | null>(null);
  // 进度条和「跳段是否由用户点击触发」走 ref，避免 React 频繁重渲染
  const ttsFillRef = useRef<HTMLDivElement | null>(null);
  const ttsLastChangeReasonRef = useRef<SegChangeReason>('natural');

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

  // 加载笔记
  const reloadNotes = useCallback(async () => {
    try {
      const list = await getNotes(articleId);
      setNotes(list);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }, [articleId]);

  useEffect(() => {
    reloadNotes();
  }, [reloadNotes]);

  // 加载相关文章
  useEffect(() => {
    if (!article) return;
    let active = true;
    (async () => {
      try {
        const list = await getRelatedArticles(article.user_id, article, 6);
        if (active) setRelated(list);
      } catch (err) {
        console.error('Failed to load related articles:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [article?.id, article?.user_id]);

  // 持久化语速
  useEffect(() => {
    try { window.localStorage.setItem('lumina:tts:rate', String(ttsRate)); } catch {}
  }, [ttsRate]);

  // 单例 engine（首次访问时 lazy init）
  const getEngine = useCallback((): TtsEngine | null => {
    if (typeof window === 'undefined') return null;
    if (!ttsEngineRef.current) {
      ttsEngineRef.current = new TtsEngine({
        onSegmentChange: (i, reason) => {
          ttsLastChangeReasonRef.current = reason;
          setTtsIdx(i);
        },
        onProgress: (p) => {
          // ⚡ 直接更新 DOM，避免 33 次/秒 setState 引发的全文重渲染
          if (ttsFillRef.current) {
            ttsFillRef.current.style.width = `${Math.min(100, p)}%`;
          }
        },
        onStateChange: (s) => setTtsState(s),
        onError: (msg) => console.warn('[TTS]', msg),
      });
    }
    return ttsEngineRef.current;
  }, []);

  const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // 加载可用语音清单
  useEffect(() => {
    if (!ttsAvailable) return;
    const refresh = () => setTtsVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, [ttsAvailable]);

  // voice / rate 变化 → 同步到 engine
  useEffect(() => {
    const eng = getEngine();
    if (!eng) return;
    eng.setRate(ttsRate);
    try { window.localStorage.setItem('lumina:tts:rate', String(ttsRate)); } catch {}
  }, [ttsRate, getEngine]);

  useEffect(() => {
    const eng = getEngine();
    if (!eng) return;
    eng.setVoiceName(resolveVoiceName(ttsVoiceKey, ttsVoices));
    try { window.localStorage.setItem(VOICE_STORAGE_KEY, ttsVoiceKey); } catch {}
  }, [ttsVoiceKey, ttsVoices, getEngine]);

  const startTts = useCallback(
    (fromIdx: number = 0) => {
      const eng = getEngine();
      if (!eng) return;
      const segs = collectReadableSegments(articleRef.current);
      if (segs.length === 0) return;
      setTtsTotal(segs.length);
      // 先把 voice/rate 同步上去（防止首次启动时还没 set）
      eng.setRate(ttsRate);
      eng.setVoiceName(resolveVoiceName(ttsVoiceKey, ttsVoices));
      // ⚡ 同步调用，必须在用户手势栈内（点击事件）
      eng.start(segs, fromIdx);
    },
    [getEngine, ttsRate, ttsVoiceKey, ttsVoices]
  );

  const pauseTts = useCallback(() => {
    getEngine()?.pause();
  }, [getEngine]);

  const resumeTts = useCallback(() => {
    getEngine()?.resume();
  }, [getEngine]);

  const stopTts = useCallback(() => {
    getEngine()?.stop();
  }, [getEngine]);

  // 自动滚动：仅在「自然推进」且段落出 viewport 时滚动；用户点击跳段不滚动
  useEffect(() => {
    if (ttsState !== 'playing') return;
    if (ttsLastChangeReasonRef.current === 'jump') return; // 用户主动选了位置，别打扰
    const el = articleRef.current?.querySelector<HTMLElement>('.tts-active');
    const container = scrollRef.current;
    if (!el || !container) return;
    const rect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const offsetTop = rect.top - cRect.top;
    const offsetBottom = rect.bottom - cRect.top;
    // 段落完全在视口内 → 不滚；只在头超出顶部或尾超出底部时才滚
    if (offsetTop < 60 || offsetBottom > container.clientHeight - 60) {
      container.scrollTo({
        top: container.scrollTop + offsetTop - 200,
        behavior: 'smooth',
      });
    }
  }, [ttsIdx, ttsState]);

  // 点击段落跳读
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest('a')) return;
      const seg = target.closest<HTMLElement>('h1, h2, h3, h4, p, blockquote, li');
      if (!seg || !root.contains(seg)) return;
      const segs = collectReadableSegments(root);
      const idx = segs.indexOf(seg);
      if (idx < 0) return;
      if (ttsState === 'playing' || ttsState === 'paused') {
        getEngine()?.jumpTo(idx);
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [ttsState, getEngine]);

  // 语速变化：正在朗读时重启当前段（utterance.rate 不支持热更）
  useEffect(() => {
    const eng = getEngine();
    if (!eng) return;
    if (ttsState === 'playing') {
      eng.jumpTo(ttsIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsRate]);

  // 卸载清理
  useEffect(() => {
    return () => {
      ttsEngineRef.current?.destroy();
      ttsEngineRef.current = null;
    };
  }, []);

  // 笔记提交
  const handleAddNote = async () => {
    if (!article) return;
    const content = noteInput.trim();
    if (!content) return;
    setNoteSubmitting(true);
    try {
      await addNote(article.user_id, article.id, content);
      setNoteInput('');
      await reloadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
      alert('添加笔记失败');
    } finally {
      setNoteSubmitting(false);
    }
  };

  // 导入 MD 创建新文章并跳转
  const handleImportMd = async () => {
    if (!article) return;
    setShowExportMenu(false);
    try {
      const file = await pickMarkdownFile();
      if (!file) return;
      // 简单解析 frontmatter
      let body = file.content;
      let title: string | undefined;
      let excerpt: string | undefined;
      let cover: string | undefined;
      let tags: string[] = [];
      if (body.startsWith('---')) {
        const end = body.indexOf('\n---', 3);
        if (end > 0) {
          const head = body.slice(3, end);
          body = body.slice(end + 4).replace(/^\r?\n/, '');
          for (const line of head.split('\n')) {
            const m = line.match(/^([\w-]+):\s*(.*)$/);
            if (!m) continue;
            const key = m[1].trim();
            let value: string = m[2].trim().replace(/^["']|["']$/g, '');
            if (key === 'title') title = value;
            else if (key === 'excerpt') excerpt = value;
            else if (key === 'cover') cover = value;
            else if (key === 'tags') {
              try {
                const arr = JSON.parse(value);
                if (Array.isArray(arr)) tags = arr.map(String);
              } catch {
                tags = value.split(',').map((s) => s.trim()).filter(Boolean);
              }
            }
          }
        }
      }
      if (!title) title = extractTitleFromMarkdown(body) || file.name.replace(/\.(md|markdown|txt)$/i, '');
      const html = importedMarkdownToContent(body.trim());
      const created = await createArticle(article.user_id, {
        title, excerpt, cover_url: cover, content: html, tags
      });
      if (onImported) onImported(created);
      else onBack();
    } catch (err) {
      console.error('Import failed:', err);
      alert('导入失败，请检查文件格式');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      await reloadNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

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

        {/* 右上：同心圆环（虚线 + 模糊，淡淡的远景） */}
        <svg className="article-bg-rings" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#D97757" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#D97757" stopOpacity="0" />
            </linearGradient>
            <filter id="ringBlur" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>
          <g filter="url(#ringBlur)">
            <circle cx="300" cy="300" r="280" fill="none" stroke="url(#ringGrad)" strokeWidth="1" strokeDasharray="3 7" />
            <circle cx="300" cy="300" r="220" fill="none" stroke="url(#ringGrad)" strokeWidth="0.8" strokeDasharray="2 6" />
            <circle cx="300" cy="300" r="160" fill="none" stroke="url(#ringGrad)" strokeWidth="0.6" strokeDasharray="2 5" />
          </g>
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
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                    setTocVisible((v) => !v);
                  } else {
                    setShowTocMobile((v) => !v);
                  }
                }}
                className={`article-icon-btn ${tocVisible ? 'is-active' : ''}`}
                title={tocVisible ? '隐藏目录' : '显示目录'}
                aria-label="切换目录"
              >
                <List className="w-4 h-4" />
              </button>

              {/* TTS 朗读 */}
              {ttsAvailable && (
                <div className="article-tts-group" title="朗读">
                  {ttsState === 'idle' ? (
                    <button onClick={() => startTts()} className="article-icon-btn" aria-label="开始朗读">
                      <Play className="w-4 h-4" />
                    </button>
                  ) : ttsState === 'playing' ? (
                    <button onClick={pauseTts} className="article-icon-btn is-active" aria-label="暂停">
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={resumeTts} className="article-icon-btn is-active" aria-label="继续">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {ttsState !== 'idle' && (
                    <button onClick={stopTts} className="article-icon-btn" aria-label="停止">
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  <div className="article-tts-rate" title="语速">
                    <Gauge className="w-3.5 h-3.5" />
                    <select
                      value={ttsRate}
                      onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                      aria-label="朗读语速"
                    >
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="1.75">1.75x</option>
                      <option value="2">2x</option>
                    </select>
                  </div>
                  <div className="article-tts-voice" title="语音">
                    <select
                      value={ttsVoiceKey}
                      onChange={(e) => setTtsVoiceKey(e.target.value)}
                      aria-label="朗读语音"
                    >
                      {CURATED_VOICES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
                    <div className="article-export-divider" />
                    <button onClick={handleImportMd} className="article-export-item">
                      <Upload className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">导入 Markdown</div>
                        <div className="article-export-sub">从 .md 创建新文章</div>
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
            </div>
          </div>
        </div>

        {/* 文章正文 */}
        <div
          className="article-container mx-auto px-6 md:px-10 pb-32 relative"
          style={{ maxWidth: `${containerMaxWidth}px` }}
        >
          <div
            className={`article-grid gap-12 ${tocVisible ? '' : 'is-toc-hidden'}`}
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

              {/* 文末分隔 + 装饰 SVG（居中） */}
              <div className="article-footer">
                <svg
                  className="article-footer-flourish"
                  viewBox="0 0 200 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M0 12 H80 M120 12 H200" stroke="#D8D5C7" strokeWidth="1" />
                  <circle cx="100" cy="12" r="3.5" fill="none" stroke="#D97757" strokeOpacity="0.7" />
                  <circle cx="100" cy="12" r="1" fill="#D97757" />
                </svg>

                {article.tags && article.tags.length > 0 && (
                  <div className="article-footer-tags">
                    <Tag className="w-4 h-4 text-stone-400" />
                    {article.tags.map((t) => (
                      <span key={t} className="article-tag">{t}</span>
                    ))}
                  </div>
                )}
                <button onClick={scrollToTop} className="article-link-btn article-back-top-link">
                  <ArrowUp className="w-4 h-4" />
                  回到顶部
                </button>
              </div>

              {/* 笔记 / 备注 区块 */}
              <section className="article-notes-section">
                <div className="article-section-header">
                  <MessageSquare className="w-4 h-4" />
                  <span>笔记 · {notes.length}</span>
                </div>
                <div className="article-note-input">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="写下你对这篇文章的想法、批注或延伸思考…"
                    rows={3}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                  />
                  <div className="article-note-input-actions">
                    <span className="article-note-hint">⌘/Ctrl + Enter 提交</span>
                    <button
                      onClick={handleAddNote}
                      disabled={!noteInput.trim() || noteSubmitting}
                      className="article-note-submit"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {noteSubmitting ? '提交中…' : '添加笔记'}
                    </button>
                  </div>
                </div>
                {notes.length > 0 && (
                  <ul className="article-notes-list">
                    {notes.map((n) => (
                      <li key={n.id} className="article-note-item">
                        <div className="article-note-content">{n.content}</div>
                        <div className="article-note-meta">
                          <span>{formatDate(n.created_at)}</span>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="article-note-delete"
                            aria-label="删除笔记"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 相关文章 */}
              {related.length > 0 && (
                <section className="article-related-section">
                  <div className="article-section-header">
                    <Sparkles className="w-4 h-4" />
                    <span>更多文章</span>
                  </div>
                  <div className="article-related-grid">
                    {related.map(({ article: a, score }) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          // 简单刷新策略：通过路由跳到该文章详情
                          window.location.hash = `#article/${a.id}`;
                          window.location.reload();
                        }}
                        className="article-related-card"
                        title={`匹配度 ${(score * 10).toFixed(1)}`}
                      >
                        {a.cover_url ? (
                          <div className="article-related-cover">
                            <img src={a.cover_url} alt="" loading="lazy" />
                          </div>
                        ) : (
                          <div className="article-related-cover article-related-cover-placeholder">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <div className="article-related-body">
                          <div className="article-related-title">{a.title || '无标题'}</div>
                          {a.excerpt && <div className="article-related-excerpt">{a.excerpt}</div>}
                          {a.tags && a.tags.length > 0 && (
                            <div className="article-related-tags">
                              {a.tags.slice(0, 3).map((t) => (
                                <span key={t} className="article-related-tag">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </article>

            {/* 侧边浮动目录（桌面） */}
            {toc.length > 0 && tocVisible && (
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

      {/* TTS 浮动进度条 */}
      {ttsState !== 'idle' && ttsTotal > 0 && (
        <div className="article-tts-progress" role="progressbar" aria-label="朗读进度">
          <div className="article-tts-progress-info">
            <span>朗读中 {ttsIdx + 1} / {ttsTotal}</span>
            <span className="article-tts-progress-rate">{ttsRate}x</span>
          </div>
          <div className="article-tts-progress-bar">
            <div
              ref={ttsFillRef}
              className="article-tts-progress-fill"
              style={{ width: '0%' }}
            />
          </div>
        </div>
      )}


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

        /* 同心圆环（右上远景，虚线 + 模糊） */
        .article-bg-rings {
          position: absolute;
          width: 720px; height: 720px;
          top: 60px; right: -260px;
          opacity: 0.4;
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
        .article-export-divider {
          height: 1px;
          background: var(--rule);
          margin: 4px 0;
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

        /* 文末居中 */
        .article-footer { margin-top: 80px; text-align: center; }
        .article-footer-flourish {
          width: 200px; height: 24px;
          margin: 24px auto;
        }
        .article-footer-tags {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          justify-content: center;
        }
        .article-back-top-link {
          display: inline-flex !important;
          align-items: center;
          gap: 8px;
          margin: 24px auto 0;
        }

        /* 隐藏目录时单列 */
        @media (min-width: 1024px) {
          .article-grid.is-toc-hidden {
            grid-template-columns: minmax(0, var(--article-w, 1120px));
            justify-content: center;
          }
        }

        .article-icon-btn.is-active {
          color: var(--accent);
          border-color: var(--accent);
          background: rgba(217,119,87,0.08);
        }

        /* TTS 控件组 */
        .article-tts-group {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding-left: 6px;
          margin-left: 2px;
          border-left: 1px solid var(--rule);
        }
        .article-tts-rate {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0 8px;
          height: 36px;
          border: 1px solid var(--rule);
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          color: var(--ink-muted);
          font-size: 12px;
        }
        .article-tts-rate select {
          background: transparent;
          border: none;
          outline: none;
          font: inherit;
          color: var(--ink);
          cursor: pointer;
          padding: 0 4px;
        }

        /* TTS 当前段：纯 className 高亮（最稳，不依赖 DOM 注入） */
        .article-prose .tts-active {
          position: relative;
          background: rgba(244,217,204,0.35);
          border-radius: 6px;
          padding: 4px 10px;
          margin-left: -10px;
          margin-right: -10px;
          box-shadow: 0 0 0 4px rgba(244,217,204,0.18);
          transition: background 0.25s, box-shadow 0.25s;
        }
        /* 左侧 accent 竖线指示器 */
        .article-prose .tts-active::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 8px;
          bottom: 8px;
          width: 3px;
          background: var(--accent);
          border-radius: 2px;
        }

        /* 语音选择 */
        .article-tts-voice {
          display: inline-flex;
          align-items: center;
          padding: 0 8px;
          height: 36px;
          border: 1px solid var(--rule);
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          color: var(--ink-muted);
          font-size: 12px;
          max-width: 200px;
        }
        .article-tts-voice select {
          background: transparent;
          border: none;
          outline: none;
          font: inherit;
          color: var(--ink);
          cursor: pointer;
          padding: 0 4px;
          max-width: 180px;
          text-overflow: ellipsis;
        }

        /* TTS 进度条（底部固定） */
        .article-tts-progress {
          position: fixed;
          left: 50%;
          bottom: 22px;
          transform: translateX(-50%);
          width: min(560px, calc(100vw - 80px));
          padding: 12px 16px;
          background: rgba(252, 251, 247, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--rule);
          border-radius: 999px;
          box-shadow: 0 4px 16px rgba(31,30,29,0.10);
          z-index: 35;
          font-family: var(--sans);
        }
        .article-tts-progress-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--ink-muted);
          margin-bottom: 6px;
        }
        .article-tts-progress-rate {
          color: var(--accent);
          font-weight: 600;
        }
        .article-tts-progress-bar {
          height: 4px;
          background: var(--rule);
          border-radius: 999px;
          overflow: hidden;
        }
        .article-tts-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-deep));
          border-radius: 999px;
          /* 短 transition + linear，让 30ms 一次的更新看起来平滑且不滞后 */
          transition: width 60ms linear;
        }

        /* 区块通用 */
        .article-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--sans);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 20px;
        }
        .article-section-header svg { color: var(--accent); }

        /* 笔记区 */
        .article-notes-section {
          margin-top: 64px;
          padding-top: 40px;
          border-top: 1px solid var(--rule);
        }
        .article-note-input {
          background: rgba(255,255,255,0.6);
          border: 1px solid var(--rule);
          border-radius: 12px;
          padding: 14px 16px;
          transition: border-color 0.15s, background 0.15s;
        }
        .article-note-input:focus-within {
          border-color: var(--accent);
          background: #fff;
        }
        .article-note-input textarea {
          width: 100%;
          border: none;
          outline: none;
          resize: vertical;
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.65;
          color: var(--ink);
          background: transparent;
          min-height: 60px;
        }
        .article-note-input textarea::placeholder { color: var(--ink-faint); }
        .article-note-input-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed var(--rule);
        }
        .article-note-hint {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .article-note-submit {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--ink);
          color: #FCFBF7;
          border: none;
          border-radius: 8px;
          font-family: var(--sans);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .article-note-submit:hover { background: var(--accent); }
        .article-note-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--ink-muted);
        }

        .article-notes-list {
          list-style: none;
          padding: 0;
          margin: 24px 0 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .article-note-item {
          padding: 14px 18px;
          background: rgba(255,255,255,0.55);
          border: 1px solid var(--rule);
          border-radius: 10px;
          transition: border-color 0.15s, background 0.15s;
        }
        .article-note-item:hover {
          border-color: var(--rule-strong);
          background: rgba(255,255,255,0.85);
        }
        .article-note-content {
          font-family: var(--serif);
          font-size: 15.5px;
          line-height: 1.7;
          color: var(--ink-soft);
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .article-note-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          font-family: var(--sans);
          font-size: 11px;
          color: var(--ink-faint);
        }
        .article-note-delete {
          background: transparent;
          border: none;
          color: var(--ink-faint);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
          display: inline-flex;
          align-items: center;
        }
        .article-note-delete:hover {
          color: #B53D2E;
          background: rgba(181, 61, 46, 0.08);
        }

        /* 相关文章 */
        .article-related-section {
          margin-top: 56px;
          padding-top: 40px;
          border-top: 1px solid var(--rule);
        }
        .article-related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .article-related-card {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.6);
          border: 1px solid var(--rule);
          border-radius: 12px;
          overflow: hidden;
          text-align: left;
          cursor: pointer;
          transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
          padding: 0;
        }
        .article-related-card:hover {
          transform: translateY(-2px);
          border-color: var(--rule-strong);
          box-shadow: 0 8px 24px rgba(31,30,29,0.08);
        }
        .article-related-cover {
          aspect-ratio: 16 / 9;
          width: 100%;
          background: var(--bg-alt);
          overflow: hidden;
          border-bottom: 1px solid var(--rule);
        }
        .article-related-cover img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .article-related-cover-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-faint);
        }
        .article-related-body {
          padding: 14px 16px 16px;
        }
        .article-related-title {
          font-family: var(--serif);
          font-size: 16px;
          font-weight: 600;
          line-height: 1.35;
          color: var(--ink);
          margin-bottom: 6px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .article-related-excerpt {
          font-family: var(--sans);
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-muted);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .article-related-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }
        .article-related-tag {
          font-family: var(--sans);
          font-size: 10.5px;
          padding: 2px 8px;
          color: var(--accent);
          background: var(--accent-soft);
          border-radius: 999px;
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
