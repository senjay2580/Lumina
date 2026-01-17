// 我的创作 - 主页面（不规则布局风格）
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { getCreationStats, type Creation } from '../lib/creations';
import ResumeListPage from './creations/ResumeListPage';
import ResumeEditorPage from './creations/ResumeEditorPage';
import JobApplicationsPage from './creations/JobApplicationsPage';

interface Props {
  userId?: string;
}

type ViewMode = 'home' | 'resume-list' | 'resume-editor' | 'job-applications';

export default function CreationsPage({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedResume, setSelectedResume] = useState<Creation | null>(null);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId]);

  const loadStats = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await getCreationStats(userId);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeClick = () => {
    setViewMode('resume-list');
  };

  const handleSelectResume = (creation: Creation) => {
    setSelectedResume(creation);
    setViewMode('resume-editor');
  };

  const handleOpenApplications = () => {
    setViewMode('job-applications');
  };

  const handleBackToList = () => {
    setSelectedResume(null);
    setViewMode('resume-list');
  };

  const handleBackToHome = () => {
    setSelectedResume(null);
    setViewMode('home');
  };

  // 投递记录视图
  if (viewMode === 'job-applications' && userId) {
    return (
      <JobApplicationsPage
        userId={userId}
        onBack={handleBackToHome}
      />
    );
  }

  // 简历编辑器视图
  if (viewMode === 'resume-editor' && selectedResume && userId) {
    return (
      <ResumeEditorPage
        creation={selectedResume}
        userId={userId}
        onBack={handleBackToList}
      />
    );
  }

  // 简历列表视图
  if (viewMode === 'resume-list' && userId) {
    return (
      <ResumeListPage
        userId={userId}
        onSelectResume={handleSelectResume}
        onOpenApplications={handleOpenApplications}
        onBack={handleBackToHome}
      />
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        {/* 头部 */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <img 
              src="/icons/database-stack.svg" 
              alt="我的创作" 
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">我的创作</h1>
              <p className="text-gray-500 text-sm mt-1">多版本管理，轻松对比</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          /* 不规则网格布局 - 简约风格 */
          <div className="grid grid-cols-12 gap-6 auto-rows-[180px]">
            {/* 简历 - 超大卡片 (占据 7列 x 2行) */}
            <motion.button
              onClick={handleResumeClick}
              className="col-span-7 row-span-2 group relative overflow-hidden bg-white border-2 border-gray-900 p-8 text-gray-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all"
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg className="w-16 h-16 mb-6 stroke-gray-900" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                  <path d="M16 7h.01M16 3h4v4M8 21H4v-4M8 7V3h4M16 17v4h-4M8 17h.01" />
                  <rect x="8" y="7" width="8" height="10" rx="1" />
                </svg>
                <h3 className="text-4xl font-bold mb-2">简历</h3>
                <p className="text-gray-500 text-base mb-4">Resume</p>
                <p className="text-gray-600 text-sm max-w-md">展示职业成长轨迹，记录能力提升</p>
                
                {/* 箭头按钮 - 右下角 */}
                <div className="absolute bottom-8 right-8">
                  <div className="w-12 h-12 border-2 border-gray-900 bg-white flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                    <ArrowRight className="w-6 h-6 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </motion.button>

            {/* 文章 - 中等卡片 (5列 x 2行) */}
            <motion.button
              className="col-span-5 row-span-2 group relative overflow-hidden bg-white border-2 border-gray-900 p-8 text-gray-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all"
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg className="w-14 h-14 mb-6 stroke-gray-900" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <h3 className="text-3xl font-bold mb-2">文章/想法</h3>
                <p className="text-gray-500 text-sm mb-3">Article/Idea</p>
                <p className="text-gray-600 text-sm">捕捉灵感火花，沉淀思考深度</p>
                
                {/* 箭头按钮 - 右下角 */}
                <div className="absolute bottom-8 right-8">
                  <div className="w-12 h-12 border-2 border-gray-900 bg-white flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                    <ArrowRight className="w-6 h-6 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </motion.button>

            {/* 设计 - 中等卡片 (5列 x 1行) */}
            <motion.button
              className="col-span-5 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <svg className="w-12 h-12 stroke-gray-900" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold mb-1">设计/展示</h3>
                    <p className="text-gray-500 text-sm">Design/Show</p>
                    <p className="text-gray-600 text-xs mt-1">视觉创意，作品呈现</p>
                  </div>
                </div>
                <div className="w-12 h-12 border-2 border-gray-900 bg-white flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                  <ArrowRight className="w-6 h-6 group-hover:text-white transition-colors" />
                </div>
              </div>
            </motion.button>

            {/* 代码 - 中等卡片 (4列 x 1行) */}
            <motion.button
              className="col-span-4 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <svg className="w-12 h-12 stroke-gray-900" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold mb-1">算法/流程图</h3>
                    <p className="text-gray-500 text-sm">Algorithm/Flow</p>
                    <p className="text-gray-600 text-xs mt-1">展示策略迭代过程，思维进化</p>
                  </div>
                </div>
                <div className="w-12 h-12 border-2 border-gray-900 bg-white flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                  <ArrowRight className="w-6 h-6 group-hover:text-white transition-colors" />
                </div>
              </div>
            </motion.button>

            {/* 文档 - 中等卡片 (3列 x 1行) */}
            <motion.button
              className="col-span-3 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg className="w-10 h-10 mb-3 stroke-gray-900" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <h3 className="text-xl font-bold mb-1">我的日记</h3>
                <p className="text-gray-500 text-xs mb-2">My Diary</p>
                <p className="text-gray-600 text-xs">记录生活点滴，见证成长</p>
                
                {/* 箭头按钮 - 右下角 */}
                <div className="absolute bottom-6 right-6">
                  <div className="w-10 h-10 border-2 border-gray-900 bg-white flex items-center justify-center group-hover:bg-gray-900 transition-colors">
                    <ArrowRight className="w-5 h-5 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
