// 文章详情页（博客式阅读视图）
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Calendar } from 'lucide-react';
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

export default function ArticleDetailPage({ articleId, initial, onBack, onEdit, onDeleted }: Props) {
  const [article, setArticle] = useState<Article | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">加载中...</div>
    );
  }
  if (!article) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">文章不存在或已被删除</p>
        <button
          onClick={onBack}
          className="px-4 py-2 border-2 border-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(article)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              编辑
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
          {article.title || '无标题'}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-8">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(article.created_at)}
          </div>
          {article.updated_at && article.updated_at !== article.created_at && (
            <span className="text-gray-400">· 更新于 {formatDate(article.updated_at)}</span>
          )}
          {article.tags && article.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {article.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {article.cover_url && (
          <div className="mb-8 border-2 border-gray-900">
            <img
              src={article.cover_url}
              alt={article.title || ''}
              className="w-full h-auto block"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {article.excerpt && (
          <p className="text-lg text-gray-700 leading-relaxed mb-8 pl-4 border-l-4 border-gray-900">
            {article.excerpt}
          </p>
        )}

        <article
          className="article-markdown text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <style>{`
          .article-markdown { font-size: 16px; line-height: 1.85; }
          .article-markdown h1 { font-size: 1.875rem; font-weight: 700; margin: 2rem 0 1rem; color: #111827; }
          .article-markdown h2 { font-size: 1.5rem; font-weight: 700; margin: 1.75rem 0 0.875rem; color: #111827; }
          .article-markdown h3 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: #111827; }
          .article-markdown h4 { font-size: 1.125rem; font-weight: 700; margin: 1.25rem 0 0.625rem; color: #111827; }
          .article-markdown p { margin: 1rem 0; }
          .article-markdown a { color: #111827; text-decoration: underline; text-underline-offset: 2px; }
          .article-markdown a:hover { color: #6366f1; }
          .article-markdown ul, .article-markdown ol { margin: 1rem 0; padding-left: 1.5rem; }
          .article-markdown ul { list-style: disc; }
          .article-markdown ol { list-style: decimal; }
          .article-markdown li { margin: 0.4rem 0; }
          .article-markdown blockquote { border-left: 4px solid #111827; padding: 0.5rem 1rem; margin: 1rem 0; background: #f9fafb; color: #4b5563; }
          .article-markdown code { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; color: #111827; }
          .article-markdown pre { background: #111827; color: #f3f4f6; padding: 1rem; overflow-x: auto; margin: 1rem 0; border: 2px solid #111827; }
          .article-markdown pre code { background: transparent; padding: 0; color: inherit; }
          .article-markdown img { max-width: 100%; height: auto; border: 2px solid #111827; margin: 1rem 0; display: block; }
          .article-markdown hr { border: none; border-top: 2px solid #111827; margin: 2rem 0; }
          .article-markdown table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
          .article-markdown th, .article-markdown td { border: 2px solid #111827; padding: 0.5rem 0.75rem; text-align: left; }
          .article-markdown th { background: #f3f4f6; font-weight: 700; }
        `}</style>
      </div>

      <Confirm
        isOpen={confirmOpen}
        title="删除文章"
        message={`确定要删除"${article.title || '无标题'}"吗？`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
