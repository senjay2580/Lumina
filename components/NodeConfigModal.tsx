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
        className={`relative w-[95vw] max-w-[1200px] h-[80vh] bg-[#F5F5F5] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
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

        {/* Main Content - 3 Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - INPUT */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="h-10 border-b border-gray-200 flex items-center px-3 shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">INPUT</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  <p className="text-xs">暂无输入数据</p>
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Parameters/Settings */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tabs */}
            <div className="h-10 border-b border-gray-200 flex items-center justify-center gap-6 bg-white shrink-0">
              <button
                onClick={() => setActiveTab('parameters')}
                className={`px-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'parameters' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Parameters
                {activeTab === 'parameters' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'settings' ? 'text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Settings
                {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>

            {/* Parameters Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {activeTab === 'parameters' && (
                <div className="max-w-lg mx-auto space-y-5">
                  {isInput ? (
                    /* AI Input Parameters */
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">输入类型</label>
                        <select
                          value={node.data.config?.inputType || 'text'}
                          onChange={(e) => updateConfig('inputType', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                        >
                          <option value="text">文本输入</option>
                          <option value="file">文件上传</option>
                          <option value="api">API 接口</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-2">占位提示</label>
                        <input
                          type="text"
                          value={node.data.config?.placeholder || ''}
                          onChange={(e) => updateConfig('placeholder', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                          placeholder="请输入内容..."
                        />
                      </div>
                    </>
                  ) : (
                    /* AI Processor Parameters */
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">模型选择</label>
                        <select
                          value={node.data.config?.model || 'gpt-4o'}
                          onChange={(e) => updateConfig('model', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                        >
                          <option value="gpt-4o">GPT-4o (OpenAI)</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                          <option value="gemini-pro">Gemini Pro 1.5</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-2">系统提示词</label>
                        <textarea
                          value={node.data.config?.systemPrompt || ''}
                          onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                          rows={5}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                          placeholder="You are a helpful assistant..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-2">Temperature</label>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={node.data.config?.temperature || 0.7}
                            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-2">Max Tokens</label>
                          <input
                            type="number"
                            min="1"
                            max="128000"
                            value={node.data.config?.maxTokens || 2048}
                            onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-lg mx-auto space-y-5">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">节点名称</label>
                    <input
                      type="text"
                      value={node.data.label}
                      onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">描述</label>
                    <textarea
                      value={node.data.description || ''}
                      onChange={(e) => onUpdate(node.id, { description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                      placeholder="添加节点描述..."
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      删除节点
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - OUTPUT */}
          <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0">
            <div className="h-10 border-b border-gray-200 flex items-center px-3 shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OUTPUT</span>
            </div>
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <div className="text-center text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <p className="text-xs">暂无输出数据</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
