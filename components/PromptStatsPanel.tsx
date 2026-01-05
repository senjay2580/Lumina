// 提示词数据统计面板
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  TrendingUp,
  Copy,
  FileText,
  Calendar,
  Award,
  PieChart,
  Activity
} from 'lucide-react';
import {
  getPromptStats,
  getCategoryStats,
  getDailyCopyStats,
  getPopularPrompts,
  type PromptStats,
  type CategoryStats,
  type DailyCopyStats,
  type Prompt
} from '../lib/prompts';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface PromptStatsPanelProps {
  userId: string;
}

export const PromptStatsPanel: React.FC<PromptStatsPanelProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PromptStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyCopyStats[]>([]);
  const [popularPrompts, setPopularPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, catStats, daily, popular] = await Promise.all([
        getPromptStats(userId),
        getCategoryStats(userId),
        getDailyCopyStats(userId, 30),
        getPopularPrompts(userId, 5)
      ]);
      setStats(statsData);
      setCategoryStats(catStats);
      setDailyStats(daily);
      setPopularPrompts(popular);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner text="加载统计数据..." />;
  }

  // 计算图表数据
  const maxCopies = Math.max(...dailyStats.map(d => d.copyCount), 1);
  const totalCategoryPrompts = categoryStats.reduce((sum, c) => sum + c.promptCount, 0);

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="提示词总数"
          value={stats?.totalPrompts || 0}
          color="blue"
        />
        <StatCard
          icon={<Copy className="w-5 h-5" />}
          label="总复制次数"
          value={stats?.totalCopies || 0}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="本周新增"
          value={stats?.promptsThisWeek || 0}
          color="purple"
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          label="最高复制"
          value={stats?.maxCopies || 0}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 复制趋势图 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900">复制趋势（近30天）</h3>
          </div>
          
          {dailyStats.length > 0 ? (
            <div className="h-48">
              <div className="flex items-end justify-between h-full gap-1">
                {/* 填充空白日期 */}
                {Array.from({ length: 30 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (29 - i));
                  const dateStr = date.toISOString().split('T')[0];
                  const dayData = dailyStats.find(d => d.date === dateStr);
                  const count = dayData?.copyCount || 0;
                  const height = maxCopies > 0 ? (count / maxCopies) * 100 : 0;
                  
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end group"
                    >
                      <div className="relative w-full">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(height, 2)}%` }}
                          transition={{ duration: 0.5, delay: i * 0.02 }}
                          className={`w-full rounded-t transition-colors ${
                            count > 0 ? 'bg-blue-400 hover:bg-blue-500' : 'bg-gray-100'
                          }`}
                          style={{ minHeight: '4px' }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {date.getMonth() + 1}/{date.getDate()}: {count} 次
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>30天前</span>
                <span>今天</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              暂无复制记录
            </div>
          )}
        </div>

        {/* 分类分布 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900">分类分布</h3>
          </div>
          
          {categoryStats.length > 0 ? (
            <div className="space-y-3">
              {categoryStats.map((cat, index) => {
                const percentage = totalCategoryPrompts > 0 
                  ? (cat.promptCount / totalCategoryPrompts) * 100 
                  : 0;
                const colors = getCategoryBarColor(cat.categoryColor);
                
                return (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{cat.categoryName}</span>
                      <span className="text-gray-500">
                        {cat.promptCount} 个 · {cat.totalCopies} 次复制
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`h-full rounded-full ${colors}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              暂无分类数据
            </div>
          )}
        </div>
      </div>

      {/* 热门提示词 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">热门提示词 TOP 5</h3>
        </div>
        
        {popularPrompts.length > 0 ? (
          <div className="space-y-3">
            {popularPrompts.map((prompt, index) => {
              const maxCount = popularPrompts[0]?.copy_count || 1;
              const percentage = (prompt.copy_count || 0) / maxCount * 100;
              
              return (
                <div key={prompt.id} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-100 text-amber-600' :
                    index === 1 ? 'bg-gray-100 text-gray-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {prompt.title}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center gap-1 flex-shrink-0">
                        <Copy className="w-3 h-3" />
                        {prompt.copy_count || 0}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400">
            暂无使用记录，复制提示词后会显示统计
          </div>
        )}
      </div>

      {/* 使用提示 */}
      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm text-blue-800 font-medium">数据说明</p>
          <p className="text-sm text-blue-600 mt-1">
            复制次数会在你复制提示词内容时自动记录，帮助你了解哪些提示词最常用。
          </p>
        </div>
      </div>
    </div>
  );
};

// 统计卡片组件
function StatCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'amber';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// 获取分类颜色对应的进度条颜色
function getCategoryBarColor(color: string): string {
  const colors: Record<string, string> = {
    orange: 'bg-orange-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    purple: 'bg-purple-400',
    red: 'bg-red-400',
    pink: 'bg-pink-400',
    yellow: 'bg-yellow-400',
    gray: 'bg-gray-400'
  };
  return colors[color] || colors.gray;
}

export default PromptStatsPanel;
