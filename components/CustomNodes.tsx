import React from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { NodeTemplate } from '../types';

// 主题 Context
export const ThemeContext = React.createContext<'light' | 'dark'>('light');

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

// 菱形节点
const DiamondNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const theme = React.useContext(ThemeContext);
  const isDark = theme === 'dark';
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  
  return (
    <div className="relative" style={{ width: '70px', height: '70px' }}>
      <div 
        className={`absolute inset-0 border-2 shadow-md transform rotate-45 ${
          isDark ? 'bg-gray-800' : 'bg-white'
        } ${
          selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : isDark ? 'border-gray-600' : 'border-gray-200'
        }`}
        style={{ borderRadius: '8px' }}
      />
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
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }} />
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
        <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{data.label}</p>
      </div>
    </div>
  );
};

// 六边形节点
const HexagonNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const theme = React.useContext(ThemeContext);
  const isDark = theme === 'dark';
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasProvider = data.hasProvider;
  const requiresProvider = template?.requiresProvider;
  const statusColor = requiresProvider ? (hasProvider ? 'bg-green-500' : 'bg-gray-400') : null;

  return (
    <div className="relative" style={{ width: '70px', height: '70px' }}>
      <div 
        className={`absolute inset-0 border-2 shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'} ${selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : isDark ? 'border-gray-600' : 'border-gray-200'}`}
        style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', borderRadius: '4px' }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-white`}>
          {template?.iconSvg ? (
            <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
          {statusColor && <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusColor} border-2 ${isDark ? 'border-gray-800' : 'border-white'}`} />}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} style={{ left: '-6px', top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }} />
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
        <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{data.label}</p>
      </div>
    </div>
  );
};

// 圆角矩形节点
const RoundedNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const theme = React.useContext(ThemeContext);
  const isDark = theme === 'dark';
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasInputHandles = template?.inputHandles && template.inputHandles.length > 0;
  const isTrigger = template?.category === 'trigger';

  return (
    <div className="relative">
      {isTrigger && (
        <div className="absolute -left-3 -top-1 z-10">
          <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      )}
      <div className={`relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'} ${selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : isDark ? 'border-gray-600' : 'border-gray-200'}`}>
        {hasInputHandles && <Handle type="target" position={Position.Left} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-left-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />}
        <div className={`w-8 h-8 flex items-center justify-center ${colors.text}`}>
          {template?.iconSvg ? (
            <div className="w-7 h-7" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </div>
        <Handle type="source" position={Position.Right} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-right-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />
      </div>
      <div className="mt-2 text-center" style={{ width: '90px', marginLeft: '-5px' }}>
        <p className={`text-xs font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{data.label}</p>
      </div>
    </div>
  );
};

// 圆形节点
const CircleNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const theme = React.useContext(ThemeContext);
  const isDark = theme === 'dark';
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasProvider = data.hasProvider;
  const requiresProvider = template?.requiresProvider;
  const statusColor = requiresProvider ? (hasProvider ? 'bg-green-500' : 'bg-gray-400') : null;

  return (
    <div className="relative">
      <div className={`relative w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'} ${selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : isDark ? 'border-gray-600' : 'border-gray-200'}`}>
        {statusColor && <div className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusColor} border-2 ${isDark ? 'border-gray-800' : 'border-white'} z-10`} />}
        <Handle type="target" position={Position.Left} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-left-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />
        <div className={`w-8 h-8 flex items-center justify-center ${colors.text}`}>
          {template?.iconSvg ? (
            <div className="w-7 h-7" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
        </div>
        <Handle type="source" position={Position.Right} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-right-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />
      </div>
      <div className="mt-2 text-center" style={{ width: '90px', marginLeft: '-5px' }}>
        <p className={`text-xs font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{data.label}</p>
      </div>
    </div>
  );
};

// 默认矩形节点
const RectangleNode: React.FC<CustomNodeProps> = ({ data, selected }) => {
  const theme = React.useContext(ThemeContext);
  const isDark = theme === 'dark';
  const template = data.template;
  const colors = colorMap[template?.color || 'gray'];
  const hasInputHandles = template?.inputHandles && template.inputHandles.length > 0;

  return (
    <div className="relative">
      <div className={`relative w-14 h-14 rounded-xl border-2 flex items-center justify-center shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'} ${selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : isDark ? 'border-gray-600' : 'border-gray-200'}`}>
        {hasInputHandles && <Handle type="target" position={Position.Left} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-left-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />}
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-white`}>
          {template?.iconSvg ? (
            <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.iconSvg }} />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          )}
        </div>
        <Handle type="source" position={Position.Right} className={`!w-3 !h-3 !rounded-full !border-2 hover:!border-primary !-right-1.5 ${isDark ? '!bg-gray-700 !border-gray-500' : '!bg-white !border-gray-400'}`} />
      </div>
      <div className="mt-2 text-center" style={{ width: '80px', marginLeft: '-13px' }}>
        <p className={`text-xs font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{data.label}</p>
      </div>
    </div>
  );
};

// 计算便签折角的暗色
const getDarkerColor = (hex: string, percent: number = 15) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent / 100));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
};

// 便签节点 - 高保真便签样式
const StickyNoteNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const backgroundColor = config.backgroundColor || '#FEF3C7';
  const textColor = config.color || '#374151';
  const fontSize = config.fontSize || 14;
  const fontWeight = config.fontWeight || 'normal';
  const text = config.text || '';
  const initialWidth = config.width || 200;
  const initialHeight = config.height || 120;
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { setEditText(config.text || ''); }, [config.text]);
  React.useEffect(() => { setSize({ width: config.width || 200, height: config.height || 120 }); }, [config.width, config.height]);
  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); };
  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== text) {
      window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, text: editText } }));
    }
  };

  const foldSize = 24;
  const darkerColor = getDarkerColor(backgroundColor, 12);
  const shadowColor = getDarkerColor(backgroundColor, 25);

  return (
    <div 
      className="relative"
      style={{ width: size.width, height: size.height, minWidth: 100, minHeight: 80 }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer minWidth={100} minHeight={80} isVisible={selected} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-white !border-2 !border-primary !rounded"
        onResize={(_, params) => setSize({ width: params.width, height: params.height })}
        onResizeEnd={(_, params) => {
          window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, width: params.width, height: params.height } }));
        }}
      />
      
      {/* 便签主体 - 使用 SVG 实现折角效果 */}
      <svg 
        width={size.width} 
        height={size.height} 
        className="absolute inset-0"
        style={{ filter: selected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
      >
        {/* 便签主体 */}
        <path 
          d={`M 0 0 L ${size.width - foldSize} 0 L ${size.width} ${foldSize} L ${size.width} ${size.height} L 0 ${size.height} Z`}
          fill={backgroundColor}
        />
        {/* 折角阴影 */}
        <path 
          d={`M ${size.width - foldSize} 0 L ${size.width - foldSize} ${foldSize} L ${size.width} ${foldSize} Z`}
          fill={shadowColor}
        />
        {/* 折角 */}
        <path 
          d={`M ${size.width - foldSize} 0 L ${size.width - foldSize} ${foldSize} L ${size.width} ${foldSize}`}
          fill="none"
          stroke={darkerColor}
          strokeWidth="1"
        />
        {/* 底部阴影线 */}
        <line 
          x1="3" y1={size.height - 1} 
          x2={size.width - 3} y2={size.height - 1} 
          stroke={darkerColor} 
          strokeWidth="1" 
          opacity="0.3"
        />
      </svg>
      
      {/* 选中边框 */}
      {selected && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            border: '2px solid #FF6B00',
            borderRadius: '2px',
            boxShadow: '0 0 0 3px rgba(255,107,0,0.2)'
          }}
        />
      )}
      
      {/* 内容区域 */}
      <div className="absolute inset-0 p-3 overflow-auto" style={{ paddingRight: foldSize + 8 }}>
        {isEditing ? (
          <textarea 
            ref={textareaRef} 
            value={editText} 
            onChange={(e) => setEditText(e.target.value)} 
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Escape') { setIsEditing(false); setEditText(text); } e.stopPropagation(); }}
            className="nodrag w-full h-full bg-transparent border-none outline-none resize-none"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6, color: textColor, fontWeight }} 
            placeholder="输入内容..."
          />
        ) : text ? (
          <p 
            className="whitespace-pre-wrap break-words cursor-text" 
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6, color: textColor, fontWeight }}
          >
            {text}
          </p>
        ) : (
          <p className="text-gray-400 italic text-sm cursor-text">双击编辑...</p>
        )}
      </div>
    </div>
  );
};

