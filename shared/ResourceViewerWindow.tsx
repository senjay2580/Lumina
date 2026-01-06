import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Minus, Download, ExternalLink, Maximize2, Minimize2, Loader2, Sun, Moon, Copy, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ResourceTab } from '../lib/useResourceViewer';
import { downloadFile } from '../lib/resources';
import { marked } from 'marked';
import { FileTypeIcon } from './FileTypeIcon';

// 配置 marked 选项
marked.setOptions({
  breaks: true,      // 支持 GFM 换行
  gfm: true,         // 启用 GitHub Flavored Markdown
});

// 判断是否是 Markdown 文件
const isMarkdownFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext === 'md';
};

interface Props {
  tabs: ResourceTab[];
  activeTabId: string | null;
  isMinimizing: boolean;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onMinimize: () => void;
  onClose: () => void;
}

// 图片查看器组件（支持缩放）
const ImageViewer: React.FC<{ url: string; title: string; isDark: boolean }> = ({ url, title, isDark }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 鼠标滚轮缩放 - 使用 useEffect 添加非 passive 事件监听器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.max(0.25, Math.min(5, s + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 拖拽移动
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center overflow-hidden relative ${isDark ? 'bg-[#252526]' : 'bg-gray-100'}`}
    >
      {/* 图片 */}
      <img
        src={url}
        alt={title}
        draggable={false}
        onMouseDown={handleMouseDown}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        className="max-w-full max-h-full object-contain select-none"
      />

      {/* 缩放控制栏 */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl ${
        isDark ? 'bg-[#2d2d2d] border border-[#3c3c3c]' : 'bg-white border border-gray-200 shadow-lg'
      }`}>
        <button
          onClick={handleZoomOut}
          disabled={scale <= 0.25}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
            isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className={`px-2 text-xs font-medium min-w-[50px] text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={scale >= 5}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
            isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className={`w-px h-4 mx-1 ${isDark ? 'bg-[#3c3c3c]' : 'bg-gray-200'}`} />
        <button
          onClick={handleReset}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="重置"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// 文本文件预览组件
const TextFileViewer: React.FC<{ url: string; fileName: string; isDark: boolean }> = ({ url, fileName, isDark }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isMarkdown = isMarkdownFile(fileName);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        // 尝试用 UTF-8 解码
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        setContent(text);
        setError(null);
      } catch (err) {
        setError('无法加载文件内容');
        console.error('Failed to load text file:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [url]);

  // 解析 Markdown 内容
  const htmlContent = useMemo(() => {
    if (!content || !isMarkdown) return '';
    try {
      return marked.parse(content) as string;
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return content;
    }
  }, [content, isMarkdown]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-auto p-4 relative ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-50'}`}>
      {/* 复制按钮 */}
      <button
        onClick={handleCopy}
        className={`absolute top-6 right-6 p-2 rounded-lg transition-all z-10 ${
          isDark 
            ? 'bg-[#2d2d2d] hover:bg-[#3c3c3c] text-gray-400' 
            : 'bg-white hover:bg-gray-100 text-gray-500 shadow-sm'
        }`}
        title="复制内容"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>

      {isMarkdown ? (
        <div 
          className={`markdown-body rounded-lg p-6 ${
            isDark ? 'markdown-dark' : 'bg-white shadow-sm'
          }`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <pre className={`text-sm whitespace-pre-wrap font-mono rounded-lg p-4 ${
          isDark 
            ? 'bg-[#1e1e1e] text-[#d4d4d4]' 
            : 'bg-white text-gray-700 shadow-sm'
        }`}>
          {content}
        </pre>
      )}

      {/* Markdown 样式 */}
      <style>{`
        .markdown-body {
          font-size: 15px;
          line-height: 1.7;
          color: #24292f;
          word-wrap: break-word;
        }
        .markdown-body > *:first-child { margin-top: 0 !important; }
        .markdown-body > *:last-child { margin-bottom: 0 !important; }
        
        /* 标题 */
        .markdown-body h1, .markdown-body h2, .markdown-body h3, 
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
        }
        .markdown-body h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        .markdown-body h3 { font-size: 1.25em; }
        .markdown-body h4 { font-size: 1em; }
        .markdown-body h5 { font-size: 0.875em; }
        .markdown-body h6 { font-size: 0.85em; color: #57606a; }
        
        /* 段落和文本 */
        .markdown-body p { margin-top: 0; margin-bottom: 16px; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body em { font-style: italic; }
        .markdown-body del { text-decoration: line-through; }
        
        /* 列表 */
        .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-top: 0; margin-bottom: 16px; }
        .markdown-body ul { list-style-type: disc; }
        .markdown-body ol { list-style-type: decimal; }
        .markdown-body li { margin-bottom: 4px; }
        .markdown-body li::marker { color: #57606a; }
        .markdown-body li + li { margin-top: 0.25em; }
        .markdown-body ul ul, .markdown-body ul ol, .markdown-body ol ul, .markdown-body ol ol {
          margin-top: 0;
          margin-bottom: 0;
        }
        
        /* 任务列表 */
        .markdown-body input[type="checkbox"] {
          margin-right: 8px;
          vertical-align: middle;
        }
        
        /* 行内代码 */
        .markdown-body code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(175,184,193,0.2);
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
        }
        
        /* 代码块 */
        .markdown-body pre {
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: #f6f8fa;
          border-radius: 6px;
          margin-bottom: 16px;
        }
        .markdown-body pre code {
          padding: 0;
          margin: 0;
          font-size: 100%;
          background-color: transparent;
          border: 0;
          display: inline;
          overflow: visible;
          line-height: inherit;
          word-wrap: normal;
        }
        
        /* 引用块 */
        .markdown-body blockquote {
          padding: 0 1em;
          color: #57606a;
          border-left: 0.25em solid #d0d7de;
          margin: 0 0 16px 0;
        }
        .markdown-body blockquote > :first-child { margin-top: 0; }
        .markdown-body blockquote > :last-child { margin-bottom: 0; }
        
        /* 链接 */
        .markdown-body a { color: #0969da; text-decoration: none; }
        .markdown-body a:hover { text-decoration: underline; }
        
        /* 分割线 */
        .markdown-body hr { 
          height: 0.25em; 
          padding: 0; 
          margin: 24px 0; 
          background-color: #d0d7de; 
          border: 0; 
          border-radius: 2px;
        }
        
        /* 表格 */
        .markdown-body table { 
          border-collapse: collapse; 
          margin-bottom: 16px; 
          width: 100%;
          display: block;
          overflow: auto;
        }
        .markdown-body table th, .markdown-body table td { 
          padding: 6px 13px; 
          border: 1px solid #d0d7de; 
        }
        .markdown-body table th { font-weight: 600; background-color: #f6f8fa; }
        .markdown-body table tr { background-color: #ffffff; border-top: 1px solid #d0d7de; }
        .markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
        
        /* 图片 */
        .markdown-body img { 
          max-width: 100%; 
          box-sizing: border-box;
          border-radius: 6px;
        }

        /* ========== 夜间模式 ========== */
        .markdown-dark {
          background-color: #0d1117;
          color: #c9d1d9;
        }
        .markdown-dark h1, .markdown-dark h2, .markdown-dark h3,
        .markdown-dark h4, .markdown-dark h5, .markdown-dark h6 {
          color: #c9d1d9;
        }
        .markdown-dark h1, .markdown-dark h2 { border-bottom-color: #30363d; }
        .markdown-dark h6 { color: #8b949e; }
        .markdown-dark code { background-color: rgba(110,118,129,0.4); color: #c9d1d9; }
        .markdown-dark pre { background-color: #161b22; }
        .markdown-dark pre code { color: #c9d1d9; }
        .markdown-dark blockquote { color: #8b949e; border-left-color: #30363d; }
        .markdown-dark a { color: #58a6ff; }
        .markdown-dark hr { background-color: #30363d; }
        .markdown-dark table th, .markdown-dark table td { border-color: #30363d; }
        .markdown-dark table th { background-color: #161b22; }
        .markdown-dark table tr { background-color: #0d1117; border-top-color: #30363d; }
        .markdown-dark table tr:nth-child(2n) { background-color: #161b22; }
        .markdown-dark li::marker { color: #8b949e; }
        .markdown-dark strong { color: #c9d1d9; }
      `}</style>
    </div>
  );
};

// 判断是否是文本文件
const isTextFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml', 'log', 'csv'].includes(ext);
};

