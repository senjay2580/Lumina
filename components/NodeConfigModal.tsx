import React, { useState, useEffect } from 'react';
import { WorkflowNode, NODE_TYPES } from '../types';

interface NodeConfigModalProps {
  node: WorkflowNode | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<WorkflowNode['data']>) => void;
  onDelete: (id: string) => void;
}

type TabType = 'parameters' | 'settings';

export const NodeConfigModal: React.FC<NodeConfigModalProps> = ({ node, onClose, onUpdate, onDelete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('parameters');

  useEffect(() => {
    if (node) requestAnimationFrame(() => setIsVisible(true));
    else setIsVisible(false);
  }, [node]);

  if (!node) return null;

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, { config: { ...node.data.config, [key]: value } });
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      // 关闭后将焦点移回 body，确保键盘事件可以正常触发
      document.body.focus();
    }, 200);
  };

  const handleDelete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDelete(node.id);
      document.body.focus();
    }, 200);
  };

  const isInput = node.type === NODE_TYPES.INPUT || node.type === 'AI_INPUT';
  const nodeColor = isInput ? '#10B981' : '#3B82F6';
  const nodeIcon = isInput ? 'IN' : 'AI';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Modal */}
      <div
        className={`relative w-[90vw] max-w-[900px] h-[70vh] max-h-[600px] bg-[#F5F5F5] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* Header */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: nodeColor }}
            >
              {nodeIcon}
            </div>
            <input
              type="text"
              value={node.data.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              className="text-sm font-medium text-gray-800 bg-transparent border-none outline-none hover:bg-gray-100 px-2 py-1 rounded transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Sidebar Navigation */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-3 space-y-1">
              <button
                onClick={() => setActiveTab('parameters')}
                className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2.5 ${activeTab === 'parameters' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:bg-white/60'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
                参数配置
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2.5 ${activeTab === 'settings' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:bg-white/60'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                基本设置
              </button>
            </div>
            
            {/* 底部删除按钮 */}
            <div className="mt-auto p-3 border-t border-gray-200">
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                删除节点
              </button>
            </div>
          </div>

          {/* Right Panel - Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {activeTab === 'parameters' && (
              <div className="max-w-2xl space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-semibold text-gray-800">参数配置</h3>
                  <span className="text-xs text-gray-400">配置节点的核心参数</span>
                </div>
                
                {isInput ? (
                  /* AI Input Parameters */
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">输入类型</label>
                      <select
                        value={node.data.config?.inputType || 'text'}
                        onChange={(e) => updateConfig('inputType', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                      >
                        <option value="text">文本输入</option>
                        <option value="file">文件上传</option>
                        <option value="api">API 接口</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">占位提示</label>
                      <input
                        type="text"
                        value={node.data.config?.placeholder || ''}
                        onChange={(e) => updateConfig('placeholder', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                        placeholder="请输入内容..."
                      />
                    </div>
                  </div>
                ) : (
                  /* AI Processor Parameters */
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">模型选择</label>
                        <select
                          value={node.data.config?.model || 'gpt-4o'}
                          onChange={(e) => updateConfig('model', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                        >
                          <option value="gpt-4o">GPT-4o (OpenAI)</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                          <option value="gemini-pro">Gemini Pro 1.5</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={node.data.config?.temperature || 0.7}
                            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                          <input
                            type="number"
                            min="1"
                            max="128000"
                            value={node.data.config?.maxTokens || 2048}
                            onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">系统提示词</label>
                      <textarea
                        value={node.data.config?.systemPrompt || ''}
                        onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none font-mono"
                        placeholder="You are a helpful assistant..."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-semibold text-gray-800">基本设置</h3>
                  <span className="text-xs text-gray-400">配置节点的基本信息</span>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">节点名称</label>
                    <input
                      type="text"
                      value={node.data.label}
                      onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">节点 ID</label>
                    <input
                      type="text"
                      value={node.id}
                      disabled
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                  <textarea
                    value={node.data.description || ''}
                    onChange={(e) => onUpdate(node.id, { description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                    placeholder="添加节点描述..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