// 箭头节点 - 简化版：固定起点，通过旋转和长度控制
const ArrowNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const length = config.length ?? 120;
  const rotation = config.rotation ?? 0; // 角度制
  const color = config.color || '#3B82F6';
  const strokeWidth = config.strokeWidth || 2;
  const text = config.text ?? '';
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const [localLength, setLocalLength] = React.useState(length);
  const [localRotation, setLocalRotation] = React.useState(rotation);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0, length: 0, rotation: 0 });

  React.useEffect(() => { setEditText(config.text ?? ''); }, [config.text]);
  React.useEffect(() => { setLocalLength(config.length ?? 120); }, [config.length]);
  React.useEffect(() => { setLocalRotation(config.rotation ?? 0); }, [config.rotation]);
  React.useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); };
  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== text) {
      window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, text: editText } }));
    }
  };

  // 拖拽末端手柄
  const handleEndDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, length: localLength, rotation: localRotation };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      // 计算新的角度和长度
      const startRad = (dragStart.current.rotation * Math.PI) / 180;
      const oldEndX = dragStart.current.length * Math.cos(startRad);
      const oldEndY = dragStart.current.length * Math.sin(startRad);
      const newEndX = oldEndX + dx;
      const newEndY = oldEndY + dy;
      
      const newLength = Math.max(30, Math.sqrt(newEndX * newEndX + newEndY * newEndY));
      const newRotation = (Math.atan2(newEndY, newEndX) * 180) / Math.PI;
      
      setLocalLength(newLength);
      setLocalRotation(newRotation);
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.dispatchEvent(new CustomEvent('annotationUpdate', { 
        detail: { nodeId: id, length: localLength, rotation: localRotation } 
      }));
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const arrowHeadSize = Math.min(14, localLength * 0.15);
  const rad = (localRotation * Math.PI) / 180;
  const endX = localLength * Math.cos(rad);
  const endY = localLength * Math.sin(rad);
  
  // 箭头头部
  const tipAngle1 = rad + Math.PI * 0.85;
  const tipAngle2 = rad - Math.PI * 0.85;
  const tip1X = endX + arrowHeadSize * Math.cos(tipAngle1);
  const tip1Y = endY + arrowHeadSize * Math.sin(tipAngle1);
  const tip2X = endX + arrowHeadSize * Math.cos(tipAngle2);
  const tip2Y = endY + arrowHeadSize * Math.sin(tipAngle2);

  // 容器尺寸
  const padding = 20;
  const minX = Math.min(0, endX, tip1X, tip2X);
  const maxX = Math.max(0, endX, tip1X, tip2X);
  const minY = Math.min(0, endY, tip1Y, tip2Y);
  const maxY = Math.max(0, endY, tip1Y, tip2Y);
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const ox = -minX + padding;
  const oy = -minY + padding;

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} onDoubleClick={handleDoubleClick}>
        <line x1={ox} y1={oy} x2={ox + endX - arrowHeadSize * 0.4 * Math.cos(rad)} y2={oy + endY - arrowHeadSize * 0.4 * Math.sin(rad)} 
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        <polygon points={`${ox + endX},${oy + endY} ${ox + tip1X},${oy + tip1Y} ${ox + tip2X},${oy + tip2Y}`} fill={color} />
      </svg>
      
      {/* 文本 */}
      {(editText || isEditing) && (
        <div className="absolute flex items-center justify-center" 
          style={{ left: ox + endX / 2, top: oy + endY / 2, transform: 'translate(-50%, -50%)', pointerEvents: isEditing ? 'auto' : 'none' }}>
          {isEditing ? (
            <input ref={inputRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') inputRef.current?.blur(); }}
              onClick={(e) => e.stopPropagation()} 
              className="nodrag bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-center outline-none shadow-sm" style={{ minWidth: 60 }} />
          ) : (
            <span className="bg-white/95 px-2 py-0.5 rounded text-xs text-gray-700 shadow-sm whitespace-nowrap">{editText}</span>
          )}
        </div>
      )}

      {/* 起点 */}
      {selected && <div className="absolute w-3 h-3 bg-white border-2 border-gray-400 rounded-full pointer-events-none" style={{ left: ox - 6, top: oy - 6 }} />}
      
      {/* 末端拖拽手柄 */}
      {selected && (
        <div className="nodrag absolute w-4 h-4 bg-white border-2 border-primary rounded-full cursor-crosshair z-10 hover:scale-125 transition-transform" 
          style={{ left: ox + endX - 8, top: oy + endY - 8 }} 
          onMouseDown={handleEndDrag} />
      )}

      {selected && <div className="absolute inset-0 border-2 border-primary/20 rounded pointer-events-none" />}
    </div>
  );
};

