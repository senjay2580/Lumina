// 简历编辑器主页面（左侧编辑 + 右侧预览）
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Save, 
  Download, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  Settings,
  GitBranch,
  Loader2
} from 'lucide-react';
import { type Creation } from '../../lib/creations';
import { getCurrentVersion, updateVersionContent, switchVersion, type Version } from '../../lib/version-manager';
import { type ResumeData, DEFAULT_RESUME_DATA } from '../../types/resume';
import { getPhoto, savePhoto } from '../../lib/resume-photo-cache';
import { exportToHTML } from '../../lib/pdf-export';
import ResumeEditor from './ResumeEditor';
import ResumePreviewCanvas from './ResumePreviewCanvas';
import ResumePreview from './ResumePreview';
import VersionManager from './VersionManager';

interface Props {
  creation: Creation;
  userId: string;
  onBack: () => void;
}

export default function ResumeEditorPage({ creation, userId, onBack }: Props) {
  const [resumeData, setResumeData] = useState<ResumeData>(DEFAULT_RESUME_DATA);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // 加载当前版本数据
  useEffect(() => {
    loadCurrentVersion();
  }, [creation.id]);

  const loadCurrentVersion = async () => {
    console.log('[ResumeEditorPage] loadCurrentVersion started');
    setLoading(true);
    try {
      const version = await getCurrentVersion(creation.id);
      console.log('[ResumeEditorPage] Loaded version from DB:', version?.id, version?.title);
      
      if (version) {
        setCurrentVersion(version);
        console.log('[ResumeEditorPage] Set currentVersion state');
        
        setResumeData(version.content || DEFAULT_RESUME_DATA);
        console.log('[ResumeEditorPage] Set resumeData state');
        
        // 加载照片
        const photo = getPhoto(creation.id, version.id);
        setPhotoData(photo);
        console.log('[ResumeEditorPage] Set photoData state');
        
        setHasUnsavedChanges(false);
        console.log('[ResumeEditorPage] Reset hasUnsavedChanges');
      }
    } catch (error) {
      console.error('[ResumeEditorPage] Failed to load version:', error);
    } finally {
      setLoading(false);
      console.log('[ResumeEditorPage] loadCurrentVersion completed');
    }
  };

  // 处理数据变更
  const handleDataChange = useCallback((newData: ResumeData) => {
    setResumeData(newData);
    setHasUnsavedChanges(true);
  }, []);

  // 处理照片变更
  const handlePhotoChange = useCallback((photo: string | null) => {
    setPhotoData(photo);
    if (currentVersion && photo) {
      savePhoto(creation.id, currentVersion.id, photo);
    }
    setHasUnsavedChanges(true);
  }, [creation.id, currentVersion]);

  // 保存当前版本
  const handleSave = async () => {
    if (!currentVersion) return;
    
    setSaving(true);
    try {
      await updateVersionContent(currentVersion.id, resumeData);
      
      // 保存照片
      if (photoData) {
        savePhoto(creation.id, currentVersion.id, photoData);
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 版本切换
  const handleVersionSwitch = async (version: Version) => {
    console.log('[ResumeEditorPage] handleVersionSwitch called with:', version.id, version.title);
    console.log('[ResumeEditorPage] hasUnsavedChanges:', hasUnsavedChanges);
    
    // 检查未保存的更改
    if (hasUnsavedChanges) {
      const confirmed = confirm('有未保存的更改，切换版本将丢失这些更改。确定要继续吗？');
      console.log('[ResumeEditorPage] User confirmed:', confirmed);
      if (!confirmed) {
        return;
      }
    }
    
    try {
      console.log('[ResumeEditorPage] Calling switchVersion API...');
      // 在数据库中切换版本
      await switchVersion(creation.id, version.id);
      console.log('[ResumeEditorPage] switchVersion API success');
      
      // 关闭版本管理器
      setShowVersionManager(false);
      console.log('[ResumeEditorPage] Version manager closed');
      
      // 重新加载当前版本（从数据库获取最新状态）
      console.log('[ResumeEditorPage] Reloading current version...');
      await loadCurrentVersion();
      console.log('[ResumeEditorPage] Version switch complete');
    } catch (error) {
      console.error('[ResumeEditorPage] Failed to switch version:', error);
      alert('切换版本失败，请重试');
    }
  };

  // 版本创建后的回调
  const handleVersionCreated = async (version: Version) => {
    // 关闭版本管理器
    setShowVersionManager(false);
    
    // 重新加载当前版本
    await loadCurrentVersion();
  };

  // 导出 HTML
  const handleExport = async () => {
    if (!exportRef.current) return;
    
    setExporting(true);
    try {
      const filename = `${creation.title}_${currentVersion?.title || '简历'}.html`;
      await exportToHTML(exportRef.current, { filename });
    } catch (error) {
      console.error('导出失败:', error);
      alert('HTML 导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // 离开前提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="flex-shrink-0 bg-white border-b-2 border-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (confirm('有未保存的更改，确定要离开吗？')) {
                    onBack();
                  }
                } else {
                  onBack();
                }
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </button>
            
            <div className="h-6 w-px bg-gray-300" />
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">{creation.title}</h1>
              {currentVersion && (
                <p className="text-sm text-gray-500">
                  {currentVersion.title} (v{currentVersion.version_number})
                  {hasUnsavedChanges && <span className="text-orange-600 ml-2">• 未保存</span>}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 预览切换 */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
              title={showPreview ? '隐藏预览' : '显示预览'}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? '隐藏预览' : '显示预览'}
            </button>
            
            {/* 版本管理 */}
            <button
              onClick={() => setShowVersionManager(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              版本
            </button>
            
            {/* 保存 */}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
            
            {/* 导出 */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="导出为 HTML 文件，可在浏览器中打印为 PDF"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? '导出中...' : '导出 HTML'}
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：编辑器 */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} overflow-y-auto border-r-2 border-gray-900 bg-white transition-all`}>
          <ResumeEditor
            data={resumeData}
            photoData={photoData}
            onChange={handleDataChange}
            onPhotoChange={handlePhotoChange}
          />
        </div>

        {/* 右侧：预览（可缩放拖拽） */}
        {showPreview && (
          <div className="w-1/2 bg-gray-100 relative">
            <ResumePreviewCanvas
              data={resumeData}
              photoData={photoData}
            />
          </div>
        )}
      </div>

      {/* 隐藏的导出用预览（用于生成 PDF） */}
      <div className="fixed -left-[9999px] top-0">
        <div ref={exportRef}>
          <ResumePreview
            data={resumeData}
            photoData={photoData}
          />
        </div>
      </div>

      {/* 版本管理侧边栏 */}
      {showVersionManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-full max-w-md h-full bg-white border-l-2 border-gray-900 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">版本管理</h2>
              <button
                onClick={() => setShowVersionManager(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>
            
            <VersionManager
              creationId={creation.id}
              userId={userId}
              currentContent={resumeData}
              onVersionSwitch={(version) => {
                console.log('[ResumeEditorPage] onVersionSwitch wrapper called with:', version);
                return handleVersionSwitch(version);
              }}
              onVersionCreated={handleVersionCreated}
              showVersionManager={showVersionManager}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
