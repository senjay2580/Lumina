// 文档内搜索组件 - 支持 Ctrl+F 快捷键
// 使用 CSS Custom Highlight API 或 mark 元素实现高亮
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

export interface SearchMatch {
  index: number;
  start: number;
  end: number;
  text: string;
  context: string;
  node?: Text;
  nodeOffset?: number;
}

interface SearchOverlayProps {
  // 搜索的内容
  content: string;
  // 是否启用（默认启用）
  enabled?: boolean;
  // 自定义快捷键（默认 Ctrl+F）
  shortcut?: { key: string; ctrlKey?: boolean; metaKey?: boolean };
  // 搜索结果回调
  onSearchResults?: (matches: SearchMatch[], currentIndex: number) => void;
  // 跳转到匹配项回调
  onNavigateToMatch?: (match: SearchMatch) => void;
  // 关闭搜索回调
  onClose?: () => void;
  // 自定义样式
  className?: string;
  // 位置
  position?: 'top' | 'bottom';
  // 编辑器容器选择器（用于在 DOM 中查找和高亮）
  editorSelector?: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  enabled = true,
  shortcut = { key: 'f', ctrlKey: true },
  onSearchResults,
  onNavigateToMatch,
  onClose: onCloseCallback,
  className = '',
  position = 'top',
  editorSelector = '.ProseMirror'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 清除所有高亮
  const clearHighlights = useCallback(() => {
    const editor = document.querySelector(editorSelector);
    if (!editor) return;
    
    // 移除所有高亮 mark 元素
    const marks = editor.querySelectorAll('mark[data-search-highlight]');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        const text = document.createTextNode(mark.textContent || '');
        parent.replaceChild(text, mark);
        parent.normalize(); // 合并相邻文本节点
      }
    });
  }, [editorSelector]);

  // 在 DOM 中高亮匹配项
  const highlightInDOM = useCallback((searchQuery: string, activeIndex: number) => {
    const editor = document.querySelector(editorSelector);
    if (!editor || !searchQuery.trim()) return [];

    // 先清除旧高亮
    clearHighlights();

    const results: SearchMatch[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    
    // 遍历所有文本节点
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Text | null;
    
    while ((node = walker.nextNode() as Text)) {
      textNodes.push(node);
    }

    // 在文本节点中查找并高亮
    textNodes.forEach(textNode => {
      const nodeText = textNode.textContent || '';
      const lowerNodeText = nodeText.toLowerCase();
      let startIndex = 0;
      let foundIndex: number;
      const fragments: (string | HTMLElement)[] = [];
      let lastEnd = 0;

      while ((foundIndex = lowerNodeText.indexOf(lowerQuery, startIndex)) !== -1) {
        const matchIndex = results.length;
        const isActive = matchIndex === activeIndex;
        
        // 添加匹配前的文本
        if (foundIndex > lastEnd) {
          fragments.push(nodeText.slice(lastEnd, foundIndex));
        }
        
        // 创建高亮 mark 元素
        const mark = document.createElement('mark');
        mark.setAttribute('data-search-highlight', 'true');
        mark.setAttribute('data-match-index', String(matchIndex));
        mark.className = isActive 
          ? 'bg-orange-400 text-white rounded px-0.5' 
          : 'bg-yellow-200 rounded px-0.5';
        mark.textContent = nodeText.slice(foundIndex, foundIndex + searchQuery.length);
        fragments.push(mark);
        
        // 记录匹配信息
        results.push({
          index: matchIndex,
          start: foundIndex,
          end: foundIndex + searchQuery.length,
          text: nodeText.slice(foundIndex, foundIndex + searchQuery.length),
          context: nodeText.slice(Math.max(0, foundIndex - 20), Math.min(nodeText.length, foundIndex + searchQuery.length + 20)),
          node: textNode,
          nodeOffset: foundIndex
        });

        lastEnd = foundIndex + searchQuery.length;
        startIndex = foundIndex + 1;
      }

      // 如果有匹配，替换文本节点
      if (fragments.length > 0) {
        // 添加剩余文本
        if (lastEnd < nodeText.length) {
          fragments.push(nodeText.slice(lastEnd));
        }

        const parent = textNode.parentNode;
        if (parent) {
          const wrapper = document.createDocumentFragment();
          fragments.forEach(frag => {
            if (typeof frag === 'string') {
              wrapper.appendChild(document.createTextNode(frag));
            } else {
              wrapper.appendChild(frag);
            }
          });
          parent.replaceChild(wrapper, textNode);
        }
      }
    });

    return results;
  }, [editorSelector, clearHighlights]);

  // 更新当前高亮项的样式
  const updateActiveHighlight = useCallback((newIndex: number) => {
    const editor = document.querySelector(editorSelector);
    if (!editor) return;

    // 重置所有高亮为普通样式
    const marks = editor.querySelectorAll('mark[data-search-highlight]');
    marks.forEach(mark => {
      mark.className = 'bg-yellow-200 rounded px-0.5';
    });

    // 设置当前项为活动样式
    const activeMark = editor.querySelector(`mark[data-match-index="${newIndex}"]`);
    if (activeMark) {
      activeMark.className = 'bg-orange-400 text-white rounded px-0.5';
      // 滚动到视图
      activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editorSelector]);

  // 搜索逻辑 - 直接在 DOM 中高亮
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      clearHighlights();
      setMatches([]);
      setCurrentIndex(0);
      onSearchResults?.([], 0);
      return;
    }

    // 延迟执行以确保 DOM 已更新
    requestAnimationFrame(() => {
      const results = highlightInDOM(searchQuery, 0);
      setMatches(results);
      setCurrentIndex(results.length > 0 ? 0 : -1);
      onSearchResults?.(results, 0);

      // 自动跳转到第一个匹配
      if (results.length > 0) {
        onNavigateToMatch?.(results[0]);
      }
    });
  }, [highlightInDOM, clearHighlights, onSearchResults, onNavigateToMatch]);

  // 监听快捷键
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const matchesShortcut = 
        e.key.toLowerCase() === shortcut.key &&
        (shortcut.ctrlKey ? e.ctrlKey || e.metaKey : true) &&
        (shortcut.metaKey ? e.metaKey : true);

      if (matchesShortcut) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }

      // ESC 关闭
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setMatches([]);
      }

      // Enter 跳转到下一个
      if (e.key === 'Enter' && isOpen && matches.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          navigatePrev();
        } else {
          navigateNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, shortcut, isOpen, matches]);

  // 搜索输入变化
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const navigateNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIndex);
    updateActiveHighlight(nextIndex);
    onNavigateToMatch?.(matches[nextIndex]);
    onSearchResults?.(matches, nextIndex);
  };

  const navigatePrev = () => {
    if (matches.length === 0) return;
    const prevIndex = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prevIndex);
    updateActiveHighlight(prevIndex);
    onNavigateToMatch?.(matches[prevIndex]);
    onSearchResults?.(matches, prevIndex);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setMatches([]);
    clearHighlights();
    onSearchResults?.([], 0);
    onCloseCallback?.();
  };

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          transition={{ duration: 0.15 }}
          className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 ${className}`}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-80">
            {/* 搜索输入 */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索内容..."
                className="flex-1 text-sm outline-none bg-transparent"
                autoFocus
              />
              {query && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '无结果'}
                </span>
              )}
              <button
                onClick={close}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* 导航按钮 */}
            {matches.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                <div className="flex items-center gap-1">
                  <button
                    onClick={navigatePrev}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="上一个 (Shift+Enter)"
                  >
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={navigateNext}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="下一个 (Enter)"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <span className="text-xs text-gray-500">
                  Enter 下一个 · Shift+Enter 上一个
                </span>
              </div>
            )}

            {/* 无结果提示 */}
            {query && matches.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                <AlertCircle className="w-4 h-4" />
                未找到匹配内容
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 高亮文本的工具函数
export function highlightText(
  text: string,
  query: string,
  highlightClass: string = 'bg-yellow-200'
): React.ReactNode {
  if (!query.trim()) return text;

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerQuery);
  while (index !== -1) {
    // 添加匹配前的文本
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    // 添加高亮的匹配文本
    parts.push(
      <mark key={index} className={highlightClass}>
        {text.slice(index, index + query.length)}
      </mark>
    );
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// Hook: 使用搜索功能
export function useDocumentSearch(content: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const handleSearchResults = useCallback((newMatches: SearchMatch[], index: number) => {
    setMatches(newMatches);
    setCurrentMatchIndex(index);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    matches,
    currentMatchIndex,
    handleSearchResults,
    SearchOverlayComponent: (
      <SearchOverlay
        content={content}
        onSearchResults={handleSearchResults}
      />
    )
  };
}

export default SearchOverlay;