// 图片节点 - 拍立得卡片风格
const ImageNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const src = config.src || '';
  const initialWidth = config.width || 200;
  const initialHeight = config.height || 150;
  
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { 
    setSize({ width: config.width || 200, height: config.height || 150 }); 
  }, [config.width, config.height]);

  // 双击选择图片
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // 处理图片选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        window.dispatchEvent(new CustomEvent('annotationUpdate', { 
          detail: { nodeId: id, src: base64 } 
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // 重置以便再次选择同一文件
  };

  // 拍立得卡片的底部留白
  const paddingBottom = Math.max(24, size.height * 0.15);

  return (
    <div 
      className="relative" 
      style={{ 
        width: size.width, 
        height: size.height + paddingBottom, 
        minWidth: 80, 
        minHeight: 100 
      }}
      onDoubleClick={handleDoubleClick}
    >
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange} 
      />
      
      <NodeResizer 
        minWidth={80} 
        minHeight={100} 
        isVisible={selected} 
        lineClassName="!border-primary !border-2" 
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-primary !rounded-full"
        onResize={(_, params) => {
          const newHeight = Math.max(50, params.height - paddingBottom);
          setSize({ width: params.width, height: newHeight });
        }}
        onResizeEnd={(_, params) => {
          const newHeight = Math.max(50, params.height - paddingBottom);
          window.dispatchEvent(new CustomEvent('annotationUpdate', { 
            detail: { nodeId: id, width: params.width, height: newHeight } 
          }));
        }}
      />
      
      {/* 大头钉 - 选中时钉子被拔出的效果 */}
      <div 
        className="absolute z-10 pointer-events-none transition-transform duration-200"
        style={{ 
          top: selected ? -14 : -6, 
          right: 12,
          transform: selected ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <svg width="20" height="32" viewBox="0 0 20 32" fill="none">
          {/* 钉子阴影 - 选中时阴影变大变远 */}
          <ellipse 
            cx="11" 
            cy={selected ? 30 : 26} 
            rx={selected ? 5 : 4} 
            ry={selected ? 2 : 1.5} 
            fill={selected ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.15)"} 
          />
          {/* 钉针 - 选中时露出更多 */}
          <path 
            d={selected ? "M10 12 L10 28" : "M10 12 L10 24"} 
            stroke="#9CA3AF" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />
          <circle cx="10" cy="10" r="8" fill="url(#pinGradient)" />
          <circle cx="7" cy="7" r="2.5" fill="rgba(255,255,255,0.6)" />
          <defs>
            <radialGradient id="pinGradient" cx="0.3" cy="0.3" r="0.7">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#B91C1C" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      
      {/* 拍立得卡片主体 - 选中时立体浮出效果 */}
      <div 
        className="w-full h-full bg-white rounded-sm"
        style={{ 
          padding: '8px 8px ' + paddingBottom + 'px 8px',
          boxShadow: selected 
            ? '0 20px 40px rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.15), 0 0 0 2px rgba(255,107,0,0.3)' 
            : '0 4px 20px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          transform: selected ? 'translateY(-8px) scale(1.02)' : 'rotate(0.5deg)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        {/* 图片区域 */}
        <div className="w-full h-full bg-gray-100 overflow-hidden flex items-center justify-center">
          {src ? (
            <img src={src} alt="" className="max-w-full max-h-full object-contain" draggable={false} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 cursor-pointer hover:text-gray-400 transition-colors">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-xs">双击选择图片</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 分组框节点 - 支持缩放和颜色配置
const GroupBoxNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const title = config.title || '分组';
  const initialWidth = config.width || 300;
  const initialHeight = config.height || 200;
  const borderColor = config.borderColor || '#D1D5DB';
  const backgroundColor = config.backgroundColor || 'transparent';
  const fontWeight = config.fontWeight || 'normal';
  
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(title);
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setEditTitle(config.title || '分组'); }, [config.title]);
  React.useEffect(() => { setSize({ width: config.width || 300, height: config.height || 200 }); }, [config.width, config.height]);
  React.useEffect(() => { if (isEditingTitle && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditingTitle]);

  const handleTitleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditingTitle(true); };
  const handleBlur = () => {
    setIsEditingTitle(false);
    if (editTitle !== title) {
      window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, title: editTitle } }));
    }
  };

  return (
    <div className="relative" style={{ width: size.width, height: size.height, minWidth: 150, minHeight: 100, pointerEvents: 'none' }}>
      <NodeResizer minWidth={150} minHeight={100} isVisible={selected} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-white !border-2 !border-primary !rounded"
        onResize={(_, params) => setSize({ width: params.width, height: params.height })}
        onResizeEnd={(_, params) => {
          window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, width: params.width, height: params.height } }));
        }}
      />
      <div className={`absolute inset-0 rounded-xl border-2 border-dashed ${selected ? 'border-primary' : ''}`} style={{ borderColor: selected ? undefined : borderColor, backgroundColor, pointerEvents: 'stroke' }} />
      <div className="absolute -top-3 left-3 px-2 py-0.5 rounded text-xs text-gray-600 cursor-text bg-[#fafafa]" style={{ pointerEvents: 'auto', fontWeight }} onDoubleClick={handleTitleDoubleClick}>
        {isEditingTitle ? (
          <input ref={inputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setIsEditingTitle(false); if (e.key === 'Escape') setEditTitle(title); } e.stopPropagation(); }}
            className="nodrag bg-transparent border-none outline-none w-20 text-xs" style={{ fontWeight }}
          />
        ) : editTitle}
      </div>
    </div>
  );
};


