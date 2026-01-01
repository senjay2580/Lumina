import React, { useState, useEffect } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import { getStoredUser } from '../lib/auth';
import * as workflowApi from '../lib/workflows';
import { ViewType } from './Sidebar';
import { ContextMenu, useContextMenu, useToast, ToastContainer, Confirm } from '../shared';

interface HomePageProps {
  username: string;
  onNavigate: (view: ViewType) => void;
  onOpenWorkflow?: (workflowId: string) => void;
}

interface Stats {
  workflows: number;
  prompts: number;
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  nodes: any[];
}

interface ActivityData {
  date: string;
  count: number;
}

// 生成空的活动数据（用于没有数据时显示）
const generateEmptyData = () => {
  const data = [];
  const today = new Date();
  // 从今天往前推约5个月
  for (let i = 150; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      count: 0,
      level: 0
    });
  }
  return data;
};

// 获取本地日期字符串 (YYYY-MM-DD)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 补全活动数据（确保数据连续到今天）
const fillActivityData = (rawData: ActivityData[]) => {
  const today = new Date();
  const dataMap = new Map<string, number>();
  
  // 先把原始数据放入 map
  rawData.forEach(d => {
    dataMap.set(d.date, d.count);
  });
  
  // 生成完整的日期范围（使用本地时间）
  // 从今天往前推 150 天
  const result = [];
  for (let i = 150; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dateStr = getLocalDateString(date);
    const count = dataMap.get(dateStr) || 0;
    result.push({
      date: dateStr,
      count,
      level: count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4
    });
  }
  
  // 调试：打印最后几个日期
  console.log('热力图日期范围:', result[0]?.date, '到', result[result.length - 1]?.date);
  
  return result;
};

