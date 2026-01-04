import { useState, useRef, useCallback } from 'react';
import { Prompt, PromptCategory } from './prompts';

export interface PromptBrowserState {
  browserTabs: Prompt[];
  activeTabId: string | null;
  isBrowserMinimized: boolean;
  isMinimizing: boolean;
  categories: PromptCategory[];
  autoEditId: string | null;
  newPromptIds: Set<string>;
  editedPromptIds: Set<string>;
}

export const usePromptBrowser = () => {
  const [browserTabs, setBrowserTabs] = useState<Prompt[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isBrowserMinimized, setIsBrowserMinimized] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const [newPromptIds, setNewPromptIds] = useState<Set<string>>(new Set());
  const [editedPromptIds, setEditedPromptIds] = useState<Set<string>>(new Set());
  // 用于通知 PromptManager 更新本地列表
  const [lastSavedPrompt, setLastSavedPrompt] = useState<{ type: 'create' | 'update'; prompt: Prompt } | null>(null);
  const minimizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openPrompt = useCallback((prompt: Prompt) => {
    if (minimizeTimeoutRef.current) {
      clearTimeout(minimizeTimeoutRef.current);
      minimizeTimeoutRef.current = null;
      setIsMinimizing(false);
    }
    
    setBrowserTabs(prev => {
      const exists = prev.find(t => t.id === prompt.id);
      if (exists) return prev;
      return [...prev, prompt];
    });
    setActiveTabId(prompt.id);
    setIsBrowserMinimized(false);
  }, []);

  const closeTab = useCallback((promptId: string) => {
    setBrowserTabs(prev => {
      const newTabs = prev.filter(t => t.id !== promptId);
      if (activeTabId === promptId) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
      return newTabs;
    });
    setNewPromptIds(prev => { const n = new Set(prev); n.delete(promptId); return n; });
    setEditedPromptIds(prev => { const n = new Set(prev); n.delete(promptId); return n; });
  }, [activeTabId]);


  const handleMinimize = useCallback(() => {
    setIsMinimizing(true);
    minimizeTimeoutRef.current = setTimeout(() => {
      setIsBrowserMinimized(true);
      setIsMinimizing(false);
      minimizeTimeoutRef.current = null;
    }, 350);
  }, []);

  const updateTabPrompt = useCallback((oldId: string, newPrompt: Prompt) => {
    setBrowserTabs(prev => prev.map(t => t.id === oldId ? newPrompt : t));
    setActiveTabId(prev => prev === oldId ? newPrompt.id : prev);
  }, []);

  const clearAllTabs = useCallback(() => {
    setBrowserTabs([]);
    setActiveTabId(null);
    setAutoEditId(null);
    setNewPromptIds(new Set());
    setEditedPromptIds(new Set());
  }, []);

  const addNewPromptId = useCallback((id: string) => {
    setNewPromptIds(prev => new Set(prev).add(id));
  }, []);

  const removeNewPromptId = useCallback((id: string) => {
    setNewPromptIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const addEditedPromptId = useCallback((id: string) => {
    setEditedPromptIds(prev => new Set(prev).add(id));
  }, []);

  const removeEditedPromptId = useCallback((id: string) => {
    setEditedPromptIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  // 通知列表新增提示词
  const notifyPromptCreated = useCallback((prompt: Prompt) => {
    setLastSavedPrompt({ type: 'create', prompt });
  }, []);

  // 通知列表更新提示词
  const notifyPromptUpdated = useCallback((prompt: Prompt) => {
    setLastSavedPrompt({ type: 'update', prompt });
  }, []);

  // 清除通知
  const clearLastSavedPrompt = useCallback(() => {
    setLastSavedPrompt(null);
  }, []);

  return {
    browserTabs,
    activeTabId,
    isBrowserMinimized,
    isMinimizing,
    categories,
    autoEditId,
    newPromptIds,
    editedPromptIds,
    lastSavedPrompt,
    setBrowserTabs,
    setActiveTabId,
    setIsBrowserMinimized,
    setCategories,
    setAutoEditId,
    openPrompt,
    closeTab,
    handleMinimize,
    updateTabPrompt,
    clearAllTabs,
    addNewPromptId,
    removeNewPromptId,
    addEditedPromptId,
    removeEditedPromptId,
    notifyPromptCreated,
    notifyPromptUpdated,
    clearLastSavedPrompt,
  };
};

export type PromptBrowserHook = ReturnType<typeof usePromptBrowser>;