// 状态节点 - 支持缩放和颜色配置
const StateNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const text = config.text ?? '状态';
  const stateType = config.stateType || 'normal';
  const borderColor = config.borderColor || '#8B5CF6';
  const backgroundColor = config.backgroundColor || '#FFFFFF';
  const fontWeight = config.fontWeight || 'normal';
  const initialWidth = config.width || 100;
  const initialHeight = config.height || 40;
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setEditText(config.text ?? '状态'); }, [config.text]);
  React.useEffect(() => { setSize({ width: config.width || 100, height: config.height || 40 }); }, [config.width, config.height]);
  React.useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); };
  const handleBlur = () => {
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, text: editText } }));
  };

  if (stateType === 'initial') {
    return (
      <div className={`relative ${selected ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''}`}>
        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: borderColor }} />
      </div>
    );
  }

  if (stateType === 'final') {
    return (
      <div className={`relative ${selected ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''}`}>
        <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center" style={{ borderColor }}>
          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: borderColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size.width, height: size.height, minWidth: 60, minHeight: 30 }} onDoubleClick={handleDoubleClick}>
      <NodeResizer minWidth={60} minHeight={30} isVisible={selected} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-white !border-2 !border-primary !rounded"
        onResize={(_, params) => setSize({ width: params.width, height: params.height })}
        onResizeEnd={(_, params) => {
          window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, width: params.width, height: params.height } }));
        }}
      />
      <div className="w-full h-full rounded-xl border-2 flex items-center justify-center" style={{ borderColor, backgroundColor }}>
        {isEditing ? (
          <input ref={inputRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') inputRef.current?.blur(); }}
            className="nodrag bg-transparent border-none outline-none text-center text-sm w-full px-2" style={{ color: borderColor, fontWeight }}
          />
        ) : (
          <span className="text-sm" style={{ color: borderColor, fontWeight }}>{editText}</span>
        )}
      </div>
    </div>
  );
};

