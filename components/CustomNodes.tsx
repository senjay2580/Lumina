import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeTemplate, HandleDefinition } from '../types';

interface CustomNodeProps {
  id: string;
  data: {
    label: string;
    description?: string;
    config?: Record<string, any>;
    template?: NodeTemplate;
    hasProvider?: boolean;
    isAnnotation?: boolean;
  };
  selected: boolean;
}

// 颜色映射
const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  orange: { bg: 'bg-orange-500', border: 'border-orange-300', text: 'text-orange-500' },
  green: { bg: 'bg-green-500', border: 'border-green-300', text: 'text-green-500' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-500' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-500' },
  gray: { bg: 'bg-gray-500', border: 'border-gray-300', text: 'text-gray-500' },
  yellow: { bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-500' },
};

// 获取形状样式
const getShapeStyles = (shape: string, selected: boolean) => {
  const base = selected 
    ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' 
    : 'border-gray-200';
  
  switch (shape) {
    case 'diamond':
      return `${base} rotate-45`;
    case 'hexagon':
      return base; // 六边形用 clip-path 实现
    case 'circle':
      return `${base} rounded-full`;
    case 'rounded':
      return `${base} rounded-2xl`;
    default: // rectangle
      return `${base} rounded-xl`;
  }
};

// 菱形节点
const DiamondNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  
  return (
    <div className="relative" style={{ width: '70px', height: '70px' }}>
      {/* 菱形容器 */}
      <div 
        className={`absolute inset-0 bg-white border-2 shadow-md transform rotate-45 ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
        }`}
        style={{ borderRadius: '8px' }}
      />
      {/* 内容（不旋转） */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-white`}>
          {template?.iconSvg ? (
            <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </div>
      </div>
      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary"
        style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
      />
      {/* 标签 */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
        <p className="text-xs text-gray-700 font-medium">{data.label}</p>
      </div>
    </div>
  );
};

// 六边形节点
const HexagonNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasProvider = data.hasProvider;
  const requiresProvider = template?.requiresProvider;
  
  // 状态颜色：需要 API 配置时显示绿色/灰色
  const statusColor = requiresProvider 
    ? (hasProvider ? 'bg-green-500' : 'bg-gray-400')
    : null;

  return (
    <div className="relative" style={{ width: '70px', height: '70px' }}>
      {/* 六边形背景 */}
      <div 
        className={`absolute inset-0 bg-white border-2 shadow-md ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
        }`}
        style={{ 
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
          borderRadius: '4px'
        }}
      />
      {/* 内容 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-white`}>
          {template?.iconSvg ? (
            <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
          {/* 状态指示器 */}
          {statusColor && (
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusColor} border-2 border-white`} />
          )}
        </div>
      </div>
      {/* 输入 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary"
        style={{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }}
      />
      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary"
        style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
      />
      {/* 标签 */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
        <p className="text-xs text-gray-700 font-medium">{data.label}</p>
      </div>
    </div>
  );
};

// 圆角矩形节点（触发器和输入）
const RoundedNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasInputHandles = template?.inputHandles && template.inputHandles.length > 0;
  const isTrigger = template?.category === 'trigger';

  return (
    <div className="relative">
      {/* 触发器标记 - 左上角小闪电 */}
      {isTrigger && (
        <div className="absolute -left-3 -top-1 z-10">
          <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      )}
      <div 
        className={`relative w-16 h-16 rounded-2xl bg-white border-2 flex items-center justify-center shadow-md ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
        }`}
      >
        {/* 输入 Handle */}
        {hasInputHandles && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-left-1.5"
          />
        )}
        {/* 图标 */}
        <div className={`w-8 h-8 flex items-center justify-center ${colors.text}`}>
          {template?.iconSvg ? (
            <div className="w-7 h-7" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </div>
        {/* 输出 Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-right-1.5"
        />
      </div>
      <div className="mt-2 text-center" style={{ width: '90px', marginLeft: '-5px' }}>
        <p className="text-xs text-gray-700 font-medium truncate">{data.label}</p>
      </div>
    </div>
  );
};

// 圆形节点（AI 大模型）
const CircleNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasProvider = data.hasProvider;
  const requiresProvider = template?.requiresProvider;
  
  // 状态颜色
  const statusColor = requiresProvider 
    ? (hasProvider ? 'bg-green-500' : 'bg-gray-400')
    : null;

  return (
    <div className="relative">
      <div 
        className={`relative w-16 h-16 rounded-full bg-white border-2 flex items-center justify-center shadow-md ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
        }`}
      >
        {/* 状态指示器 - 圆形节点右上角 */}
        {statusColor && (
          <div className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusColor} border-2 border-white z-10`} />
        )}
        {/* 输入 Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-left-1.5"
        />
        {/* 图标 */}
        <div className={`w-8 h-8 flex items-center justify-center ${colors.text}`}>
          {template?.iconSvg ? (
            <div className="w-7 h-7" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
        </div>
        {/* 输出 Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-right-1.5"
        />
      </div>
      <div className="mt-2 text-center" style={{ width: '90px', marginLeft: '-5px' }}>
        <p className="text-xs text-gray-700 font-medium truncate">{data.label}</p>
      </div>
    </div>
  );
};

// 默认矩形节点
const RectangleNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasInputHandles = template?.inputHandles && template.inputHandles.length > 0;

  return (
    <div className="relative">
      <div 
        className={`relative w-14 h-14 rounded-xl bg-white border-2 flex items-center justify-center shadow-md ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
        }`}
      >
        {hasInputHandles && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-left-1.5"
          />
        )}
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-white`}>
          {template?.iconSvg ? (
            <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          )}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-right-1.5"
        />
      </div>
      <div className="mt-2 text-center" style={{ width: '80px', marginLeft: '-13px' }}>
        <p className="text-xs text-gray-700 font-medium truncate">{data.label}</p>
      </div>
    </div>
  );
};

// 便签节点
const StickyNoteNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const backgroundColor = config.backgroundColor || '#FEF3C7';
  const fontSize = config.fontSize || 14;
  const text = config.text || '';
  const initialWidth = config.width || 200;
  const initialHeight = config.height || 100;
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const startPos = React.useRef({ x: 0, y: 0, width: 0, height: 0 });
  const clickPos = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    setEditText(config.text || '');
  }, [config.text]);

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // 不全选，让光标在末尾或点击位置
      if (!clickPos.current) {
        // 如果没有点击位置信息，光标放末尾
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
      clickPos.current = null;
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    clickPos.current = { x: e.clientX, y: e.clientY };
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== text) {
      window.dispatchEvent(new CustomEvent('stickyNoteUpdate', {
        detail: { nodeId: id, text: editText }
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(text);
    }
    e.stopPropagation();
  };

  // 缩放处理 - 使用 DOM 直接操作避免频繁 re-render
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    
    startPos.current = { 
      x: e.clientX, 
      y: e.clientY, 
      width: container.offsetWidth, 
      height: container.offsetHeight 
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      const newWidth = Math.max(120, startPos.current.width + dx);
      const newHeight = Math.max(60, startPos.current.height + dy);
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!container) return;
      // 保存新尺寸
      window.dispatchEvent(new CustomEvent('stickyNoteResize', {
        detail: { nodeId: id, width: container.offsetWidth, height: container.offsetHeight }
      }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative rounded-lg shadow-md transition-shadow ${
        selected ? 'shadow-lg ring-2 ring-primary ring-offset-2' : ''
      }`}
      style={{ backgroundColor, width: initialWidth, height: initialHeight, minWidth: 120, minHeight: 60 }}
      onDoubleClick={handleDoubleClick}
    >
      {/* 折角效果 */}
      <div 
        className="absolute top-0 right-0 w-6 h-6 pointer-events-none"
        style={{ background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)` }}
      />
      <div className="p-3 h-full overflow-auto">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-gray-700"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
            placeholder="输入内容..."
          />
        ) : text ? (
          <p className="text-gray-700 whitespace-pre-wrap break-words cursor-text" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
            {text}
          </p>
        ) : (
          <p className="text-gray-400 italic text-sm cursor-text">双击编辑内容...</p>
        )}
      </div>
      {/* 缩放手柄 - 便签 */}
      {selected && (
        <div
          className="nodrag absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-3 h-3 text-gray-400 absolute bottom-0.5 right-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

// 分组框节点
const GroupBoxNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const title = config.title || '分组';
  const initialWidth = config.width || 300;
  const initialHeight = config.height || 200;
  
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(title);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const startPos = React.useRef({ x: 0, y: 0, width: 0, height: 0 });

  React.useEffect(() => {
    setEditTitle(config.title || '分组');
  }, [config.title]);

  React.useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  const handleBlur = () => {
    setIsEditingTitle(false);
    if (editTitle !== title) {
      window.dispatchEvent(new CustomEvent('groupBoxUpdate', {
        detail: { nodeId: id, title: editTitle }
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditingTitle(false);
      if (e.key === 'Escape') setEditTitle(title);
    }
    e.stopPropagation();
  };

  // 缩放处理 - 使用 DOM 直接操作避免频繁 re-render
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    
    startPos.current = { 
      x: e.clientX, 
      y: e.clientY, 
      width: container.offsetWidth, 
      height: container.offsetHeight 
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      const newWidth = Math.max(150, startPos.current.width + dx);
      const newHeight = Math.max(100, startPos.current.height + dy);
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (!container) return;
      // 保存新尺寸
      window.dispatchEvent(new CustomEvent('groupBoxResize', {
        detail: { nodeId: id, width: container.offsetWidth, height: container.offsetHeight }
      }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={containerRef}
      className="relative"
      style={{ width: initialWidth, height: initialHeight, minWidth: 150, minHeight: 100, pointerEvents: 'none' }}
    >
      {/* 边框 - 只有边框可点击 */}
      <div 
        className={`absolute inset-0 rounded-xl border-2 border-dashed transition-colors ${
          selected ? 'border-primary' : 'border-gray-300'
        }`}
        style={{ pointerEvents: 'stroke' }}
      />
      {/* 标题栏 - 可点击 */}
      <div 
        className="absolute -top-3 left-3 px-2 py-0.5 rounded text-xs font-medium text-gray-600 cursor-text bg-[#fafafa]"
        style={{ pointerEvents: 'auto' }}
        onDoubleClick={handleTitleDoubleClick}
      >
        {isEditingTitle ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none w-20 text-xs"
          />
        ) : title}
      </div>
      {/* 缩放手柄 - 分组框 */}
      {selected && (
        <div
          className="nodrag absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={handleResizeStart}
        >
          <svg className="w-3 h-3 text-gray-400 absolute bottom-0.5 right-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

// 通用节点组件 - 根据 shape 选择渲染
export const UniversalNode: React.FC<CustomNodeProps> = (props) => {
  const shape = props.data.template?.shape || 'rectangle';
  
  switch (shape) {
    case 'diamond':
      return <DiamondNode {...props} />;
    case 'hexagon':
      return <HexagonNode {...props} />;
    case 'circle':
      return <CircleNode {...props} />;
    case 'rounded':
      return <RoundedNode {...props} />;
    case 'sticky':
      return <StickyNoteNode {...props} />;
    case 'group':
      return <GroupBoxNode {...props} />;
    default:
      return <RectangleNode {...props} />;
  }
};

// 导出节点类型映射（动态生成）
export const createNodeTypes = (templates: NodeTemplate[]) => {
  const types: Record<string, React.FC<any>> = {};
  
  templates.forEach(template => {
    types[template.type] = (props: any) => (
      <UniversalNode 
        {...props} 
        data={{ ...props.data, template }} 
      />
    );
  });
  
  // 添加默认类型以防模板未加载
  if (!types['MANUAL_TRIGGER']) {
    types['MANUAL_TRIGGER'] = (props: any) => <UniversalNode {...props} />;
  }
  if (!types['INPUT']) {
    types['INPUT'] = (props: any) => <UniversalNode {...props} />;
  }
  if (!types['AI_MODEL']) {
    types['AI_MODEL'] = (props: any) => <UniversalNode {...props} />;
  }
  
  // 添加辅助工具节点类型（硬编码，不从数据库加载）
  types['STICKY_NOTE'] = (props: any) => <StickyNoteNode {...props} />;
  types['GROUP_BOX'] = (props: any) => <GroupBoxNode {...props} />;
  
  return types;
};
