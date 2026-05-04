// 文章列表页
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, FileText, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getArticles,
  deleteArticle,
  searchArticles,
  type Article
} from '../../lib/articles';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  onBack: () => void;
  onOpenArticle: (article: Article) => void;
  onCreateArticle: () => void;
}

export default function ArticlesPage({ userId, onBack, onOpenArticle, onCreateArticle }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const buildExcerpt = (article: Article) => {
    if (article.excerpt && article.excerpt.trim()) return article.excerpt;
    const plain = article.content.replace(/[#>*`_\-\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
    return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回创作中心
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">文章</h1>
              <p className="text-gray-600">沉淀长文与博客内容</p>
            </div>

            <button
              onClick={onCreateArticle}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
            >
              <Plus className="w-5 h-5" />
              新建文章
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-gray-900 overflow-hidden hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.9)] transition-shadow cursor-pointer flex flex-col"
                onClick={() => onOpenArticle(article)}
              >
                {article.cover_url ? (
                  <div className="aspect-[16/9] w-full bg-gray-100 overflow-hidden border-b-2 border-gray-900">
                    <img
                      src={article.cover_url}
                      alt={article.title || ''}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-b-2 border-gray-900">
                    <FileText className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1">
                      {article.title || '无标题'}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(article);
                      }}
                      className="p-1 hover:bg-red-50 transition-colors shrink-0"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                    {buildExcerpt(article)}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.created_at)}
                    </div>
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex gap-1 max-w-[60%] overflow-hidden">
                        {article.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700 truncate">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
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
      </div>
    </div>
  );
}
