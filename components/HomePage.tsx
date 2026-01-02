import React, { useState, useEffect } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import { motion } from 'motion/react';
import { getStoredUser } from '../lib/auth';
import * as workflowApi from '../lib/workflows';
import { ViewType } from './Sidebar';
import { ContextMenu, useContextMenu, useToast, ToastContainer, Confirm } from '../shared';

// 工作流节点组件 - 带发光效果
const WorkflowNode: React.FC<{
  x: number;
  y: number;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  label?: string;
  delay?: number;
  glowColor?: string;
}> = ({ x, y, bgColor, borderColor, icon, label, delay = 0, glowColor }) => (
  <motion.g
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay, type: "spring", stiffness: 200, damping: 20 }}
  >
    <motion.g
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }}
    >
      {/* 发光光晕 */}
      <motion.rect
        x={x - 4}
        y={y - 4}
        width={60}
        height={60}
        rx={16}
        fill={glowColor || borderColor}
        opacity={0}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: delay + 1 }}
        filter="url(#nodeGlow)"
      />
      {/* 节点背景 */}
      <rect
        x={x}
        y={y}
        width={52}
        height={52}
        rx={12}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={2}
        filter="url(#nodeShadow)"
      />
      {/* 节点图标 */}
      <g transform={`translate(${x + 26}, ${y + 26})`}>
        {icon}
      </g>
      {/* 标签 */}
      {label && (
        <text 
          x={x + 26} 
          y={y + 70} 
          textAnchor="middle" 
          fontSize="12" 
          fontWeight="500" 
          fill="#6B7280"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {label}
        </text>
      )}
    </motion.g>
  </motion.g>
);

