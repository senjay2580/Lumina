import React from 'react';
import { WorkflowNode, NODE_TYPES } from '../types';

interface NodeConfigSidebarProps {
  node: WorkflowNode | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<WorkflowNode['data']>) => void;
  onDelete: (id: string) => void;
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ node, onClose, onUpdate, onDelete }) => {
  if (!node) return null;

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, {
      config: { ...node.data.config, [key]: value }
    });
  };

  const isInput = node.type === NODE_TYPES.INPUT || node.type === 'AI_INPUT';
  const colorClass = isInput ? 'from-green-400 to-green-600' : 'from-blue-400 to-blue-600';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/10 z-30"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-96 glass-panel border-l border-white/50 shadow-2xl z-40 flex flex-col animate-slideIn">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/40 shrink-0 bg-white/40">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md bg-gradient-to-br ${colorClass}`}>
              {isInput ? 'IN' : 'AI'}
            </div>
            <div>
              <span className="font-semibold text-gray-800 text-sm block">
                {isInput ? 'AI Input' : 'AI Processor'}
              </span>
              <span className="text-[10px] text-gray-400">配置节点参数</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-gray-500 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Basic Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"></span>
              基本信息
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">节点名称</label>
              <input
                type="text"
                value={node.data.label}
                onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                placeholder="输入节点名称"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">描述</label>
              <textarea
                value={node.data.description || ''}
                onChange={(e) => onUpdate(node.id, { description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                placeholder="添加描述..."
              />
            </div>
          </section>

          {/* AI Input Config */}
          {isInput && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                输入配置
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">输入类型</label>
                <select
                  value={node.data.config?.inputType || 'text'}
                  onChange={(e) => updateConfig('inputType', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="text">文本输入</option>
                  <option value="file">文件上传</option>
                  <option value="api">API 接口</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">占位提示</label>
                <input
                  type="text"
                  value={node.data.config?.placeholder || ''}
                  onChange={(e) => updateConfig('placeholder', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  placeholder="请输入内容..."
                />
              </div>
            </section>
          )}

          {/* AI Processor Config */}
          {!isInput && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                AI 配置
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">模型选择</label>
                <select
                  value={node.data.config?.model || 'gpt-4o'}
                  onChange={(e) => updateConfig('model', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gemini-pro">Gemini Pro 1.5</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">系统提示词</label>
                <textarea
                  value={node.data.config?.systemPrompt || ''}
                  onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-mono resize-none"
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={node.data.config?.temperature || 0.7}
                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="128000"
                    value={node.data.config?.maxTokens || 2048}
                    onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/40 bg-white/30 flex items-center justify-between">
          <button
            onClick={() => onDelete(node.id)}
            className="px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            删除节点
          </button>
          <span className="text-[10px] text-gray-400">ID: {node.id.slice(0, 8)}</span>
        </div>
      </div>
    </>
  );
};