export const ResourceViewerWindow: React.FC<Props> = ({
  tabs,
  activeTabId,
  isMinimizing,
  onTabChange,
  onTabClose,
  onMinimize,
  onClose,
}) => {
  const [position, setPosition] = useState({ x: 100, y: 80 });
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const savedStateRef = useRef({ position: { x: 100, y: 80 }, size: { width: 900, height: 600 } });

  const activeTab = tabs.find(t => t.id === activeTabId);

  // 拖拽处理
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(0, dragStartRef.current.posX + dx),
        y: Math.max(0, dragStartRef.current.posY + dy),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 缩放处理
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;
      let newX = resizeStartRef.current.posX;
      let newY = resizeStartRef.current.posY;

      if (isResizing.includes('e')) newWidth = Math.max(400, resizeStartRef.current.width + dx);
      if (isResizing.includes('w')) {
        newWidth = Math.max(400, resizeStartRef.current.width - dx);
        newX = resizeStartRef.current.posX + (resizeStartRef.current.width - newWidth);
      }
      if (isResizing.includes('s')) newHeight = Math.max(300, resizeStartRef.current.height + dy);
      if (isResizing.includes('n')) {
        newHeight = Math.max(300, resizeStartRef.current.height - dy);
        newY = resizeStartRef.current.posY + (resizeStartRef.current.height - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    setIsDragging(true);
  };

  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      width: size.width, height: size.height,
      posX: position.x, posY: position.y,
    };
    setIsResizing(direction);
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(savedStateRef.current.position);
      setSize(savedStateRef.current.size);
    } else {
      savedStateRef.current = { position, size };
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    setIsMaximized(!isMaximized);
  };

  const handleDownload = async () => {
    if (activeTab?.resource.storage_path && activeTab?.resource.file_name) {
      try {
        await downloadFile(activeTab.resource.storage_path, activeTab.resource.file_name);
      } catch (err) {
        console.error('Failed to download:', err);
      }
    }
  };

  const getTabIcon = (tab: ResourceTab) => {
    if (tab.resource.type === 'image') {
      return <FileTypeIcon fileName={tab.resource.file_name || 'image.jpg'} className="w-3.5 h-3.5" />;
    }
    return <FileTypeIcon fileName={tab.resource.file_name || tab.resource.title} className="w-3.5 h-3.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={isMinimizing 
        ? { opacity: 0, scale: 0.8, y: 100 }
        : { opacity: 1, scale: 1, y: 0 }
      }
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 1000,
      }}
      className={`flex flex-col rounded-xl shadow-2xl overflow-hidden ${
        isDark 
          ? 'bg-[#1e1e1e] border border-[#3c3c3c]' 
          : 'bg-white border border-gray-200'
      }`}
    >
      {/* 标题栏 */}
      <div
        className={`flex items-center h-10 px-2 select-none ${
          isDark 
            ? 'bg-[#2d2d2d] border-b border-[#3c3c3c]' 
            : 'bg-gray-100 border-b border-gray-200'
        }`}
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        {/* 标签页 */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all max-w-[180px] ${
                tab.id === activeTabId
                  ? isDark 
                    ? 'bg-[#1e1e1e] text-gray-200 shadow-sm' 
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-gray-400 hover:bg-[#3c3c3c]'
                    : 'text-gray-500 hover:bg-gray-200/50'
              }`}
            >
              {getTabIcon(tab)}
              <span className="truncate">{tab.resource.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                className={`ml-1 p-0.5 rounded ${isDark ? 'hover:bg-[#4c4c4c]' : 'hover:bg-gray-300/50'}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* 窗口控制 */}
        <div className="flex items-center gap-1 ml-2">
          {activeTab?.resource.storage_path && (
            <button
              onClick={handleDownload}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
              title="下载"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {activeTab?.resource.url && (
            <button
              onClick={() => window.open(activeTab.resource.url, '_blank')}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
              title="在新标签页打开"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
            title={isDark ? '切换到日间模式' : '切换到夜间模式'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleMaximize}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onMinimize}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#3c3c3c] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className={`flex-1 overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-gray-50'}`}>
        {activeTab ? (
          activeTab.resource.type === 'image' ? (
            <ImageViewer url={activeTab.url} title={activeTab.resource.title} isDark={isDark} />
          ) : activeTab.resource.file_name && isTextFile(activeTab.resource.file_name) ? (
            <TextFileViewer url={activeTab.url} fileName={activeTab.resource.file_name} isDark={isDark} />
          ) : (
            <iframe
              src={activeTab.url}
              className="w-full h-full border-0"
              title={activeTab.resource.title}
            />
          )
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            选择一个资源查看
          </div>
        )}
      </div>

      {/* 缩放边框 */}
      {!isMaximized && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 cursor-n-resize" onMouseDown={handleResizeStart('n')} />
          <div className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize" onMouseDown={handleResizeStart('s')} />
          <div className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize" onMouseDown={handleResizeStart('w')} />
          <div className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize" onMouseDown={handleResizeStart('e')} />
          <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onMouseDown={handleResizeStart('nw')} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onMouseDown={handleResizeStart('ne')} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onMouseDown={handleResizeStart('sw')} />
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={handleResizeStart('se')} />
        </>
      )}
    </motion.div>
  );
};