// 渐变连接线组件 - 带流光效果
const GradientLine: React.FC<{
  path: string;
  gradientId: string;
  delay?: number;
}> = ({ path, gradientId, delay = 0 }) => (
  <g>
    {/* 底层光晕 - 呼吸效果 */}
    <motion.path
      d={path}
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth={8}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: [0.1, 0.25, 0.1] }}
      transition={{ 
        pathLength: { duration: 1.2, delay, ease: "easeInOut" },
        opacity: { duration: 2, delay: delay + 1, repeat: Infinity, ease: "easeInOut" }
      }}
    />
    {/* 主线条 */}
    <motion.path
      d={path}
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth={2.5}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 1.2, delay, ease: "easeInOut" }}
    />
    {/* 流光效果 */}
    <motion.path
      d={path}
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      initial={{ pathLength: 0, pathOffset: 0 }}
      animate={{ pathLength: 0.15, pathOffset: 1 }}
      transition={{ duration: 2, delay: delay + 0.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
      opacity={0.6}
    />
  </g>
);



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

  const handleDeleteWorkflow = async (id: string, permanent: boolean = false) => {
    try {
      if (permanent) {
        await workflowApi.permanentDeleteWorkflow(id);
        success('工作流已永久删除');
      } else {
        await workflowApi.deleteWorkflow(id);
        success('工作流已移到回收站');
      }
      setWorkflows(prev => prev.filter(w => w.id !== id));
      setStats(prev => ({ ...prev, workflows: prev.workflows - 1 }));
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
        message="选择删除方式"
        cancelText="取消"
        showPermanentDelete
        onConfirm={(permanent) => deleteConfirm.id && handleDeleteWorkflow(deleteConfirm.id, permanent)}
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

      <div className="max-w-6xl mx-auto px-8 pt-20 pb-12">
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

            {/* 工作流 SVG */}
            <div className="relative w-[580px] h-[260px] mt-8">
              <svg viewBox="0 0 560 260" className="w-full h-full overflow-visible">
                <defs>
                  {/* 节点阴影 */}
                  <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.06" />
                  </filter>
                  {/* 节点发光效果 */}
                  <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                    </feMerge>
                  </filter>
                  {/* 渐变色 - 绿到蓝 */}
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6EE7B7" />
                    <stop offset="100%" stopColor="#93C5FD" />
                  </linearGradient>
                  {/* 渐变色 - 绿到青 */}
                  <linearGradient id="grad1b" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6EE7B7" />
                    <stop offset="100%" stopColor="#7DD3FC" />
                  </linearGradient>
                  {/* 渐变色 - 蓝到紫 */}
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#93C5FD" />
                    <stop offset="100%" stopColor="#C4B5FD" />
                  </linearGradient>
                  {/* 渐变色 - 青到紫 */}
                  <linearGradient id="grad2b" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7DD3FC" />
                    <stop offset="100%" stopColor="#C4B5FD" />
                  </linearGradient>
                  {/* 渐变色 - 紫到橙 */}
                  <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C4B5FD" />
                    <stop offset="100%" stopColor="#FDBA74" />
                  </linearGradient>
                </defs>
                
                {/* 连接线 - 开始到Cloud (上分支) */}
                <GradientLine 
                  path="M 72 130 C 95 130, 105 55, 140 55"
                  gradientId="grad1"
                  delay={0}
                />
                {/* 连接线 - 开始到Database (下分支) */}
                <GradientLine 
                  path="M 72 130 C 95 130, 105 185, 140 185"
                  gradientId="grad1b"
                  delay={0.1}
                />
                {/* 连接线 - Cloud到AI Process */}
                <GradientLine 
                  path="M 192 55 C 240 55, 270 120, 310 120"
                  gradientId="grad2"
                  delay={0.3}
                />
                {/* 连接线 - Database到AI Process */}
                <GradientLine 
                  path="M 192 185 C 240 185, 270 120, 310 120"
                  gradientId="grad2b"
                  delay={0.35}
                />
                {/* 连接线 - AI Process到Publish */}
                <GradientLine 
                  path="M 362 120 C 390 120, 420 120, 448 120"
                  gradientId="grad3"
                  delay={0.6}
                />
                
                {/* WiFi 信号波效果 - 向右发射 */}
                <g transform="translate(405, 120)">
                  {/* 第一层信号波 - 最内层 */}
                  <motion.path
                    d="M 0 -8 Q 10 0, 0 8"
                    fill="none"
                    stroke="#C4B5FD"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: [0, 0.7, 0], x: 0 }}
                    transition={{ duration: 1.2, delay: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                  {/* 第二层信号波 */}
                  <motion.path
                    d="M 8 -14 Q 22 0, 8 14"
                    fill="none"
                    stroke="#DDD6FE"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: [0, 0.5, 0], x: 0 }}
                    transition={{ duration: 1.2, delay: 1.0, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                  {/* 第三层信号波 - 最外层 */}
                  <motion.path
                    d="M 16 -20 Q 34 0, 16 20"
                    fill="none"
                    stroke="#FDBA74"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: [0, 0.35, 0], x: 0 }}
                    transition={{ duration: 1.2, delay: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                </g>
                
                {/* 汇聚连接点 */}
                <motion.circle cx="310" cy="120" r="4" fill="#C4B5FD"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                />
                
                {/* 节点1: 播放/触发器 - 绿色 */}
                <WorkflowNode
                  x={20}
                  y={104}
                  bgColor="#D1FAE5"
                  borderColor="#6EE7B7"
                  glowColor="#10B981"
                  delay={0.2}
                  icon={
                    <polygon points="-10,-12 -10,12 12,0" fill="#10B981" />
                  }
                />
                
                {/* 节点2a: Cloud - 蓝色 (上分支) */}
                <WorkflowNode
                  x={140}
                  y={29}
                  bgColor="#DBEAFE"
                  borderColor="#93C5FD"
                  glowColor="#3B82F6"
                  delay={0.3}
                  label="Cloud"
                  icon={
                    <g transform="scale(1.1)">
                      <path d="M7.35 -1.96A7.49 7.49 0 0 0 0 -8C-2.89 -8 -5.4 -6.36 -6.65 -3.96A5.994 5.994 0 0 0 -12 2c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5c0-2.64-2.05-4.78-4.65-4.96M7 6H-6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C-4.63 -4.31 -2.52 -6 0 -6c3.04 0 5.5 2.46 5.5 5.5v.5H7c1.66 0 3 1.34 3 3s-1.34 3-3 3" fill="#3B82F6" />
                    </g>
                  }
                />

                {/* 节点2b: Database - 青色 (下分支) */}
                <WorkflowNode
                  x={140}
                  y={159}
                  bgColor="#E0F2FE"
                  borderColor="#7DD3FC"
                  glowColor="#0EA5E9"
                  delay={0.35}
                  label="Database"
                  icon={
                    <g transform="scale(1.05)">
                      <path d="M0 -1q3.75 0 6.375-1.175T9 -5t-2.625-2.825T0 -9T-6.375 -7.825T-9 -5t2.625 2.825T0 -1m0 2.5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T9 -2.5V0q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T0 4t-2.562-.213t-2.963-.687t-2.45-1.237T-9 0V-2.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T0 1.5m0 5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T9 2.5V5q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T0 9t-2.562-.213t-2.963-.687t-2.45-1.237T-9 5v-2.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T0 6.5" fill="#0EA5E9" />
                    </g>
                  }
                />
                
                {/* 节点3: AI Process - 紫色 */}
                <WorkflowNode
                  x={310}
                  y={94}
                  bgColor="#EDE9FE"
                  borderColor="#C4B5FD"
                  glowColor="#8B5CF6"
                  delay={0.5}
                  label="AI Process"
                  icon={
                    <path d="M 3 -14 L -10 3 L 0 3 L -3 14 L 10 -3 L 0 -3 Z" fill="#8B5CF6" />
                  }
                />
                
                {/* 节点4: 分享/发布 - 橙色 */}
                <WorkflowNode
                  x={448}
                  y={94}
                  bgColor="#FFEDD5"
                  glowColor="#FF6B00"
                  borderColor="#FDBA74"
                  delay={0.7}
                  label="Publish"
                  icon={
                    <g transform="scale(1.3)">
                      <circle cx="-5" cy="-5" r="3.5" fill="#FF6B00" />
                      <circle cx="5" cy="-5" r="3.5" fill="#FF6B00" />
                      <circle cx="0" cy="5" r="3.5" fill="#FF6B00" />
                      <line x1="-2.5" y1="-2.5" x2="-1" y2="2.5" stroke="#FF6B00" strokeWidth="2" />
                      <line x1="2.5" y1="-2.5" x2="1" y2="2.5" stroke="#FF6B00" strokeWidth="2" />
                    </g>
                  }
                />
              </svg>
            </div>
          </div>
        </section>

        {/* 统计卡片 + 热力图 */}
        <section className="mb-16">
          <motion.div 
            className="flex gap-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {/* 左侧：纵向统计卡片 */}
            <div className="flex flex-col gap-4 w-48 shrink-0">
              <motion.div 
                className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex-1 flex items-center"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
                  </svg>
                  <div>
                    <motion.p 
                      className="text-2xl font-bold text-gray-900 tracking-tight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.6 }}
                    >
                      {loading ? '-' : stats.workflows}
                    </motion.p>
                    <p className="text-xs text-gray-500">工作流</p>
                  </div>
                </div>
              </motion.div>
              <motion.div 
                className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex-1 flex items-center"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-10 h-10" viewBox="0 0 14 14">
                    <g fill="none" fillRule="evenodd" clipRule="evenodd">
                      <path fill="#8fbffa" d="M6.035 2.507c-.653 1.073-.204 2.73 1.344 3c.545.095.978.51 1.096 1.05l.02.092c.454 2.073 3.407 2.086 3.878.017l.025-.108a1 1 0 0 1 .04-.139v5.791c0 .941-.764 1.704-1.705 1.704H1.734A1.704 1.704 0 0 1 .03 12.21V4.211c0-.941.763-1.704 1.704-1.704h4.3Z"/>
                      <path fill="#2859c5" d="M3.08 7.797a.625.625 0 1 0-.883.884L3.255 9.74l-1.058 1.058a.625.625 0 0 0 .884.884l1.5-1.5a.625.625 0 0 0 0-.884l-1.5-1.5Zm2.559 2.817a.625.625 0 1 0 0 1.25h1.5a.625.625 0 0 0 0-1.25zm.396-8.107c-.653 1.073-.204 2.73 1.344 3c.318.055.598.22.8.454H.028V4.21c0-.941.764-1.704 1.705-1.704h4.3ZM11.233.721C11.04-.13 9.825-.125 9.638.728l-.007.035l-.015.068A2.53 2.53 0 0 1 7.58 2.772c-.887.154-.887 1.428 0 1.582a2.53 2.53 0 0 1 2.038 1.952l.02.093c.187.852 1.401.858 1.595.007l.025-.108a2.55 2.55 0 0 1 2.046-1.942c.889-.155.889-1.43 0-1.585A2.55 2.55 0 0 1 11.26.844l-.018-.082l-.01-.041Z"/>
                    </g>
                  </svg>
                  <div>
                    <motion.p 
                      className="text-2xl font-bold text-gray-900 tracking-tight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.7 }}
                    >
                      {loading ? '-' : stats.prompts}
                    </motion.p>
                    <p className="text-xs text-gray-500">提示词</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* 右侧：热力图 */}
            <motion.div 
              className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">活跃度</h3>
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
            </motion.div>
          </motion.div>
        </section>

        {/* 工作流列表 - 卡片样式 */}
        <motion.section 
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
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
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {workflows.map((workflow: any) => (
                <motion.div 
                  key={workflow.id} 
                  onClick={() => handleOpenWorkflow(workflow.id)}
                  onMouseEnter={() => workflowApi.preloadWorkflow(workflow.id)}
                  onContextMenu={(e) => contextMenu.open(e, workflow.id)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-all group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* 图标 */}
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
                    </svg>
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                      {workflow.name}
                    </h3>
                    <p className="text-sm text-gray-400 truncate">
                      {workflow.nodes?.length || 0} 个节点 · {formatRelativeTime(workflow.updated_at)}
                    </p>
                  </div>
                  {/* 操作按钮 */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); contextMenu.open(e, workflow.id); }}
                    className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="6" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="18" r="2" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* 底部统计 */}
          {!loading && workflows.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              共 {workflows.length} 个工作流
            </div>
          )}
        </motion.section>
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
            { 
              label: '导出', 
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>, 
              onClick: async () => {
                const workflow = workflows.find(w => w.id === contextMenu.data);
                if (workflow) {
                  try {
                    const exportData = {
                      name: workflow.name,
                      description: workflow.description,
                      nodes: workflow.nodes,
                      exportedAt: new Date().toISOString(),
                      version: '1.0'
                    };
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${workflow.name || 'workflow'}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    success('工作流已导出');
                  } catch { error('导出失败'); }
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