export const HomePage: React.FC<HomePageProps> = ({ username, onNavigate, onOpenWorkflow }) => {
  const user = getStoredUser();
  const [stats, setStats] = useState<Stats>({ workflows: 0, prompts: 0 });
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const contextMenu = useContextMenu();
  const { toasts, removeToast, success, error } = useToast();

  const loadData = async () => {
    if (!user?.id) return;
    try {
      const [statsData, workflowsData, activity] = await Promise.all([
        workflowApi.getStats(user.id),
        workflowApi.getWorkflows(user.id),
        workflowApi.getWorkflowActivity(user.id)
      ]);
      setStats({ workflows: statsData.workflows, prompts: statsData.prompts });
      setWorkflows(workflowsData);
      setActivityData(activity);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await workflowApi.deleteWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      setStats(prev => ({ ...prev, workflows: prev.workflows - 1 }));
      success('工作流已删除');
    } catch (err) {
      error('删除失败');
    }
    setDeleteConfirm({ open: false, id: null });
  };

  const handleOpenWorkflow = (id: string) => {
    if (onOpenWorkflow) {
      onOpenWorkflow(id);
    } else {
      onNavigate('WORKFLOW');
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    if (diffWeeks < 4) return `${diffWeeks} 周前`;
    if (diffMonths < 12) return `${diffMonths} 个月前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="w-full h-full overflow-y-auto" style={{ fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* 删除确认框 */}
      <Confirm
        isOpen={deleteConfirm.open}
        title="删除工作流"
        message="确定要删除这个工作流吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={() => deleteConfirm.id && handleDeleteWorkflow(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
      
      <svg className="hidden">
        <defs>
          <symbol id="icon-workflow" viewBox="0 0 24 24">
            <path fill="currentColor" d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
          </symbol>
          <symbol id="icon-prompt" viewBox="0 0 14 14">
            <g fill="none" fillRule="evenodd" clipRule="evenodd">
              <path fill="#8fbffa" d="M6.035 2.507c-.653 1.073-.204 2.73 1.344 3c.545.095.978.51 1.096 1.05l.02.092c.454 2.073 3.407 2.086 3.878.017l.025-.108a1 1 0 0 1 .04-.139v5.791c0 .941-.764 1.704-1.705 1.704H1.734A1.704 1.704 0 0 1 .03 12.21V4.211c0-.941.763-1.704 1.704-1.704h4.3Z"/>
              <path fill="#2859c5" d="M3.08 7.797a.625.625 0 1 0-.883.884L3.255 9.74l-1.058 1.058a.625.625 0 0 0 .884.884l1.5-1.5a.625.625 0 0 0 0-.884l-1.5-1.5Zm2.559 2.817a.625.625 0 1 0 0 1.25h1.5a.625.625 0 0 0 0-1.25zm.396-8.107c-.653 1.073-.204 2.73 1.344 3c.318.055.598.22.8.454H.028V4.21c0-.941.764-1.704 1.705-1.704h4.3ZM11.233.721C11.04-.13 9.825-.125 9.638.728l-.007.035l-.015.068A2.53 2.53 0 0 1 7.58 2.772c-.887.154-.887 1.428 0 1.582a2.53 2.53 0 0 1 2.038 1.952l.02.093c.187.852 1.401.858 1.595.007l.025-.108a2.55 2.55 0 0 1 2.046-1.942c.889-.155.889-1.43 0-1.585A2.55 2.55 0 0 1 11.26.844l-.018-.082l-.01-.041Z"/>
            </g>
          </symbol>
        </defs>
      </svg>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Hero 区域 - 带神经网络背景 */}
        <section className="mb-20 relative">
          {/* 神经网络背景 */}
          <div className="absolute inset-0 -top-12 -left-8 -right-8 h-[320px] overflow-hidden opacity-40 pointer-events-none">
            <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 320">
              <defs>
                <linearGradient id="neuralGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF6B00" stopOpacity="0" />
                  <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="neuralGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
                  <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="neuralGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                  <stop offset="50%" stopColor="#10B981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* 多层交错曲线 */}
              <path d="M0,160 Q150,60 300,160 T600,160 T900,160 T1200,160" fill="none" stroke="url(#neuralGrad1)" strokeWidth="2" strokeDasharray="8 4">
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="3s" repeatCount="indefinite" />
              </path>
              <path d="M0,120 Q200,200 400,120 T800,120 T1200,120" fill="none" stroke="url(#neuralGrad2)" strokeWidth="1.5" strokeDasharray="6 3">
                <animate attributeName="stroke-dashoffset" from="0" to="18" dur="4s" repeatCount="indefinite" />
              </path>
              <path d="M0,200 Q100,100 200,200 T400,200 T600,200 T800,200 T1000,200 T1200,200" fill="none" stroke="url(#neuralGrad3)" strokeWidth="1.5" strokeDasharray="5 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="2.5s" repeatCount="indefinite" />
              </path>
              <path d="M0,240 Q300,140 600,240 T1200,240" fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="4 4" opacity="0.3">
                <animate attributeName="stroke-dashoffset" from="0" to="16" dur="5s" repeatCount="indefinite" />
              </path>
              <path d="M0,80 Q250,180 500,80 T1000,80 T1200,80" fill="none" stroke="#EC4899" strokeWidth="1" strokeDasharray="4 4" opacity="0.25">
                <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="4.5s" repeatCount="indefinite" />
              </path>
              
              {/* 神经节点 */}
              <circle cx="150" cy="160" r="5" fill="#FF6B00" opacity="0.4"><animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" /></circle>
              <circle cx="300" cy="120" r="4" fill="#3B82F6" opacity="0.35"><animate attributeName="r" values="4;6;4" dur="2.5s" repeatCount="indefinite" /></circle>
              <circle cx="450" cy="200" r="5" fill="#10B981" opacity="0.4"><animate attributeName="r" values="5;8;5" dur="1.8s" repeatCount="indefinite" /></circle>
              <circle cx="600" cy="160" r="6" fill="#FF6B00" opacity="0.35"><animate attributeName="r" values="6;9;6" dur="3s" repeatCount="indefinite" /></circle>
              <circle cx="750" cy="120" r="4" fill="#8B5CF6" opacity="0.3"><animate attributeName="r" values="4;6;4" dur="2.2s" repeatCount="indefinite" /></circle>
              <circle cx="900" cy="200" r="5" fill="#EC4899" opacity="0.35"><animate attributeName="r" values="5;8;5" dur="2.8s" repeatCount="indefinite" /></circle>
              <circle cx="1050" cy="160" r="4" fill="#3B82F6" opacity="0.3"><animate attributeName="r" values="4;6;4" dur="2.4s" repeatCount="indefinite" /></circle>
            </svg>
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="max-w-2xl">
              <h1 className="text-6xl font-black text-gray-900 mb-6 tracking-tighter leading-tight uppercase">
                欢迎回来，<br/><span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">{username}</span>
              </h1>
              <p className="text-xl text-gray-400 font-medium tracking-wide mb-8">构建智能工作流，释放 AI 潜能</p>
              <button onClick={() => onNavigate('WORKFLOW')} 
                className="px-8 py-4 bg-primary text-white text-lg font-medium rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                创建工作流
              </button>
            </div>

            {/* 流水线 SVG - 清晰线条 */}
            <div className="relative w-[520px] h-[340px]">
              <svg viewBox="0 0 420 280" className="w-full h-full">
                <defs>
                  <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                
                <path d="M 20 140 L 70 140 L 100 70 L 160 70 L 190 140 L 240 140 L 270 70 L 330 70 L 360 140 L 400 140" fill="none" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 190 140 L 220 200 L 250 200" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 20 140 L 70 140 L 100 70 L 160 70 L 190 140 L 240 140 L 270 70 L 330 70 L 360 140 L 400 140" fill="none" stroke="#FF6B00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30 370" strokeDashoffset="0">
                  <animate attributeName="stroke-dashoffset" from="400" to="0" dur="2.5s" repeatCount="indefinite" />
                </path>

                <g><rect x="5" y="125" width="30" height="30" rx="6" fill="white" stroke="#10B981" strokeWidth="2" /><polygon points="15,133 15,147 25,140" fill="#10B981" /></g>
                <g><rect x="145" y="55" width="30" height="30" rx="6" fill="white" stroke="#3B82F6" strokeWidth="2" /><circle cx="160" cy="70" r="6" fill="none" stroke="#3B82F6" strokeWidth="2" /><circle cx="160" cy="70" r="2" fill="#3B82F6" /></g>
                <g><rect x="225" y="125" width="30" height="30" rx="6" fill="white" stroke="#8B5CF6" strokeWidth="2" /><polygon points="243,132 236,142 241,142 237,150 244,140 239,140 243,132" fill="#8B5CF6" /></g>
                <g><rect x="315" y="55" width="30" height="30" rx="6" fill="white" stroke="#F59E0B" strokeWidth="2" /><ellipse cx="330" cy="65" rx="8" ry="3" fill="none" stroke="#F59E0B" strokeWidth="1.5" /><path d="M322 65 L322 77 Q330 82 338 77 L338 65" fill="none" stroke="#F59E0B" strokeWidth="1.5" /><ellipse cx="330" cy="71" rx="8" ry="3" fill="none" stroke="#F59E0B" strokeWidth="1.5" /></g>
                <g><rect x="385" y="125" width="30" height="30" rx="6" fill="white" stroke="#FF6B00" strokeWidth="2" /><path d="M395 140 L400 135 L405 140 M400 135 L400 148" fill="none" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" /><path d="M393 145 L393 150 L407 150 L407 145" fill="none" stroke="#FF6B00" strokeWidth="1.5" /></g>
                <g><rect x="235" y="185" width="30" height="30" rx="6" fill="white" stroke="#EC4899" strokeWidth="2" /><path d="M243 193 L243 207 L257 207 L257 196 L253 193 Z" fill="none" stroke="#EC4899" strokeWidth="1.5" /><path d="M243 196 L253 196" stroke="#EC4899" strokeWidth="1.5" /></g>

                <circle r="4" fill="#FF6B00"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 20 140 L 70 140 L 100 70 L 160 70 L 190 140 L 240 140 L 270 70 L 330 70 L 360 140 L 400 140" /></circle>
                <circle r="3" fill="#3B82F6" opacity="0.8"><animateMotion dur="2.5s" repeatCount="indefinite" begin="0.6s" path="M 20 140 L 70 140 L 100 70 L 160 70 L 190 140 L 240 140 L 270 70 L 330 70 L 360 140 L 400 140" /></circle>
                <circle r="3" fill="#10B981" opacity="0.8"><animateMotion dur="2.5s" repeatCount="indefinite" begin="1.2s" path="M 20 140 L 70 140 L 100 70 L 160 70 L 190 140 L 240 140 L 270 70 L 330 70 L 360 140 L 400 140" /></circle>
                <circle r="2.5" fill="#EC4899" opacity="0.7"><animateMotion dur="1.5s" repeatCount="indefinite" begin="0.8s" path="M 190 140 L 220 200 L 250 200" /></circle>

                <circle cx="70" cy="140" r="3" fill="#E5E7EB" />
                <circle cx="190" cy="140" r="3" fill="#E5E7EB" />
                <circle cx="240" cy="140" r="3" fill="#E5E7EB" />
                <circle cx="360" cy="140" r="3" fill="#E5E7EB" />
              </svg>
            </div>
          </div>
        </section>

        {/* 统计卡片 + 热力图 */}
        <section className="mb-16">
          <div className="flex gap-6">
            {/* 左侧：纵向统计卡片 */}
            <div className="flex flex-col gap-4 w-48 shrink-0">
              <div className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex-1 flex items-center">
                <div className="flex items-center gap-3">
                  <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
                  </svg>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{loading ? '-' : stats.workflows}</p>
                    <p className="text-xs text-gray-500">工作流</p>
                  </div>
                </div>
              </div>
              <div className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex-1 flex items-center">
                <div className="flex items-center gap-3">
                  <svg className="w-10 h-10" viewBox="0 0 14 14">
                    <g fill="none" fillRule="evenodd" clipRule="evenodd">
                      <path fill="#8fbffa" d="M6.035 2.507c-.653 1.073-.204 2.73 1.344 3c.545.095.978.51 1.096 1.05l.02.092c.454 2.073 3.407 2.086 3.878.017l.025-.108a1 1 0 0 1 .04-.139v5.791c0 .941-.764 1.704-1.705 1.704H1.734A1.704 1.704 0 0 1 .03 12.21V4.211c0-.941.763-1.704 1.704-1.704h4.3Z"/>
                      <path fill="#2859c5" d="M3.08 7.797a.625.625 0 1 0-.883.884L3.255 9.74l-1.058 1.058a.625.625 0 0 0 .884.884l1.5-1.5a.625.625 0 0 0 0-.884l-1.5-1.5Zm2.559 2.817a.625.625 0 1 0 0 1.25h1.5a.625.625 0 0 0 0-1.25zm.396-8.107c-.653 1.073-.204 2.73 1.344 3c.318.055.598.22.8.454H.028V4.21c0-.941.764-1.704 1.705-1.704h4.3ZM11.233.721C11.04-.13 9.825-.125 9.638.728l-.007.035l-.015.068A2.53 2.53 0 0 1 7.58 2.772c-.887.154-.887 1.428 0 1.582a2.53 2.53 0 0 1 2.038 1.952l.02.093c.187.852 1.401.858 1.595.007l.025-.108a2.55 2.55 0 0 1 2.046-1.942c.889-.155.889-1.43 0-1.585A2.55 2.55 0 0 1 11.26.844l-.018-.082l-.01-.041Z"/>
                    </g>
                  </svg>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{loading ? '-' : stats.prompts}</p>
                    <p className="text-xs text-gray-500">提示词</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧：热力图 */}
            <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">工作流活跃度</h3>
                <span className="text-xs text-gray-400">
                  {new Date().getFullYear()} 年
                </span>
              </div>
              <div className="[&>div>footer]:hidden">
                <ActivityCalendar
                  data={fillActivityData(activityData)}
                  theme={{
                    light: ['#f0f0f0', '#ffedd5', '#fdba74', '#f97316', '#ea580c'],
                  }}
                  colorScheme="light"
                  blockSize={12}
                  blockMargin={3}
                  blockRadius={2}
                  fontSize={11}
                  showWeekdayLabels={true}
                  weekStart={1}
                  labels={{
                    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
                    totalCount: '{{count}} 次活动',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 工作流列表 - 卡片样式 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">我的工作流</h2>
            <button onClick={() => onNavigate('WORKFLOW')} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              新建
            </button>
          </div>
          {loading ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : workflows.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              <p className="text-gray-500 mb-2">暂无工作流</p>
              <p className="text-gray-400 text-sm mb-6">创建你的第一个 AI 工作流</p>
              <button onClick={() => onNavigate('WORKFLOW')} className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:shadow-lg transition-all">立即创建</button>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map(workflow => (
                <div 
                  key={workflow.id} 
                  onClick={() => handleOpenWorkflow(workflow.id)}
                  onContextMenu={(e) => contextMenu.open(e, workflow.id)}
                  className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg hover:border-gray-200 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg className="w-6 h-6 text-blue-500"><use href="#icon-workflow" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">{workflow.name}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>{workflow.nodes?.length || 0} 个节点</span>
                          <span>·</span>
                          <span>{formatRelativeTime(workflow.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); contextMenu.open(e, workflow.id); }}
                      className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 底部统计 */}
          {!loading && workflows.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              共 {workflows.length} 个工作流
            </div>
          )}
        </section>
      </div>

      {/* 右键菜单 */}
      {contextMenu.isOpen && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={contextMenu.close}
          items={[
            { 
              label: '打开', 
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>, 
              onClick: () => handleOpenWorkflow(contextMenu.data) 
            },
            { 
              label: '复制', 
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>, 
              onClick: async () => {
                const workflow = workflows.find(w => w.id === contextMenu.data);
                if (workflow && user?.id) {
                  try {
                    await workflowApi.createWorkflow(user.id, { 
                      name: workflow.name + ' (副本)', 
                      description: workflow.description || undefined,
                      nodes: workflow.nodes 
                    });
                    loadData();
                    success('工作流已复制');
                  } catch { error('复制失败'); }
                }
              }
            },
            { divider: true, label: '', onClick: () => {} },
            { 
              label: '删除', 
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, 
              danger: true, 
              onClick: () => setDeleteConfirm({ open: true, id: contextMenu.data })
            }
          ]}
        />
      )}
    </div>
  );
};