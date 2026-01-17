// 文章/想法页面
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Edit2, Trash2, MessageSquare, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { getIdeas, createIdea, updateIdea, deleteIdea, searchIdeas } from '../../lib/ideas';
import type { Idea, CreateIdeaData } from '../../types/idea';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  onBack: () => void;
}

export default function IdeasPage({ userId, onBack }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const [formData, setFormData] = useState<CreateIdeaData>({
    title: '',
    content: '',
    tags: []
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
    loadIdeas();
  }, [userId]);

  const loadIdeas = async () => {
    try {
      const data = await getIdeas(userId);
      setIdeas(data);
    } catch (err) {
      console.error('Failed to load ideas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      loadIdeas();
      return;
    }
    
    try {
      const data = await searchIdeas(userId, searchKeyword);
      setIdeas(data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.content.trim()) return;

    // 如果没有标题，从内容生成
    const title = formData.title?.trim() || formData.content.substring(0, 50).trim();

    try {
      await createIdea(userId, {
        ...formData,
        title
      });
      await loadIdeas();
      setShowEditor(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create idea:', err);
    }
  };

  const handleUpdate = async () => {
    if (!editingIdea || !formData.content.trim()) return;

    // 如果没有标题，从内容生成
    const title = formData.title?.trim() || formData.content.substring(0, 50).trim();

    try {
      await updateIdea(editingIdea.id, {
        ...formData,
        title
      });
      await loadIdeas();
      setEditingIdea(null);
      setShowEditor(false);
      resetForm();
    } catch (err) {
      console.error('Failed to update idea:', err);
    }
  };

  const handleDelete = (idea: Idea) => {
    const displayTitle = idea.title || idea.content.substring(0, 30) + '...';
    setConfirmDialog({
      isOpen: true,
      title: '删除想法',
      message: `确定要删除"${displayTitle}"吗？`,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteIdea(idea.id);
          await loadIdeas();
        } catch (err) {
          console.error('Failed to delete idea:', err);
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setFormData({
      title: idea.title,
      content: idea.content,
      tags: idea.tags || []
    });
    setShowEditor(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      tags: []
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 头部 */}
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">文章/想法</h1>
              <p className="text-gray-600">记录灵感和思考</p>
            </div>
            
            <button
              onClick={() => {
                resetForm();
                setEditingIdea(null);
                setShowEditor(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
            >
              <Plus className="w-5 h-5" />
              新建想法
            </button>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索标题或内容..."
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
                loadIdeas();
              }}
              className="px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
            >
              清空
            </button>
          )}
        </div>

        {/* 想法列表 */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchKeyword ? '没有找到相关想法' : '还没有想法'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchKeyword ? '试试其他关键词' : '记录你的第一个灵感'}
            </p>
            {!searchKeyword && (
              <button
                onClick={() => setShowEditor(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                新建想法
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ideas.map((idea) => (
              <motion.div
                key={idea.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-gray-900 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleEdit(idea)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900 flex-1 line-clamp-2">
                    {idea.title || idea.content.substring(0, 50) + '...'}
                  </h3>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(idea);
                      }}
                      className="p-1 hover:bg-gray-100 transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(idea);
                      }}
                      className="p-1 hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {idea.content}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(idea.created_at)}
                  </div>
                  {idea.source === 'feishu' && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700">飞书</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 编辑器对话框 */}
        {showEditor && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowEditor(false);
              setEditingIdea(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-6">
                {editingIdea ? '编辑想法' : '新建想法'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标题（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="不填写则自动从内容生成..."
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    内容 *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="记录你的想法、灵感、思考..."
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                    rows={12}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingIdea(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={editingIdea ? handleUpdate : handleCreate}
                  disabled={!formData.content.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingIdea ? '保存' : '创建'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 确认对话框 */}
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
