// 文章列表页
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, FileText, Calendar, Upload, LayoutGrid, List, Pin, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import {
  createArticle,
  getArticles,
  deleteArticle,
  searchArticles,
  sortArticles,
  togglePinArticle,
  type Article
} from '../../lib/articles';
import { Confirm } from '../../shared/Confirm';
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../../shared/ContextMenu';
import {
  pickMarkdownFile,
  importedMarkdownToContent,
  extractTitleFromMarkdown
} from '../../lib/markdown-io';

interface Props {
  userId: string;
  onBack?: () => void;
  onOpenArticle: (article: Article) => void;
  onCreateArticle: () => void;
  onEditArticle?: (article: Article) => void;
}

type ArticleLayout = 'grid' | 'list';
const ARTICLE_LAYOUT_STORAGE_KEY = 'lumina:articles:layout';

// 解析简单 frontmatter（YAML 子集）：title, excerpt, tags, cover
function parseFrontmatter(md: string): { meta: Record<string, any>; body: string } {
  if (!md.startsWith('---')) return { meta: {}, body: md };
  const end = md.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: md };
  const head = md.slice(3, end).trim();
  const body = md.slice(end + 4).replace(/^\r?\n/, '');
  const meta: Record<string, any> = {};
  for (const line of head.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value: any = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      try { value = JSON.parse(value); } catch { /* ignore */ }
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body };
}