// 参与者节点 - 支持缩放和颜色配置
const ActorNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const text = config.text ?? '参与者';
  const color = config.color || '#374151';
  const fontWeight = config.fontWeight || 'normal';
  const initialScale = config.scale || 1;
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const [scale, setScale] = React.useState(initialScale);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const baseWidth = 40;
  const baseHeight = 50;

  React.useEffect(() => { setEditText(config.text ?? '参与者'); }, [config.text]);
  React.useEffect(() => { setScale(config.scale || 1); }, [config.scale]);
  React.useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); };
  const handleBlur = () => {
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, text: editText } }));
  };

  return (
    <div 
      className={`relative flex flex-col items-center ${selected ? 'ring-2 ring-primary ring-offset-2 rounded-lg p-1' : ''}`} 
      style={{ width: baseWidth * scale + 10, height: baseHeight * scale + 30 }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer minWidth={30} minHeight={50} isVisible={selected} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-white !border-2 !border-primary !rounded"
        onResize={(_, params) => {
          const newScale = Math.max(0.5, Math.min(params.width / (baseWidth + 10), (params.height - 20) / baseHeight));
          setScale(newScale);
        }}
        onResizeEnd={(_, params) => {
          const newScale = Math.max(0.5, Math.min(params.width / (baseWidth + 10), (params.height - 20) / baseHeight));
          window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, scale: newScale } }));
        }}
      />
      <svg width={baseWidth * scale} height={baseHeight * scale} viewBox="0 0 40 50" fill="none" stroke={color} strokeWidth="2">
        <circle cx="20" cy="8" r="7" />
        <line x1="20" y1="15" x2="20" y2="32" />
        <line x1="5" y1="22" x2="35" y2="22" />
        <line x1="20" y1="32" x2="8" y2="48" />
        <line x1="20" y1="32" x2="32" y2="48" />
      </svg>
      {isEditing ? (
        <input ref={inputRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') inputRef.current?.blur(); }}
          className="nodrag bg-transparent border-none outline-none text-center text-xs mt-1 w-20" style={{ color, fontWeight }}
        />
      ) : (
        <span className="text-xs mt-1" style={{ color, fontWeight }}>{editText}</span>
      )}
    </div>
  );
};

