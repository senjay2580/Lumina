import React, { useState, useEffect } from 'react';
import { NodeTemplate } from '../types';
import { getNodeTemplates } from '../lib/components';
import { hasEnabledProvider } from '../lib/ai-providers';
import { getStoredUser } from '../lib/auth';

interface ComponentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onDragStart: (e: React.DragEvent, component: NodeTemplate) => void;
  onAddComponent?: (component: NodeTemplate) => void;
}

// 颜色映射
const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; border: string; gradient: string }> = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', gradient: 'from-orange-400 to-orange-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', gradient: 'from-green-400 to-green-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-400 to-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', gradient: 'from-purple-400 to-purple-600' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', gradient: 'from-gray-400 to-gray-600' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', gradient: 'from-yellow-400 to-yellow-600' },
  };
  return colors[color] || colors.gray;
};

// 分类名称映射
const categoryNames: Record<string, string> = {
  trigger: '触发器',
  input: '输入',
  processor: '处理器',
  output: '输出',
};

// 辅助工具定义（前端硬编码，不存数据库）
const ANNOTATION_TOOLS = [
  {
    type: 'STICKY_NOTE',
    name: '便签',
    description: '添加文字批注',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>',
    color: 'yellow',
    defaultConfig: { text: '', backgroundColor: '#FEF3C7', fontSize: 14 },
  },
  {
    type: 'GROUP_BOX',
    name: '分组框',
    description: '组织相关节点',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
    color: 'gray',
    defaultConfig: { title: '分组', backgroundColor: '#F3F4F6', width: 300, height: 200 },
  },
];

export const ComponentPanel: React.FC<ComponentPanelProps> = ({ 
  isOpen, 
  onClose, 
  onDragStart, 
  onAddComponent 
}) => {
  const user = getStoredUser();
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<NodeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProvider, setHasProvider] = useState(false);

  // 加载节点模板和检查 AI 配置状态
  useEffect(() => {
    const loadData = async () => {
      try {
        const [templatesData, providerStatus] = await Promise.all([
          getNodeTemplates(),
          user?.id ? hasEnabledProvider(user.id) : Promise.resolve(false),
        ]);
        setTemplates(templatesData);
        setHasProvider(providerStatus);
      } catch (err) {
        console.error('加载组件失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.id]);

  // 过滤搜索
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  // 按分类分组
  const groupedTemplates = filteredTemplates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  // 分类顺序
  const categoryOrder = ['trigger', 'input', 'processor', 'output'];

  return (
    <div className={`absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* 头部 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm">组件库</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 搜索框 */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input 
            type="text" 
            placeholder="搜索组件..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-sm" 
          />
        </div>
      </div>

      {/* 组件列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* 工作流节点 */}
            {categoryOrder.map(category => {
              const items = groupedTemplates[category];
              if (!items?.length) return null;
              
              return (
                <div key={category} className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {categoryNames[category] || category}
                  </h3>
                  <div className="space-y-2">
                    {items.map((template) => {
                      const colors = getColorClasses(template.color);
                      // AI 大模型节点：根据是否配置了 API 显示不同状态指示器
                      const statusColor = template.requiresProvider 
                        ? (hasProvider ? 'bg-green-500' : 'bg-gray-400')
                        : null;

                      return (
                        <div 
                          key={template.id} 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(template));
                            e.dataTransfer.effectAllowed = 'copy';
                            onDragStart(e, template);
                          }}
                          onClick={() => onAddComponent?.(template)}
                          className={`group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 ${colors.bg} ${colors.border}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${colors.gradient} shadow-sm`}>
                              {/* 渲染 SVG 图标 */}
                              {template.iconSvg ? (
                                <div 
                                  className="w-5 h-5" 
                                  dangerouslySetInnerHTML={{ __html: template.iconSvg }} 
                                />
                              ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                </svg>
                              )}
                              {/* API 配置状态指示器 */}
                              {statusColor && (
                                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusColor} border-2 border-white`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-800 text-sm">{template.name}</h4>
                              <p className="text-xs text-gray-500 truncate">{template.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* 辅助工具（批注） */}
            <div className="mb-4 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                辅助工具
              </h3>
              <div className="space-y-2">
                {ANNOTATION_TOOLS.map((tool) => {
                  const colors = getColorClasses(tool.color);
                  return (
                    <div 
                      key={tool.type} 
                      draggable
                      onDragStart={(e) => {
                        const data = {
                          type: tool.type,
                          name: tool.name,
                          description: tool.description,
                          defaultConfig: tool.defaultConfig,
                          isAnnotation: true, // 标记为辅助工具
                        };
                        e.dataTransfer.setData('application/json', JSON.stringify(data));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className={`group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 ${colors.bg} ${colors.border}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${colors.gradient} shadow-sm`}>
                          <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: tool.icon }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-800 text-sm">{tool.name}</h4>
                          <p className="text-xs text-gray-500 truncate">{tool.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <p className="text-[10px] text-gray-400 text-center">拖拽或点击添加到画布</p>
      </div>
    </div>
  );
};
