import React, { useState, useEffect } from 'react';
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

export const HomePage: React.FC<HomePageProps> = ({ username, onNavigate, onOpenWorkflow }) => {
  const user = getStoredUser();
  const [stats, setStats] = useState<Stats>({ workflows: 0, prompts: 0 });
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const contextMenu = useContextMenu();
  const { toasts, removeToast, success, error } = useToast();

  const loadData = async () => {
    if (!user?.id) return;
    try {
      const [statsData, workflowsData] = await Promise.all([
        workflowApi.getStats(user.id),
        workflowApi.getWorkflows(user.id)
      ]);
      setStats({ workflows: statsData.workflows, prompts: statsData.prompts });
      setWorkflows(workflowsData);
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
            <rect x="3" y="3" width="6" height="6" rx="1" fill="#3B82F6" />
            <rect x="15" y="3" width="6" height="6" rx="1" fill="#10B981" />
            <rect x="9" y="15" width="6" height="6" rx="1" fill="#F59E0B" />
            <path d="M6 9v3a3 3 0 003 3h6a3 3 0 003-3V9" stroke="#94A3B8" strokeWidth="1.5" fill="none" />
          </symbol>
          <symbol id="icon-prompt" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="none" stroke="currentColor" strokeWidth="2" />
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

        {/* 统计卡片 */}
        <section className="mb-16">
          <div className="grid grid-cols-2 gap-6">
            <div className="group bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white"><use href="#icon-workflow" /></svg>
                </div>
                <div>
                  <p className="text-4xl font-bold text-gray-900 tracking-tight">{loading ? '-' : stats.workflows}</p>
                  <p className="text-sm text-gray-500 font-medium">工作流</p>
                </div>
              </div>
            </div>
            <div className="group bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white"><use href="#icon-prompt" /></svg>
                </div>
                <div>
                  <p className="text-4xl font-bold text-gray-900 tracking-tight">{loading ? '-' : stats.prompts}</p>
                  <p className="text-sm text-gray-500 font-medium">提示词</p>
                </div>
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
