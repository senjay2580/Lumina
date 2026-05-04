// 文章编辑页（WYSIWYG，所见即所得 + 自动保存 + 离开保护）
import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Save, X, Tag, Loader2, Check } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import {
  createArticle,
  updateArticle,
  type Article
} from '../../lib/articles';
import { supabase } from '../../lib/supabase';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  initial?: Article | null;
  onBack: () => void;
  onSaved: (article: Article) => void;
}

const FIRST_IMG_RE = /<img[^>]+src=["']([^"']+)["']/i;
const AUTOSAVE_DEBOUNCE_MS = 3000;

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

async function uploadInlineImage(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${userId}/articles/${id}.${ext}`;

  const contentType = file.type || `image/${ext}`;
  const { error } = await supabase.storage
    .from('resources')
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('resources').getPublicUrl(path);
  return data.publicUrl;
}

function buildSnapshot(s: {
  title: string;
  excerpt: string;
  tags: string[];
  contentHtml: string;
}) {
  return JSON.stringify({
    title: s.title.trim(),
    excerpt: s.excerpt.trim(),
    tags: [...s.tags],
    content: s.contentHtml.trim()
  });
}

export default function ArticleEditorPage({ userId, initial, onBack, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(0);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [articleId, setArticleId] = useState<string | undefined>(initial?.id);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // 已保存的快照，用于判断 dirty
  const savedSnapshotRef = useRef<string>('');
  // autosave 计时器
  const autosaveTimerRef = useRef<number | null>(null);
  // 防止初始化加载内容触发 dirty
  const initializingRef = useRef(true);
  // 当前保存中标记，避免并发
  const savingRef = useRef(false);

  const handleImageFiles = async (
    files: File[],
    insertHtml: (html: string) => void
  ) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return false;

    setUploading((n) => n + images.length);
    try {
      for (const file of images) {
        try {
          const url = await uploadInlineImage(userIdRef.current, file);
          const safeAlt = (file.name || 'image').replace(/"/g, '&quot;');
          insertHtml(`<img src="${url}" alt="${safeAlt}" />`);
        } catch (err) {
          console.error('Image upload failed:', err);
          alert('图片上传失败，请稍后重试');
        }
      }
    } finally {
      setUploading((n) => Math.max(0, n - images.length));
    }
    return true;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Placeholder.configure({
        placeholder: '开始写作…\n\n输入 # 创建标题，** 加粗，- 列表，> 引用；直接粘贴或拖拽图片即可上传'
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Typography
    ],
    content: initial?.content || '',
    onUpdate: () => {
      if (initializingRef.current) return;
      setStatus('dirty');
    },
    editorProps: {
      attributes: { class: 'article-prose outline-none min-h-[60vh]' },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items || items.length === 0) return false;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f && f.type.startsWith('image/')) files.push(f);
          }
        }
        if (files.length === 0) return false;
        event.preventDefault();
        const editorAny = (view as any).editor;
        handleImageFiles(files, (html) => {
          editorAny?.commands.insertContent(html);
        });
        return true;
      },
      handleDrop: (view, event) => {
        const dt = event.dataTransfer;
        if (!dt || !dt.files || dt.files.length === 0) return false;
        const files = Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        const editorAny = (view as any).editor;
        handleImageFiles(files, (html) => {
          editorAny?.commands.insertContent(html);
        });
        return true;
      }
    }
  });

  // 初始化已保存快照
  useEffect(() => {
    if (!editor) return;
    initializingRef.current = true;
    const initialContent = initial?.content || '';
    if (initialContent && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
    savedSnapshotRef.current = buildSnapshot({
      title: initial?.title || '',
      excerpt: initial?.excerpt || '',
      tags: initial?.tags || [],
      contentHtml: editor.getHTML()
    });
    setStatus('idle');
    // 等下一帧再开放 dirty 检测
    requestAnimationFrame(() => {
      initializingRef.current = false;
    });
  }, [editor, initial?.id]);

  // 元信息变更也算 dirty
  useEffect(() => {
    if (initializingRef.current || !editor) return;
    const cur = buildSnapshot({
      title,
      excerpt,
      tags,
      contentHtml: editor.getHTML()
    });
    if (cur !== savedSnapshotRef.current) {
      setStatus((prev) => (prev === 'saving' ? prev : 'dirty'));
    }
  }, [title, excerpt, tags, editor]);

  const performSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!editor) return null;
      if (savingRef.current) return null;
      const html = editor.getHTML().trim();
      const text = editor.getText().trim();
      const hasTitle = title.trim().length > 0;
      // 完全空白的草稿不保存
      if (!text && !html && !hasTitle) return null;

      savingRef.current = true;
      setStatus('saving');
      try {
        const coverMatch = html.match(FIRST_IMG_RE);
        const coverUrl = coverMatch ? coverMatch[1] : undefined;

        const payload = {
          title: title.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          cover_url: coverUrl,
          content: html,
          tags
        };

        let saved: Article;
        if (articleId) {
          saved = await updateArticle(articleId, payload);
        } else {
          saved = await createArticle(userIdRef.current, payload);
          setArticleId(saved.id);
        }

        savedSnapshotRef.current = buildSnapshot({
          title,
          excerpt,
          tags,
          contentHtml: html
        });
        setLastSavedAt(new Date());
        setStatus('saved');
        if (!opts?.silent) {
          // 显式保存 → 跳转到详情；自动保存只更新状态
          onSaved(saved);
        }
        return saved;
      } catch (err) {
        console.error('Failed to save article:', err);
        setStatus('error');
        if (!opts?.silent) alert('保存失败：可能数据库迁移尚未执行，请联系管理员或先在 Supabase Dashboard 执行 supabase/migrations/20260504_add_kind_to_ideas.sql');
        return null;
      } finally {
        savingRef.current = false;
      }
    },
    [editor, title, excerpt, tags, articleId, onSaved]
  );

  // 自动保存：dirty 时延迟 3s
  useEffect(() => {
    if (status !== 'dirty') return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      performSave({ silent: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [status, performSave]);

  // 离开页面前的浏览器原生提示（关闭/刷新 tab）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  // 应用内返回前确认
  const handleBackClick = () => {
    if (status === 'dirty' || status === 'saving' || uploading > 0) {
      setConfirmExit(true);
      return;
    }
    onBack();
  };

  const handleDiscardAndExit = () => {
    setConfirmExit(false);
    onBack();
  };

  const handleSaveAndExit = async () => {
    setConfirmExit(false);
    const saved = await performSave({ silent: true });
    if (saved) {
      onSaved(saved);
    } else {
      // 保存失败时不强行退出，让用户处理
    }
  };

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleManualSave = () => {
    performSave();
  };

  const formatTime = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatus = () => {
    if (uploading > 0) {
      return (
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          上传中 {uploading}…
        </span>
      );
    }
    switch (status) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            保存中…
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3.5 h-3.5" />
            已保存{lastSavedAt ? ` ${formatTime(lastSavedAt)}` : ''}
          </span>
        );
      case 'dirty':
        return <span className="text-xs text-amber-600">未保存修改…</span>;
      case 'error':
        return <span className="text-xs text-red-600">保存失败</span>;
      default:
        return lastSavedAt ? (
          <span className="text-xs text-gray-400">已保存 {formatTime(lastSavedAt)}</span>
        ) : null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="border-b-2 border-gray-900 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={handleBackClick}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex items-center gap-3">
            {renderStatus()}
            <button
              onClick={handleManualSave}
              disabled={status === 'saving'}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {status === 'saving' ? '保存中...' : articleId ? '保存' : '发布'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-8 py-10">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题…"
            className="w-full text-4xl md:text-5xl font-bold border-none outline-none placeholder:text-gray-300 mb-4"
          />

          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1 flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-xs"
                >
                  {t}
                  <button onClick={() => handleRemoveTag(t)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                    handleRemoveTag(tags[tags.length - 1]);
                  }
                }}
                onBlur={handleAddTag}
                placeholder={tags.length ? '' : '添加标签（回车）'}
                className="flex-1 min-w-[120px] outline-none text-sm py-1"
              />
            </div>
          </div>

          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="摘要（可选）"
            className="w-full px-0 py-1 text-base text-gray-600 border-none outline-none placeholder:text-gray-300 mb-6 border-b border-gray-100"
          />

          <EditorContent editor={editor} />
        </div>
      </div>

      <Confirm
        isOpen={confirmExit}
        title="有未保存的修改"
        message="是否在退出前保存？"
        confirmText="保存并退出"
        cancelText="放弃修改"
        onConfirm={handleSaveAndExit}
        onCancel={handleDiscardAndExit}
      />

      <style>{`
        .article-prose { font-size: 16px; line-height: 1.85; color: #1f2937; }
        .article-prose:focus { outline: none; }
        .article-prose p { margin: 0.875rem 0; }
        .article-prose h1 { font-size: 1.875rem; font-weight: 700; margin: 1.5rem 0 0.875rem; color: #111827; }
        .article-prose h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.75rem; color: #111827; }
        .article-prose h3 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #111827; }
        .article-prose h4 { font-size: 1.125rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #111827; }
        .article-prose a { color: #111827; text-decoration: underline; text-underline-offset: 2px; }
        .article-prose ul, .article-prose ol { margin: 0.875rem 0; padding-left: 1.5rem; }
        .article-prose ul { list-style: disc; }
        .article-prose ol { list-style: decimal; }
        .article-prose li { margin: 0.3rem 0; }
        .article-prose blockquote { border-left: 4px solid #111827; padding: 0.5rem 1rem; margin: 0.875rem 0; background: #f9fafb; color: #4b5563; }
        .article-prose code { background: #f3f4f6; padding: 0.1rem 0.35rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; color: #111827; }
        .article-prose pre { background: #111827; color: #f3f4f6; padding: 1rem; overflow-x: auto; margin: 0.875rem 0; border: 2px solid #111827; }
        .article-prose pre code { background: transparent; padding: 0; color: inherit; }
        .article-prose img { max-width: 100%; height: auto; border: 2px solid #111827; margin: 1rem 0; display: block; }
        .article-prose hr { border: none; border-top: 2px solid #111827; margin: 1.5rem 0; }
        .article-prose p.is-editor-empty:first-child::before {
          color: #d1d5db;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          white-space: pre-line;
        }
      `}</style>
    </div>
  );
}
