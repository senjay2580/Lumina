// 我的创作 - 主页面（不规则布局风格）
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { getCreationStats, type Creation } from '../lib/creations';
import ResumeListPage from './creations/ResumeListPage';
import ResumeEditorPage from './creations/ResumeEditorPage';
import JobApplicationsPage from './creations/JobApplicationsPage';
import CharacterGalleryPage from './creations/CharacterGalleryPage';
import HabitSchedulePage from './creations/HabitSchedulePage';
import IdeasPage from './creations/IdeasPage';

interface Props {
  userId?: string;
}

type ViewMode = 'home' | 'resume-list' | 'resume-editor' | 'job-applications' | 'character-gallery' | 'habit-schedule' | 'ideas';

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

  const handleBackFromApplications = () => {
    setViewMode('resume-list');
  };

  const handleOpenCharacterGallery = () => {
    setViewMode('character-gallery');
  };

  const handleBackFromCharacterGallery = () => {
    setViewMode('home');
  };

  const handleOpenHabitSchedule = () => {
    setViewMode('habit-schedule');
  };

  const handleBackFromHabitSchedule = () => {
    setViewMode('home');
  };

  const handleOpenIdeas = () => {
    setViewMode('ideas');
  };

  const handleBackFromIdeas = () => {
    setViewMode('home');
  };

  // 文章/想法视图
  if (viewMode === 'ideas' && userId) {
    return (
      <IdeasPage
        userId={userId}
        onBack={handleBackFromIdeas}
      />
    );
  }

  // 习惯纠正站视图
  if (viewMode === 'habit-schedule' && userId) {
    return (
      <HabitSchedulePage
        userId={userId}
        onBack={handleBackFromHabitSchedule}
      />
    );
  }

  // 语言/行为画廊视图
  if (viewMode === 'character-gallery' && userId) {
    return (
      <CharacterGalleryPage
        userId={userId}
        onBack={handleBackFromCharacterGallery}
      />
    );
  }

  // 投递记录视图
  if (viewMode === 'job-applications' && userId) {
    return (
      <JobApplicationsPage
        userId={userId}
        onBack={handleBackFromApplications}
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
              <p className="text-gray-500 text-sm mt-1">更好地管理你的创作</p>
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
              className="col-span-7 row-span-2 group relative overflow-hidden bg-white border-2 border-gray-900 p-8 text-gray-900 transition-all"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-6" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M8 4.5A1.25 1.25 0 1 0 8 2a1.25 1.25 0 0 0 0 2.5"/>
                  <path fill="currentColor" d="M8 4.5c.597 0 1.13.382 1.32.949l.087.26a.22.22 0 0 1-.21.291h-2.39a.222.222 0 0 1-.21-.291l.087-.26a1.39 1.39 0 0 1 1.32-.949zm-3 4a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m.5 1.5a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1z"/>
                  <path fill="currentColor" fillRule="evenodd" d="M2.33 1.64c-.327.642-.327 1.48-.327 3.16v6.4c0 1.68 0 2.52.327 3.16a3.02 3.02 0 0 0 1.31 1.31c.642.327 1.48.327 3.16.327h2.4c1.68 0 2.52 0 3.16-.327a3 3 0 0 0 1.31-1.31c.327-.642.327-1.48.327-3.16V4.8c0-1.68 0-2.52-.327-3.16A3 3 0 0 0 12.36.33C11.718.003 10.88.003 9.2.003H6.8c-1.68 0-2.52 0-3.16.327a3.02 3.02 0 0 0-1.31 1.31m6.87-.638H6.8c-.857 0-1.44 0-1.89.038c-.438.035-.663.1-.819.18a2 2 0 0 0-.874.874c-.08.156-.145.38-.18.819c-.037.45-.038 1.03-.038 1.89v6.4c0 .857.001 1.44.038 1.89c.036.438.101.663.18.819c.192.376.498.682.874.874c.156.08.381.145.819.18c.45.036 1.03.037 1.89.037h2.4c.857 0 1.44 0 1.89-.037c.438-.036.663-.101.819-.18c.376-.192.682-.498.874-.874c.08-.156.145-.381.18-.82c.037-.45.038-1.03.038-1.89v-6.4c0-.856-.001-1.44-.038-1.89c-.036-.437-.101-.662-.18-.818a2 2 0 0 0-.874-.874c-.156-.08-.381-.145-.819-.18c-.45-.037-1.03-.038-1.89-.038" clipRule="evenodd"/>
                </svg>
                <h3 className="text-4xl font-bold mb-2">简历</h3>
                <p className="text-gray-500 text-base mb-4">Resume</p>
                <p className="text-gray-600 text-sm max-w-md">展示职业成长轨迹，记录能力提升</p>
              </div>
            </motion.button>

            {/* 文章 - 中等卡片 (5列 x 2行) */}
            <motion.button
              onClick={handleOpenIdeas}
              className="col-span-5 row-span-2 group relative overflow-hidden bg-white border-2 border-gray-900 p-8 text-gray-900 transition-all"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 mb-6" viewBox="0 0 16 16">
                  <path fill="currentColor" d="m14.4 13l-.239 1.196a1 1 0 0 1-.98.804h-.362a1 1 0 0 1-.98-.804L11.599 13zM6 2c.788 0 1.499.331 2 .862A2.74 2.74 0 0 1 10 2h3.25c.966 0 1.75.784 1.75 1.75v1.786a4 4 0 0 0-1.5-.505V3.75a.25.25 0 0 0-.25-.25H10c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h.48l.3 1.5H10a2.74 2.74 0 0 1-2-.862A2.74 2.74 0 0 1 6 14H2.75A1.75 1.75 0 0 1 1 12.25v-8.5C1 2.784 1.784 2 2.75 2zM2.75 3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25H6c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25zM13 6a3 3 0 0 1 1.706 5.468L14.6 12h-3.2l-.106-.532A3 3 0 0 1 13 6"/>
                </svg>
                <h3 className="text-3xl font-bold mb-2">文章/想法</h3>
                <p className="text-gray-500 text-sm mb-3">Article/Idea</p>
                <p className="text-gray-600 text-sm">捕捉灵感火花，沉淀思考深度</p>
              </div>
            </motion.button>

            {/* 设计 - 中等卡片 (5列 x 1行) */}
            <motion.button
              className="col-span-5 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 transition-all"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 24 24">
                    <path fill="currentColor" d="m8.8 10.95l2.15-2.175l-1.4-1.425l-1.1 1.1l-1.4-1.4l1.075-1.1L7 4.825L4.825 7zm8.2 8.225L19.175 17l-1.125-1.125l-1.1 1.075l-1.4-1.4l1.075-1.1l-1.425-1.4l-2.15 2.15zm-.775-12.75l1.4 1.4l1.4-1.4L17.6 5zM7.25 21H3v-4.25l4.375-4.375L2 7l5-5l5.4 5.4l3.775-3.8q.3-.3.675-.45t.775-.15t.775.15t.675.45L20.4 4.95q.3.3.45.675T21 6.4t-.15.763t-.45.662l-3.775 3.8L22 17l-5 5l-5.375-5.375z"/>
                  </svg>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold mb-1">设计/展示</h3>
                    <p className="text-gray-500 text-sm">Design/Show</p>
                    <p className="text-gray-600 text-xs mt-1">视觉创意，作品呈现</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* 习惯纠正站 - 中等卡片 (4列 x 1行) */}
            <motion.button
              onClick={handleOpenHabitSchedule}
              className="col-span-4 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 transition-all"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="M12 3a6 6 0 0 0 9 9a9 9 0 1 1-9-9"/>
                      <path d="M12 12h.01M8 12h.01M16 12h.01"/>
                    </g>
                  </svg>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold mb-1">习惯纠正站</h3>
                    <p className="text-gray-500 text-sm">Habit Correction</p>
                    <p className="text-gray-600 text-xs mt-1">追踪行为模式，培养良好习惯</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* 文档 - 中等卡片 (3列 x 1行) */}
            <motion.button
              onClick={handleOpenCharacterGallery}
              className="col-span-3 row-span-1 group relative overflow-hidden bg-white border-2 border-gray-900 p-6 text-gray-900 transition-all"
              whileHover={{ 
                scale: 1.02,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3" viewBox="0 0 24 24">
                  <path fill="currentColor" fillRule="evenodd" d="m10.549 21.528l.25-.423c.4-.677.6-1.015.92-1.204s.736-.202 1.568-.229c.781-.025 1.306-.093 1.755-.279a3.86 3.86 0 0 0 2.086-2.086c.294-.709.294-1.607.294-3.403v-.772c0-2.524 0-3.786-.568-4.713a3.86 3.86 0 0 0-1.273-1.273c-.927-.568-2.19-.568-4.713-.568H8.554c-2.524 0-3.786 0-4.713.568A3.86 3.86 0 0 0 2.568 8.42C2 9.346 2 10.61 2 13.132v.771c0 1.797 0 2.695.293 3.404a3.86 3.86 0 0 0 2.087 2.086c.449.186.973.254 1.754.28c.833.026 1.25.039 1.569.228s.52.527.92 1.204l.25.423a.98.98 0 0 0 1.676 0m2.535-7.239a.964.964 0 1 0 0-1.928a.964.964 0 0 0 0 1.928m-2.41-.964a.964.964 0 1 1-1.927 0a.964.964 0 0 1 1.928 0m-4.337.964a.964.964 0 1 0 0-1.928a.964.964 0 0 0 0 1.928" clipRule="evenodd"/>
                  <path fill="currentColor" d="M15.17 2c1.151 0 2.067 0 2.802.07c.753.071 1.39.222 1.957.57a4.34 4.34 0 0 1 1.431 1.43c.348.567.498 1.204.57 1.957c.07.736.07 1.651.07 2.803v.787c0 .82 0 1.472-.036 2c-.037.541-.114 1.006-.294 1.44a4.34 4.34 0 0 1-2.428 2.38q-.191.074-.334.122c.014-.469.014-1.003.014-1.605v-.893c0-1.201 0-2.208-.078-3.026c-.082-.857-.259-1.66-.712-2.4a5.36 5.36 0 0 0-1.768-1.768c-.738-.452-1.542-.63-2.4-.711c-.817-.078-1.824-.078-3.026-.078H8.483c-.816 0-1.542 0-2.18.024c.03-.103.07-.22.118-.36q.12-.352.315-.67a4.34 4.34 0 0 1 1.431-1.433c.568-.347 1.205-.498 1.958-.57C10.859 2 11.775 2 12.927 2z"/>
                </svg>
                <h3 className="text-xl font-bold mb-1">语言/行为</h3>
                <p className="text-gray-500 text-xs mb-2">Language/Behavior</p>
                <p className="text-gray-600 text-xs">记录沟通表达，提升交流能力</p>
              </div>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
