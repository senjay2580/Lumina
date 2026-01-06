import React, { useState, useEffect } from 'react';
import { getStoredUser } from '../lib/auth';
import * as workflowApi from '../lib/workflows';
import * as promptApi from '../lib/prompts';
import * as resourceApi from '../lib/resources';
import { ContextMenu, useContextMenu, useToast, ToastContainer, Confirm, LoadingSpinner } from '../shared';

type TabType = 'workflows' | 'prompts' | 'resources';

interface DeletedWorkflow {
  id: string;
  name: string;
  deleted_at: string;
  nodes: any[];
}

interface DeletedPrompt {
  id: string;
  title: string;
  deleted_at: string;
}

interface DeletedResource {
  id: string;
  title: string;
  type: string;
  deleted_at: string;
}

export const TrashPage: React.FC = () => {
  const user = getStoredUser();
  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [workflows, setWorkflows] = useState<DeletedWorkflow[]>([]);
  const [prompts, setPrompts] = useState<DeletedPrompt[]>([]);
  const [resources, setResources] = useState<DeletedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ open: boolean; type: 'restore' | 'delete' | 'empty'; id?: string; itemType?: TabType }>({ open: false, type: 'restore' });
  const contextMenu = useContextMenu();
  const { toasts, removeToast, success, error } = useToast();

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [wfs, pts, res] = await Promise.all([
        workflowApi.getDeletedWorkflows(user.id),
        promptApi.getDeletedPrompts(user.id),
        resourceApi.getDeletedResources(user.id)
      ]);
      setWorkflows(wfs);
      setPrompts(pts);
      setResources(res as DeletedResource[]);
    } catch (err) {
      console.error('加载回收站失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const formatDeletedTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays < 1) return '今天删除';
    if (diffDays === 1) return '昨天删除';
    if (diffDays < 7) return `${diffDays} 天前删除`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前删除`;
    return date.toLocaleDateString('zh-CN');
  };

  const handleRestore = async (id: string, type: TabType) => {
    try {
      if (type === 'workflows') {
        await workflowApi.restoreWorkflow(id);
        setWorkflows(prev => prev.filter(w => w.id !== id));
      } else if (type === 'prompts') {
        await promptApi.restorePrompt(id);
        setPrompts(prev => prev.filter(p => p.id !== id));
      } else {
        await resourceApi.restoreResource(id);
        setResources(prev => prev.filter(r => r.id !== id));
      }
      success('已恢复');
    } catch (err) {
      error('恢复失败');
    }
  };

  const handlePermanentDelete = async (id: string, type: TabType) => {
    try {
      if (type === 'workflows') {
        await workflowApi.permanentDeleteWorkflow(id);
        setWorkflows(prev => prev.filter(w => w.id !== id));
      } else if (type === 'prompts') {
        await promptApi.permanentDeletePrompt(id);
        setPrompts(prev => prev.filter(p => p.id !== id));
      } else {
        await resourceApi.permanentDeleteResourceById(id);
        setResources(prev => prev.filter(r => r.id !== id));
      }
      success('已永久删除');
    } catch (err) {
      error('删除失败');
    }
    setConfirmState({ open: false, type: 'delete' });
  };

  const handleEmptyTrash = async () => {
    if (!user?.id) return;
    try {
      if (activeTab === 'workflows') {
        await workflowApi.emptyWorkflowTrash(user.id);
        setWorkflows([]);
      } else if (activeTab === 'prompts') {
        await promptApi.emptyPromptTrash(user.id);
        setPrompts([]);
      } else {
        await resourceApi.emptyResourceTrash(user.id);
        setResources([]);
      }
      success('回收站已清空');
    } catch (err) {
      error('清空失败');
    }
    setConfirmState({ open: false, type: 'empty' });
  };

  const currentItems = activeTab === 'workflows' ? workflows : activeTab === 'prompts' ? prompts : resources;
  const isEmpty = currentItems.length === 0;
  const tabLabel = activeTab === 'workflows' ? '工作流' : activeTab === 'prompts' ? '提示词' : '资源';

  return (
    <div className="w-full h-full overflow-y-auto bg-[#FAFAFA]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <Confirm
        isOpen={confirmState.open && confirmState.type === 'delete'}
        title="永久删除"
        message="此操作无法撤销，确定要永久删除吗？"
        confirmText="永久删除"
        danger
        onConfirm={() => confirmState.id && confirmState.itemType && handlePermanentDelete(confirmState.id, confirmState.itemType)}
        onCancel={() => setConfirmState({ open: false, type: 'delete' })}
      />
      
      <Confirm
        isOpen={confirmState.open && confirmState.type === 'empty'}
        title="清空回收站"
        message={`确定要永久删除所有${tabLabel}吗？此操作无法撤销。`}
        confirmText="清空"
        danger
        onConfirm={handleEmptyTrash}
        onCancel={() => setConfirmState({ open: false, type: 'empty' })}
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">回收站</h1>
              <p className="text-sm text-gray-400">已删除的项目可以在这里恢复或永久删除</p>
            </div>
          </div>
          {!isEmpty && (
            <button
              onClick={() => setConfirmState({ open: true, type: 'empty' })}
              className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              清空回收站
            </button>
          )}
        </div>

        {/* 标签切换 */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'workflows' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            工作流 ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'prompts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            提示词 ({prompts.length})
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'resources' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            资源 ({resources.length})
          </button>
        </div>

        {/* 内容列表 */}
        {loading ? (
          <LoadingSpinner text="正在加载回收站..." />
        ) : isEmpty ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <p className="text-gray-500 mb-2">回收站是空的</p>
            <p className="text-gray-400 text-sm">删除的{tabLabel}会出现在这里</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {activeTab === 'workflows' ? (
              workflows.map(workflow => (
                <div
                  key={workflow.id}
                  onContextMenu={(e) => contextMenu.open(e, { id: workflow.id, type: 'workflows' })}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 20v-2h-4v-5H9v2H2V9h7v2h2V6h4V4h7v6h-7V8h-2v8h2v-2h7v6z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{workflow.name}</h3>
                    <p className="text-sm text-gray-400">{workflow.nodes?.length || 0} 个节点 · {formatDeletedTime(workflow.deleted_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(workflow.id, 'workflows')}
                      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => setConfirmState({ open: true, type: 'delete', id: workflow.id, itemType: 'workflows' })}
                      className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            ) : activeTab === 'prompts' ? (
              prompts.map(prompt => (
                <div
                  key={prompt.id}
                  onContextMenu={(e) => contextMenu.open(e, { id: prompt.id, type: 'prompts' })}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{prompt.title}</h3>
                    <p className="text-sm text-gray-400">{formatDeletedTime(prompt.deleted_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(prompt.id, 'prompts')}
                      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => setConfirmState({ open: true, type: 'delete', id: prompt.id, itemType: 'prompts' })}
                      className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              resources.map(resource => (
                <div
                  key={resource.id}
                  onContextMenu={(e) => contextMenu.open(e, { id: resource.id, type: 'resources' })}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    resource.type === 'github' ? 'bg-gray-100' :
                    resource.type === 'link' ? 'bg-green-50' :
                    resource.type === 'document' ? 'bg-blue-50' :
                    resource.type === 'image' ? 'bg-cyan-50' : 'bg-gray-50'
                  }`}>
                    {resource.type === 'github' ? (
                      <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    ) : resource.type === 'link' ? (
                      <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    ) : resource.type === 'document' ? (
                      <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{resource.title}</h3>
                    <p className="text-sm text-gray-400">
                      {resource.type === 'github' ? 'GitHub' : 
                       resource.type === 'link' ? '链接' : 
                       resource.type === 'document' ? '文档' : '图片'} · {formatDeletedTime(resource.deleted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(resource.id, 'resources')}
                      className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => setConfirmState({ open: true, type: 'delete', id: resource.id, itemType: 'resources' })}
                      className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={contextMenu.close}
          items={[
            {
              label: '恢复',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
              onClick: () => handleRestore(contextMenu.data.id, contextMenu.data.type)
            },
            { divider: true, label: '', onClick: () => {} },
            {
              label: '永久删除',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>,
              danger: true,
              onClick: () => setConfirmState({ open: true, type: 'delete', id: contextMenu.data.id, itemType: contextMenu.data.type })
            }
          ]}
        />
      )}
    </div>
  );
};
