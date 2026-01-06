import { useState, useCallback, useRef } from 'react';
import { Resource } from './resources';

export interface ResourceTab {
  id: string;
  resource: Resource;
  url: string; // 预览 URL
}

export const useResourceViewer = () => {
  const [tabs, setTabs] = useState<ResourceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const minimizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openResource = useCallback((resource: Resource, url: string) => {
    if (minimizeTimeoutRef.current) {
      clearTimeout(minimizeTimeoutRef.current);
      minimizeTimeoutRef.current = null;
      setIsMinimizing(false);
    }

    setTabs(prev => {
      const exists = prev.find(t => t.id === resource.id);
      if (exists) return prev;
      return [...prev, { id: resource.id, resource, url }];
    });
    setActiveTabId(resource.id);
    setIsMinimized(false);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const handleMinimize = useCallback(() => {
    setIsMinimizing(true);
    minimizeTimeoutRef.current = setTimeout(() => {
      setIsMinimized(true);
      setIsMinimizing(false);
      minimizeTimeoutRef.current = null;
    }, 350);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const clearAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  return {
    tabs,
    activeTabId,
    isMinimized,
    isMinimizing,
    setActiveTabId,
    openResource,
    closeTab,
    handleMinimize,
    restore,
    clearAllTabs,
  };
};

export type ResourceViewerHook = ReturnType<typeof useResourceViewer>;
