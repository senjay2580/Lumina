import React, { useState } from 'react';
import { ComponentDefinition, COMPONENT_DEFINITIONS, NodeType } from '../types';

interface ComponentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onDragStart: (e: React.DragEvent, component: ComponentDefinition) => void;
  onAddComponent?: (component: ComponentDefinition) => void;
}

export const ComponentPanel: React.FC<ComponentPanelProps> = ({ isOpen, onClose, onDragStart, onAddComponent }) => {
  const [search, setSearch] = useState('');
  const filteredComponents = COMPONENT_DEFINITIONS.filter(comp => comp.name.toLowerCase().includes(search.toLowerCase()) || comp.description.toLowerCase().includes(search.toLowerCase()));

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; gradient: string }> = {
      green: { bg: 'bg-green-50', border: 'border-green-200', gradient: 'from-green-400 to-green-600' },
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-400 to-blue-600' }
    };
    return colors[color] || colors.blue;
  };

  const getIcon = (type: NodeType) => type === NodeType.AI_INPUT 
    ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;

  return (
    <div className={`absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm">组件库</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" placeholder="搜索组件..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-sm" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredComponents.map((component) => {
          const colors = getColorClasses(component.color);
          return (
            <div key={component.type} draggable="true"
              onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify(component)); e.dataTransfer.effectAllowed = 'copy'; onDragStart(e, component); }}
              onClick={() => onAddComponent?.(component)}
              className={`group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${colors.gradient} shadow-sm`}>{getIcon(component.type)}</div>
                <div className="flex-1 min-w-0"><h4 className="font-medium text-gray-800 text-sm">{component.name}</h4><p className="text-xs text-gray-500 truncate">{component.description}</p></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-gray-100 bg-gray-50"><p className="text-[10px] text-gray-400 text-center">拖拽或点击添加到画布</p></div>
    </div>
  );
};
