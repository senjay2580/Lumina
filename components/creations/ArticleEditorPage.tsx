// 文章编辑页（全屏，支持 Markdown 实时预览）
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Eye, Pencil, Image as ImageIcon, X, Tag } from 'lucide-react';
import { marked } from 'marked';
import {
  createArticle,
  updateArticle,
  type Article
} from '../../lib/articles';

interface Props {
  userId: string;
  initial?: Article | null;
  onBack: () => void;
  onSaved: (article: Article) => void;
}

type Mode = 'edit' | 'preview' | 'split';

export default function ArticleEditorPage({ userId, initial, onBack, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [content, setContent] = useState(initial?.content || '');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('split');

  useEffect(() => {
    setTitle(initial?.title || '');
    setCoverUrl(initial?.cover_url || '');
    setExcerpt(initial?.excerpt || '');
    setContent(initial?.content || '');
    setTags(initial?.tags || []);
  }, [initial?.id]);

  const previewHtml = useMemo(() => {
    if (!content.trim()) return '<p style="color:#9ca3af">在左侧输入 Markdown，这里会显示预览…</p>';
    return marked.parse(content, { async: false }) as string;
  }, [content]);

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setTagInput('');
      return;
    }
    setTags([...tags, v]);
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        content: content.trim(),
        tags
      };
      let saved: Article;
      if (initial?.id) {
        saved = await updateArticle(initial.id, payload);
      } else {
        saved = await createArticle(userId, payload);
      }
      onSaved(saved);
    } catch (err) {
      console.error('Failed to save article:', err);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* 顶部工具条 */}
      <div className="border-b-2 border-gray-900 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex items-center gap-2">
            <div className="flex border-2 border-gray-900">
              <button
                onClick={() => setMode('edit')}
                className={`px-3 py-1.5 flex items-center gap-1 text-sm transition-colors ${
                  mode === 'edit' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                编辑
              </button>
              <button
                onClick={() => setMode('split')}
                className={`px-3 py-1.5 text-sm transition-colors border-l-2 border-gray-900 ${
                  mode === 'split' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                }`}
              >
                分屏
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-3 py-1.5 flex items-center gap-1 text-sm transition-colors border-l-2 border-gray-900 ${
                  mode === 'preview' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                预览
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : initial?.id ? '保存' : '发布'}
            </button>
          </div>
        </div>
      </div>

      {/* 元信息区 */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题..."
            className="w-full text-3xl font-bold border-none outline-none placeholder:text-gray-300"
          />

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="封面图 URL（可选）"
                className="flex-1 px-3 py-1.5 border border-gray-300 focus:border-gray-900 outline-none text-sm"
              />
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt=""
                  className="w-10 h-10 object-cover border border-gray-300"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 focus-within:border-gray-900">
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
                  placeholder={tags.length ? '' : '标签（回车添加）'}
                  className="flex-1 min-w-[100px] outline-none text-sm py-0.5"
                />
              </div>
            </div>
          </div>

          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="摘要（可选，列表页与详情页顶部展示）"
            className="w-full px-3 py-1.5 border border-gray-300 focus:border-gray-900 outline-none text-sm"
          />
        </div>
      </div>

      {/* 编辑区 */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex">
          {(mode === 'edit' || mode === 'split') && (
            <div className={`${mode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'} h-full`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# 开始写作\n\n支持 Markdown 语法，例如：\n\n- 列表\n- **粗体** *斜体*\n- [链接](https://...)\n\n\`\`\`js\nconst hello = 'world';\n\`\`\`\n\n> 引用\n`}
                className="w-full h-full px-6 py-5 outline-none resize-none font-mono text-sm leading-relaxed"
              />
            </div>
          )}

          {(mode === 'preview' || mode === 'split') && (
            <div className={`${mode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-y-auto px-6 py-5`}>
              <article
                className="article-markdown text-gray-800 leading-relaxed max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .article-markdown { font-size: 15px; line-height: 1.8; }
        .article-markdown h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5rem 0 0.875rem; color: #111827; }
        .article-markdown h2 { font-size: 1.4rem; font-weight: 700; margin: 1.25rem 0 0.75rem; color: #111827; }
        .article-markdown h3 { font-size: 1.2rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #111827; }
        .article-markdown p { margin: 0.875rem 0; }
        .article-markdown a { color: #111827; text-decoration: underline; }
        .article-markdown ul, .article-markdown ol { margin: 0.875rem 0; padding-left: 1.5rem; }
        .article-markdown ul { list-style: disc; }
        .article-markdown ol { list-style: decimal; }
        .article-markdown li { margin: 0.3rem 0; }
        .article-markdown blockquote { border-left: 4px solid #111827; padding: 0.5rem 1rem; margin: 0.875rem 0; background: #f9fafb; color: #4b5563; }
        .article-markdown code { background: #f3f4f6; padding: 0.1rem 0.35rem; font-family: ui-monospace, monospace; font-size: 0.9em; }
        .article-markdown pre { background: #111827; color: #f3f4f6; padding: 1rem; overflow-x: auto; margin: 0.875rem 0; border: 2px solid #111827; }
        .article-markdown pre code { background: transparent; padding: 0; color: inherit; }
        .article-markdown img { max-width: 100%; height: auto; border: 2px solid #111827; margin: 0.875rem 0; display: block; }
        .article-markdown hr { border: none; border-top: 2px solid #111827; margin: 1.5rem 0; }
        .article-markdown table { border-collapse: collapse; width: 100%; margin: 0.875rem 0; }
        .article-markdown th, .article-markdown td { border: 2px solid #111827; padding: 0.4rem 0.6rem; text-align: left; }
        .article-markdown th { background: #f3f4f6; font-weight: 700; }
      `}</style>
    </div>
  );
}