// 文本标签节点 - 支持缩放和颜色配置
const TextLabelNode: React.FC<CustomNodeProps> = ({ id, data, selected }) => {
  const config = data.config || {};
  const text = config.text || '文本';
  const fontSize = config.fontSize || 14;
  const color = config.color || '#374151';
  const fontWeight = config.fontWeight || 'normal';
  const backgroundColor = config.backgroundColor || 'transparent';
  const initialWidth = config.width || 100;
  const initialHeight = config.height || 30;
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(text);
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setEditText(config.text || '文本'); }, [config.text]);
  React.useEffect(() => { setSize({ width: config.width || 100, height: config.height || 30 }); }, [config.width, config.height]);
  React.useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditing(true); };
  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== text) {
      window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, text: editText } }));
    }
  };

  return (
    <div className="relative" style={{ width: size.width, height: size.height, minWidth: 50, minHeight: 20, backgroundColor, borderRadius: 4 }} onDoubleClick={handleDoubleClick}>
      <NodeResizer minWidth={50} minHeight={20} isVisible={selected} lineClassName="!border-primary" handleClassName="!w-2 !h-2 !bg-white !border-2 !border-primary !rounded"
        onResize={(_, params) => setSize({ width: params.width, height: params.height })}
        onResizeEnd={(_, params) => {
          window.dispatchEvent(new CustomEvent('annotationUpdate', { detail: { nodeId: id, width: params.width, height: params.height } }));
        }}
      />
      <div className="w-full h-full flex items-center justify-center">
        {isEditing ? (
          <input ref={inputRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') inputRef.current?.blur(); }}
            className="nodrag bg-transparent border-none outline-none text-center w-full" style={{ fontSize, color, fontWeight }}
          />
        ) : (
          <span className="whitespace-nowrap" style={{ fontSize, color, fontWeight }}>{editText}</span>
        )}
      </div>
    </div>
  );
};

// 通用节点组件
export const UniversalNode: React.FC<CustomNodeProps> = (props) => {
  const shape = props.data.template?.shape || 'rectangle';
  switch (shape) {
    case 'diamond': return <DiamondNode {...props} />;
    case 'hexagon': return <HexagonNode {...props} />;
    case 'circle': return <CircleNode {...props} />;
    case 'rounded': return <RoundedNode {...props} />;
    case 'sticky': return <StickyNoteNode {...props} />;
    case 'group': return <GroupBoxNode {...props} />;
    default: return <RectangleNode {...props} />;
  }
};

// 导出节点类型映射
export const createNodeTypes = (templates: NodeTemplate[]) => {
  const types: Record<string, React.FC<any>> = {};
  
  templates.forEach(template => {
    types[template.type] = (props: any) => <UniversalNode {...props} data={{ ...props.data, template }} />;
  });
  
  // 默认类型
  if (!types['MANUAL_TRIGGER']) types['MANUAL_TRIGGER'] = (props: any) => <UniversalNode {...props} />;
  if (!types['INPUT']) types['INPUT'] = (props: any) => <UniversalNode {...props} />;
  if (!types['AI_MODEL']) types['AI_MODEL'] = (props: any) => <UniversalNode {...props} />;
  
  // 辅助工具节点
  types['STICKY_NOTE'] = (props: any) => <StickyNoteNode {...props} />;
  types['GROUP_BOX'] = (props: any) => <GroupBoxNode {...props} />;
  types['ARROW'] = (props: any) => <ArrowNode {...props} />;
  types['STATE'] = (props: any) => <StateNode {...props} />;
  types['ACTOR'] = (props: any) => <ActorNode {...props} />;
  types['TEXT_LABEL'] = (props: any) => <TextLabelNode {...props} />;
  types['IMAGE'] = (props: any) => <ImageNode {...props} />;
  
  return types;
};
