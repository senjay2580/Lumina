// 简历项目列表页面
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, FileText, Clock, Trash2, Edit2, Loader2, GitBranch, Briefcase } from 'lucide-react';
import { getCreations, createCreation, deleteCreation, updateCreation, type Creation } from '../../lib/creations';
import { getLatestVersionsForCreations, type Version } from '../../lib/version-manager';
import { DEFAULT_RESUME_DATA } from '../../types/resume';

interface Props {
  userId: string;
  onSelectResume: (creation: Creation) => void;
  onOpenApplications: () => void;
  onBack: () => void;
}

export default function ResumeListPage({ userId, onSelectResume, onOpenApplications, onBack }: Props) {
  const [resumes, setResumes] = useState<Creation[]>([]);
  const [latestVersions, setLatestVersions] = useState<Record<string, Version>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newResumeTitle, setNewResumeTitle] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingResume, setEditingResume] = useState<Creation | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLoadingRef, setIsLoadingRef] = useState(false); // 防止重复加载

  useEffect(() => {
    if (!isLoadingRef) {
      loadResumes();
    }
  }, []); // 移除 userId 依赖，因为 userId 不会改变

  const loadResumes = async () => {
    if (isLoadingRef) return; // 防止重复加载
    
    setIsLoadingRef(true);
    setLoading(true);
    try {
      const data = await getCreations(userId, 'resume');
      setResumes(data);
      
      // 批量加载所有简历的最新版本（只需一次查询）
      if (data.length > 0) {
        const creationIds = data.map(r => r.id);
        const versions = await getLatestVersionsForCreations(creationIds);
        setLatestVersions(versions);
      }
    } catch (error) {
      console.error('Failed to load resumes:', error);
    } finally {
      setLoading(false);
      // 延迟重置，避免快速重复调用
      setTimeout(() => setIsLoadingRef(false), 1000);
    }
  };

  const handleEditResume = (resume: Creation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingResume(resume);
    setEditTitle(resume.title);
    setEditDescription(resume.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingResume || !editTitle.trim()) return;
    
    try {
      await updateCreation(editingResume.id, {
        title: editTitle,
        description: editDescription
      });
      await loadResumes();
      setEditingResume(null);
    } catch (error) {
      console.error('Failed to update resume:', error);
    }
  };

  const handleCreateResume = async () => {
    if (!newResumeTitle.trim()) return;
    
    setCreating(true);
    try {
      const creation = await createCreation(
        userId,
        'resume',
        newResumeTitle,
        '个人简历'
      );
      
      // 初始化默认简历数据
      await loadResumes();
      setShowNewDialog(false);
      setNewResumeTitle('');
      
      // 直接打开新创建的简历
      onSelectResume(creation);
    } catch (error) {
      console.error('Failed to create resume:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteResume = async (id: string) => {
    if (!confirm('确定要删除这份简历吗？所有版本都将被删除。')) return;
    
    try {
      await deleteCreation(id);
      await loadResumes();
    } catch (error) {
      console.error('Failed to delete resume:', error);
    }
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
            ← 返回创作中心
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">我的简历</h1>
              <p className="text-gray-600">管理你的简历项目和版本</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onOpenApplications}
                className="flex items-center gap-2 px-6 py-3 border-2 border-gray-900 hover:bg-gray-50 transition-colors"
              >
                <Briefcase className="w-5 h-5" />
                投递记录
              </button>
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
              >
                <Plus className="w-5 h-5" />
                新建简历
              </button>
            </div>
          </div>
        </div>

        {/* 简历列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有简历</h3>
            <p className="text-gray-600 mb-6">创建你的第一份简历，开始管理多个版本</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              新建简历
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumes.map((resume) => {
              const latestVersion = latestVersions[resume.id];
              
              return (
                <motion.div
                  key={resume.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-gray-900 p-6 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group cursor-pointer"
                  onClick={() => onSelectResume(resume)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <FileText className="w-8 h-8 text-gray-900" />
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditResume(resume, e)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                        title="编辑项目名"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteResume(resume.id);
                        }}
                        className="p-2 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                    {resume.title}
                  </h3>
                  
                  {resume.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {resume.description}
                    </p>
                  )}
                  
                  {/* 版本信息 */}
                  {latestVersion && (
                    <div className="mb-3 p-2 bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                        <GitBranch className="w-3 h-3" />
                        <span className="font-medium">最新版本：v{latestVersion.version_number}</span>
                      </div>
                      {latestVersion.title && (
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {latestVersion.title}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <Clock className="w-3 h-3" />
                    <span>更新于 {formatDate(resume.updated_at)}</span>
                  </div>
                  
                  <button
                    onClick={() => onSelectResume(resume)}
                    className="w-full py-2 border-2 border-gray-900 text-gray-900 font-medium hover:bg-gray-900 hover:text-white transition-colors"
                  >
                    打开编辑
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 新建简历对话框 */}
        {showNewDialog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">新建简历项目</h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  简历名称 *
                </label>
                <input
                  type="text"
                  value={newResumeTitle}
                  onChange={(e) => setNewResumeTitle(e.target.value)}
                  placeholder="例如：前端工程师简历"
                  className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newResumeTitle.trim()) {
                      handleCreateResume();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  一个项目可以包含多个版本，方便针对不同岗位定制
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewDialog(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateResume}
                  disabled={!newResumeTitle.trim() || creating}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 编辑项目对话框 */}
        {editingResume && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setEditingResume(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">编辑项目信息</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    项目名称 *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    项目描述
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingResume(null)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editTitle.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
