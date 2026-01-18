// 通用版本管理组件（可插拔设计）
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Plus, Check, GitBranch, Trash2, AlertCircle, Edit2 } from 'lucide-react';
import { 
  getVersions, 
  getCurrentVersion, 
  createNewVersion, 
  switchVersion,
  deleteVersion,
  type Version 
} from '../../lib/version-manager';
import { supabase } from '../../lib/supabase';

interface Props {
  creationId: string;
  userId: string;
  currentContent: any;
  onVersionSwitch: (version: Version) => void | Promise<void>;
  onVersionCreated?: (version: Version) => void | Promise<void>;
  showVersionManager: boolean; // 新增：控制是否加载
}

export default function VersionManager({
  creationId,
  userId,
  currentContent,
  onVersionSwitch,
  onVersionCreated,
  showVersionManager
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (showVersionManager) {
      loadVersions();
    }
  }, [showVersionManager]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const [versionsData, currentVersionData] = await Promise.all([
        getVersions(creationId),
        getCurrentVersion(creationId)
      ]);
      setVersions(versionsData);
      setCurrentVersion(currentVersionData);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersionTitle.trim()) return;
    
    setCreating(true);
    try {
      const version = await createNewVersion(creationId, userId, currentContent, {
        title: newVersionTitle,
        changeDescription: newVersionDesc
      });
      
      await loadVersions();
      setShowNewVersionDialog(false);
      setNewVersionTitle('');
      setNewVersionDesc('');
      onVersionCreated?.(version);
    } catch (error) {
      console.error('Failed to create version:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSwitchVersion = async (version: Version) => {
    console.log('[VersionManager] Switching to version:', version.id, version.title);
    console.log('[VersionManager] Current version:', currentVersion?.id, currentVersion?.title);
    
    if (version.id === currentVersion?.id) {
      console.log('[VersionManager] Already current version, skipping');
      return; // 已经是当前版本，不需要切换
    }
    
    console.log('[VersionManager] Calling onVersionSwitch callback');
    console.log('[VersionManager] onVersionSwitch type:', typeof onVersionSwitch);
    
    try {
      // 调用父组件的回调（可能是 async）
      await onVersionSwitch(version);
      console.log('[VersionManager] onVersionSwitch callback completed');
    } catch (error) {
      console.error('[VersionManager] onVersionSwitch callback error:', error);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (versions.length <= 1) {
      alert('至少需要保留一个版本');
      return;
    }
    
    if (!confirm('确定要删除这个版本吗？')) return;
    
    try {
      await deleteVersion(versionId);
      await loadVersions();
    } catch (error) {
      console.error('Failed to delete version:', error);
    }
  };

  const handleEditVersion = (version: Version) => {
    setEditingVersion(version);
    setEditTitle(version.title);
    setEditDesc(version.change_description || '');
  };

  const handleUpdateVersion = async () => {
    if (!editingVersion || !editTitle.trim()) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('creation_versions')
        .update({
          title: editTitle,
          change_description: editDesc || null
        })
        .eq('id', editingVersion.id);

      if (error) throw error;

      await loadVersions();
      setEditingVersion(null);
      setEditTitle('');
      setEditDesc('');
    } catch (error) {
      console.error('Failed to update version:', error);
      alert('更新失败，请重试');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    if (days < 365) return `${Math.floor(days / 30)} 月前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">版本管理</h3>
          <span className="text-sm text-gray-500">({versions.length} 个版本)</span>
        </div>
        <button
          onClick={() => setShowNewVersionDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建版本
        </button>
      </div>

      {/* 版本列表 */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {versions.map((version) => {
          const isCurrent = version.id === currentVersion?.id;
          
          return (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`
                border-2 p-3 cursor-pointer transition-all
                ${isCurrent 
                  ? 'border-gray-900 bg-gray-50' 
                  : 'border-gray-200 hover:border-gray-400 bg-white'
                }
              `}
              onClick={() => handleSwitchVersion(version)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {isCurrent && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                    <span className="font-medium text-gray-900">
                      {version.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      v{version.version_number}
                    </span>
                  </div>
                  
                  {version.change_description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {version.change_description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(version.created_at)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditVersion(version);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="编辑版本信息"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  {!isCurrent && versions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(version.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除版本"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 新建版本对话框 */}
      <AnimatePresence>
        {showNewVersionDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewVersionDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">创建新版本</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    版本名称 *
                  </label>
                  <input
                    type="text"
                    value={newVersionTitle}
                    onChange={(e) => setNewVersionTitle(e.target.value)}
                    placeholder="例如：优化工作经历描述"
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    变更说明（可选）
                  </label>
                  <textarea
                    value={newVersionDesc}
                    onChange={(e) => setNewVersionDesc(e.target.value)}
                    placeholder="描述这个版本的主要变更..."
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                  />
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-blue-50 border-2 border-blue-200">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    将保存当前编辑器中的所有内容作为新版本
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewVersionDialog(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={!newVersionTitle.trim() || creating}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? '创建中...' : '创建版本'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 编辑版本对话框 */}
      <AnimatePresence>
        {editingVersion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => {
              setEditingVersion(null);
              setEditTitle('');
              setEditDesc('');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">编辑版本信息</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    版本名称 *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="例如：优化工作经历描述"
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    变更说明（可选）
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="描述这个版本的主要变更..."
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingVersion(null);
                    setEditTitle('');
                    setEditDesc('');
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={updating}
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateVersion}
                  disabled={!editTitle.trim() || updating}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? '更新中...' : '保存修改'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