export default function ArticlesPage({ userId, onBack, onOpenArticle, onCreateArticle, onEditArticle }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [importing, setImporting] = useState(false);
  const articleMenu = useContextMenu();
  const [layout, setLayout] = useState<ArticleLayout>(() => {
    if (typeof window === 'undefined') return 'grid';
    return window.localStorage.getItem(ARTICLE_LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false
  });

  useEffect(() => {
    loadArticles();
  }, [userId]);

  useEffect(() => {
    try { window.localStorage.setItem(ARTICLE_LAYOUT_STORAGE_KEY, layout); } catch {}
  }, [layout]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await getArticles(userId);
      setArticles(data);
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      loadArticles();
      return;
    }
    try {
      const data = await searchArticles(userId, searchKeyword);
      setArticles(data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const file = await pickMarkdownFile();
      if (!file) return;
      const { meta, body } = parseFrontmatter(file.content);
      const titleFromFile = (meta.title as string) || extractTitleFromMarkdown(body) || file.name.replace(/\.(md|markdown|txt)$/i, '');
      // 把 markdown body 转成 HTML 存储，与 TipTap 编辑器一致
      const contentHtml = importedMarkdownToContent(body.trim());
      const tags: string[] = Array.isArray(meta.tags) ? meta.tags : (typeof meta.tags === 'string' && meta.tags ? meta.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
      await createArticle(userId, {
        title: titleFromFile,
        excerpt: typeof meta.excerpt === 'string' ? meta.excerpt : undefined,
        cover_url: typeof meta.cover === 'string' ? meta.cover : undefined,
        content: contentHtml,
        tags
      });
      await loadArticles();
    } catch (err) {
      console.error('Import failed:', err);
      alert('导入失败，请检查文件格式');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (article: Article) => {
    const displayTitle = article.title || article.content.substring(0, 30) + '...';
    setConfirmDialog({
      isOpen: true,
      title: '删除文章',
      message: `确定要删除"${displayTitle}"吗？`,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteArticle(article.id);
          await loadArticles();
        } catch (err) {
          console.error('Failed to delete article:', err);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleTogglePin = async (article: Article) => {
    const nextPinned = !article.is_pinned;
    try {
      const updated = await togglePinArticle(article, nextPinned);
      setArticles((prev) => sortArticles(prev.map((item) => (item.id === updated.id ? updated : item))));
    } catch (err) {
      console.error('Failed to toggle article pin:', err);
      alert('置顶失败：请先执行最新数据库迁移，再重试。');
    }
  };

  const selectedMenuArticle = articleMenu.data as Article | undefined;
  const articleMenuItems: ContextMenuItem[] = selectedMenuArticle ? [
    {
      label: selectedMenuArticle.is_pinned ? '取消置顶' : '置顶',
      icon: <Pin className={`w-4 h-4 ${selectedMenuArticle.is_pinned ? 'fill-amber-400 text-amber-500' : ''}`} />,
      onClick: () => handleTogglePin(selectedMenuArticle)
    },
    {
      label: '编辑',
      icon: <Edit2 className="w-4 h-4" />,
      onClick: () => onEditArticle?.(selectedMenuArticle)
    },
    { label: '', divider: true, onClick: () => {} },
    {
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: () => handleDelete(selectedMenuArticle)
    }
  ] : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // 把文章 content（Tiptap 存的是 HTML）剥成纯文本作为摘要
  const buildExcerpt = (article: Article) => {
    if (article.excerpt && article.excerpt.trim()) return article.excerpt;
    const raw = article.content || '';
    let plain = '';
    if (typeof document !== 'undefined') {
      // 用浏览器 DOM 解析，HTML 标签 + 实体一次性处理
      const tmp = document.createElement('div');
      tmp.innerHTML = raw;
      plain = tmp.textContent || tmp.innerText || '';
    } else {
      // SSR 兜底：正则剥 HTML 标签 + 解码常见实体
      plain = raw
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    plain = plain.replace(/\s+/g, ' ').trim();
    return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 max-md:bg-white">
      <div className="max-w-[1360px] mx-auto px-8 py-8 max-md:px-5 max-md:py-4">
        <div className="mb-8 max-md:mb-5">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回创作中心
            </button>
          )}

          <div className="flex items-center justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
            <div className="flex items-center gap-3">
              <img src="/icons/article-news-paper.svg" alt="文章" className="w-10 h-10 shrink-0 max-md:w-8 max-md:h-8" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2 max-md:text-2xl max-md:mb-1">文章</h1>
                <p className="text-gray-600 max-md:text-sm">沉淀长文与博客内容</p>
              </div>
            </div>

            <div className="flex items-center gap-2 max-md:w-full">
              <div className="flex items-center border-2 border-gray-900 bg-white max-md:shrink-0" aria-label="切换文章布局">
                <button
                  type="button"
                  onClick={() => setLayout('grid')}
                  className={`h-12 w-12 flex items-center justify-center transition-colors max-md:h-10 max-md:w-10 ${
                    layout === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="卡片视图"
                  aria-label="卡片视图"
                >
                  <LayoutGrid className="w-5 h-5 max-md:w-4 max-md:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('list')}
                  className={`h-12 w-12 flex items-center justify-center border-l-2 border-gray-900 transition-colors max-md:h-10 max-md:w-10 ${
                    layout === 'list' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="长条视图"
                  aria-label="长条视图"
                >
                  <List className="w-5 h-5 max-md:w-4 max-md:h-4" />
                </button>
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-3 border-2 border-gray-900 hover:bg-gray-100 disabled:opacity-60 transition-colors max-md:flex-1 max-md:justify-center max-md:px-3 max-md:py-2 max-md:text-sm"
              >
                <Upload className="w-5 h-5 max-md:w-4 max-md:h-4" />
                {importing ? '导入中…' : '导入 MD'}
              </button>
              <button
                onClick={onCreateArticle}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] max-md:flex-1 max-md:justify-center max-md:px-3 max-md:py-2 max-md:text-sm"
              >
                <Plus className="w-5 h-5 max-md:w-4 max-md:h-4" />
                新建文章
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索标题、摘要或正文..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            搜索
          </button>
          {searchKeyword && (
            <button
              onClick={() => {
                setSearchKeyword('');
                loadArticles();
              }}
              className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
            >
              清空
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchKeyword ? '没有找到相关文章' : '还没有文章'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchKeyword ? '试试其他关键词' : '开始写下你的第一篇文章'}
            </p>
            {!searchKeyword && (
              <button
                onClick={onCreateArticle}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                新建文章
              </button>
            )}
          </div>
        ) : (
          <div className={layout === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-md:gap-0 max-md:divide-y max-md:divide-gray-200"
            : "w-full space-y-2.5"
          }>
            {articles.map((article) => (
              layout === 'list' ? (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onOpenArticle(article)}
                  onContextMenu={(e) => articleMenu.open(e, article)}
                  className={`group relative cursor-pointer border px-6 py-5 transition-all hover:shadow-sm max-md:border-x-0 max-md:px-0 max-md:py-4 max-md:hover:shadow-none ${
                    article.is_pinned
                      ? 'border-amber-200/60 bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-yellow-50/70 hover:from-amber-50/90 hover:via-orange-50/70 hover:to-yellow-50/80'
                      : 'border-gray-200/80 bg-white hover:border-gray-300 hover:bg-[#FAFAF7]'
                  }`}
                >
                  {/* 置顶弥光底纹 */}
                  {article.is_pinned && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-300/20 rounded-full blur-[40px]" />
                      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-orange-300/15 rounded-full blur-[40px]" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(article);
                    }}
                    className="absolute right-5 top-5 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors max-md:right-0 max-md:top-4"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="max-w-[1120px] pr-11 max-md:pr-9">
                    <div className="flex items-start gap-2">
                      {article.is_pinned && <Pin className="mt-1 w-4 h-4 shrink-0 fill-amber-400 text-amber-500" />}
                      <h3 className="text-[20px] leading-snug font-bold text-gray-950 line-clamp-2 max-md:text-[17px]">
                        {article.title || '无标题'}
                      </h3>
                    </div>
                    <p className="mt-2 text-[14.5px] leading-7 text-gray-600 line-clamp-2 max-md:text-[13px] max-md:leading-6">
                      {buildExcerpt(article)}
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-[11.5px] text-gray-500 max-md:mt-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(article.created_at)}
                      </span>
                      {article.tags?.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ) : (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`overflow-hidden hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.9)] transition-shadow cursor-pointer flex flex-col relative
                    max-md:flex-row-reverse max-md:items-start max-md:gap-4 max-md:border-0 max-md:p-0 max-md:py-5 max-md:hover:shadow-none max-md:bg-transparent ${
                      article.is_pinned
                        ? 'border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white/90 to-orange-50/60 shadow-[0_0_24px_-4px_rgba(251,191,36,0.25)]'
                        : 'border-2 border-gray-900 bg-white'
                    }`}
                  onClick={() => onOpenArticle(article)}
                  onContextMenu={(e) => articleMenu.open(e, article)}
                >
                  {/* 置顶弥光光斑 */}
                  {article.is_pinned && (
                    <>
                      <div className="absolute -top-12 right-8 w-32 h-32 bg-amber-300/20 rounded-full blur-[48px] pointer-events-none" />
                      <div className="absolute bottom-0 left-2 w-24 h-24 bg-orange-300/15 rounded-full blur-[40px] pointer-events-none" />
                    </>
                  )}
                  <div className="p-3.5 flex-1 flex flex-col max-md:p-0 max-md:min-w-0">
                    <div className="flex items-start justify-between mb-1.5 gap-2 max-md:mb-1.5">
                      <div className="flex min-w-0 flex-1 items-start gap-1.5">
                        {article.is_pinned && <Pin className="mt-0.5 w-4 h-4 shrink-0 fill-amber-400 text-amber-500" />}
                        <h3 className="text-base font-bold text-gray-900 line-clamp-2 flex-1
                          max-md:text-[16px] max-md:font-bold max-md:leading-snug max-md:tracking-tight"
                          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                          {article.title || '无标题'}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(article);
                        }}
                        className="p-1 hover:bg-red-50 transition-colors shrink-0 max-md:hidden"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>

                    <p className="text-gray-600 text-xs mb-2 line-clamp-2 flex-1
                      max-md:line-clamp-2 max-md:mb-2 max-md:text-[13.5px] max-md:text-[#6B6B6B] max-md:leading-relaxed max-md:flex-none">
                      {buildExcerpt(article)}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 max-md:text-[12.5px] max-md:text-[#6B6B6B]">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 max-md:hidden" />
                        {formatDate(article.created_at)}
                      </div>
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex gap-1 max-w-[60%] overflow-hidden">
                          {article.tags.slice(0, 2).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 truncate text-[11px]
                              max-md:bg-[#F2F2F2] max-md:text-[#242424] max-md:rounded-full max-md:px-2 max-md:py-px">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            ))}
          </div>
        )}

        <Confirm
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        />
        {articleMenu.isOpen && selectedMenuArticle && (
          <ContextMenu
            x={articleMenu.x}
            y={articleMenu.y}
            items={articleMenuItems}
            onClose={articleMenu.close}
          />
        )}
      </div>
    </div>
  );
}
