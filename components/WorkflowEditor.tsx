import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  SelectionMode,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
  Viewport,
  getRectOfNodes,
  getTransformForBounds,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { WorkflowNode, WorkflowEdge, NodeType, NodeTemplate, Workflow } from '../types';
import { generateId } from './utils';
import { NodeConfigModal } from './NodeConfigModal';
import { ComponentPanel } from './ComponentPanel';
import { ContextMenu, useContextMenu, useToast, ToastContainer, LoadingSpinner, Modal } from '../shared';
import { getStoredUser } from '../lib/auth';
import { getNodeTemplates } from '../lib/components';
import { hasEnabledProvider } from '../lib/ai-providers';
import * as workflowApi from '../lib/workflows';
import { createNodeTypes, ThemeContext } from './CustomNodes';
import { uploadWorkflowImage, getWorkflowImages, deleteWorkflowImage, WorkflowImage } from '../lib/supabase';

// 画布主题配置 - 日间/夜间模式
const canvasThemes = {
  light: {
    name: '日间',
    icon: '☀️',
    bg: '#fafafa',
    gridColor: '#e8e8e8',
    containerBg: '#f8f8f8',
  },
  dark: {
    name: '夜间',
    icon: '🌙',
    bg: '#1e1e1e',
    gridColor: '#333333',
    containerBg: '#252526',
  },
};

interface WorkflowEditorProps {
  onBack?: () => void;
  workflowId?: string;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

// 辅助节点类型（不计入节点数量）
const ANNOTATION_TYPES = ['STICKY_NOTE', 'GROUP_BOX', 'ARROW', 'STATE', 'ACTOR', 'TEXT_LABEL', 'IMAGE'];

// 计算非辅助节点数量
const countWorkflowNodes = (nodes: Node[]) => {
  return nodes.filter(n => !ANNOTATION_TYPES.includes(n.type || '')).length;
};

// 转换函数：内部格式 -> React Flow 格式
const toReactFlowNodes = (nodes: WorkflowNode[], templates: NodeTemplate[], hasProvider: boolean): Node[] => {
  const templateMap = new Map(templates.map(t => [t.type, t]));
  
  return nodes.map(node => {
    const isAnnotation = ANNOTATION_TYPES.includes(node.type);
    const isGroupBox = node.type === 'GROUP_BOX';
    const defaultZIndex = isGroupBox ? 0 : undefined;
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      zIndex: defaultZIndex,
      data: { 
        ...node.data, 
        template: isAnnotation ? undefined : templateMap.get(node.type),
        hasProvider: isAnnotation ? undefined : hasProvider,
        isAnnotation,
      },
      selected: false,
    };
  });
};

const toReactFlowEdges = (edges: WorkflowEdge[]): Edge[] => {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#FF6B00', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#FF6B00' },
  }));
};

// 转换函数：React Flow 格式 -> 内部格式
const fromReactFlowNodes = (nodes: Node[]): WorkflowNode[] => {
  return nodes.map(node => {
    // 只保存需要持久化的字段，排除运行时字段
    const { template, hasProvider, isAnnotation, nodeId, ...persistData } = node.data;
    return {
      id: node.id,
      type: node.type as NodeType,
      position: node.position,
      data: persistData,
    };
  });
};

const fromReactFlowEdges = (edges: Edge[]): WorkflowEdge[] => {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
};

const WorkflowEditorInner: React.FC<WorkflowEditorProps> = ({ onBack, workflowId, onUnsavedChange }) => {
  const user = getStoredUser();
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(workflowId || null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasTheme, setCanvasTheme] = useState<string>(() => {
    return localStorage.getItem('canvas-theme') || 'light';
  });
  const [imagePreview, setImagePreview] = useState<{ src: string; open: boolean }>({ src: '', open: false });
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const contextMenu = useContextMenu(); // 节点右键菜单
  const edgeContextMenu = useContextMenu(); // 边右键菜单
  const { toasts, removeToast, success, error } = useToast();
  const reactFlowInstance = useReactFlow();

  // 图片管理状态
  const [showImageManager, setShowImageManager] = useState(false);
  const [workflowImages, setWorkflowImages] = useState<WorkflowImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // 节点模板和 AI 提供商状态
  const [templates, setTemplates] = useState<NodeTemplate[]>([]);
  const [hasProvider, setHasProvider] = useState(false);

  // 动态生成节点类型
  const nodeTypes = useMemo(() => createNodeTypes(templates), [templates]);

  // 加载节点模板和 AI 配置状态
  useEffect(() => {
    const loadTemplates = async () => {
      const [templatesData, providerStatus] = await Promise.all([
        getNodeTemplates(),
        user?.id ? hasEnabledProvider(user.id) : Promise.resolve(false),
      ]);
      setTemplates(templatesData);
      setHasProvider(providerStatus);
    };
    loadTemplates();
  }, [user?.id]);

  // 获取存储的视口状态
  const getStoredViewport = useCallback((): Viewport | null => {
    const key = `workflow-viewport-${workflowId || 'new'}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }, [workflowId]);

  // 保存视口状态
  const saveViewport = useCallback((viewport: Viewport) => {
    const key = `workflow-viewport-${currentWorkflowId || workflowId || 'new'}`;
    localStorage.setItem(key, JSON.stringify(viewport));
  }, [currentWorkflowId, workflowId]);

  // 视口变化时保存
  const onMoveEnd = useCallback((_: any, viewport: Viewport) => {
    saveViewport(viewport);
  }, [saveViewport]);

  // 初始视口
  const [defaultViewport] = useState<Viewport>(() => {
    return getStoredViewport() || { x: 0, y: 0, zoom: 1 };
  });

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as HTMLElement)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markUnsaved = useCallback(() => setHasUnsavedChanges(true), []);

  // 监听辅助工具节点的更新事件 - 统一使用 annotationUpdate
  useEffect(() => {
    const handleAnnotationUpdate = (e: CustomEvent) => {
      const { nodeId, ...updates } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, ...updates } } };
        }
        return n;
      }));
      setHasUnsavedChanges(true);
    };

    // 监听节点位置移动事件（用于箭头拖拽时保持对角固定）
    const handleAnnotationMove = (e: CustomEvent) => {
      const { nodeId, deltaX, deltaY } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, position: { x: n.position.x + deltaX, y: n.position.y + deltaY } };
        }
        return n;
      }));
    };

    // 监听图片上传事件
    const handleImageUpload = async (e: CustomEvent) => {
      const { nodeId, file } = e.detail;
      const user = getStoredUser();
      if (!user) return;
      
      try {
        const url = await uploadWorkflowImage(user.id, file, currentWorkflowId || undefined);
        // 更新节点
        setNodes(nds => nds.map(n => {
          if (n.id === nodeId) {
            return { ...n, data: { ...n.data, config: { ...n.data.config, src: url } } };
          }
          return n;
        }));
        setHasUnsavedChanges(true);
      } catch (err) {
        console.error('Image upload failed:', err);
        error('图片上传失败');
      }
      // 通知上传完成
      window.dispatchEvent(new CustomEvent('imageUploadComplete', { detail: { nodeId } }));
    };

    window.addEventListener('annotationUpdate', handleAnnotationUpdate as EventListener);
    window.addEventListener('annotationMove', handleAnnotationMove as EventListener);
    window.addEventListener('imageUpload', handleImageUpload as EventListener);
    return () => {
      window.removeEventListener('annotationUpdate', handleAnnotationUpdate as EventListener);
      window.removeEventListener('annotationMove', handleAnnotationMove as EventListener);
      window.removeEventListener('imageUpload', handleImageUpload as EventListener);
    };
  }, [setNodes, error, currentWorkflowId]);

  // 监听粘贴事件 - 只处理图片粘贴
  useEffect(() => {
    console.log('=== Paste event listener registered ===');
    
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('=== PASTE EVENT FIRED ===', { 
        editingNodeId, 
        itemsCount: e.clipboardData?.items?.length,
        types: e.clipboardData?.types 
      });
      
      // 如果正在编辑节点，不处理粘贴
      if (editingNodeId) {
        console.log('Paste blocked: editingNodeId is set');
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) {
        console.log('Paste blocked: no items in clipboard');
        return;
      }
      
      console.log('Clipboard items:', Array.from(items).map(i => i.type));
      
      // 检查是否有图片
      for (const item of items) {
        console.log('Checking item:', item.type);
        if (item.type.startsWith('image/')) {
          console.log('Found image item, processing...');
          e.preventDefault();
          e.stopPropagation();
          const file = item.getAsFile();
          console.log('Got file:', file?.name, file?.size);
          if (!file) continue;
          
          const user = getStoredUser();
          
          // 获取画布中心位置
          const viewport = reactFlowInstance?.getViewport();
          const centerX = viewport ? (-viewport.x + window.innerWidth / 2) / viewport.zoom : 300;
          const centerY = viewport ? (-viewport.y + window.innerHeight / 2) / viewport.zoom : 200;
          
          // 先创建本地预览 URL
          const localPreviewUrl = URL.createObjectURL(file);
          
          // 创建图片节点（使用本地预览）
          const nodeId = generateId();
          const newNode: Node = {
            id: nodeId,
            type: 'IMAGE',
            position: { x: centerX - 100, y: centerY - 75 },
            data: {
              label: '图片',
              isAnnotation: true,
              config: { src: localPreviewUrl, width: 200, height: 150 }
            }
          };
          
          setNodes(nds => [...nds, newNode]);
          setHasUnsavedChanges(true);
          
          // 上传图片到 Storage，完成后替换为远程 URL
          if (user) {
            console.log('Starting upload for user:', user.id);
            try {
              const url = await uploadWorkflowImage(user.id, file, currentWorkflowId || undefined);
              console.log('Upload successful:', url);
              // 释放本地预览 URL
              URL.revokeObjectURL(localPreviewUrl);
              // 更新为远程 URL
              setNodes(nds => nds.map(n => 
                n.id === nodeId 
                  ? { ...n, data: { ...n.data, config: { ...n.data.config, src: url } } }
                  : n
              ));
            } catch (err) {
              console.error('Image upload failed:', err);
              error('图片上传失败');
              // 上传失败时保留本地预览
            }
          }
          return; // 处理完图片就返回
        }
      }
    };

    document.addEventListener('paste', handlePaste, true); // Use capture phase
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [setNodes, editingNodeId, reactFlowInstance, error, currentWorkflowId]);

  // Undo/Redo 历史记录 - 使用 past 和 future 栈
  const pastRef = React.useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const futureRef = React.useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // 保存状态到历史（传入当前状态）
  const pushToHistory = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    console.log('pushToHistory called with', currentNodes.length, 'nodes,', currentEdges.length, 'edges');
    console.trace('pushToHistory stack trace');
    pastRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges))
    });
    futureRef.current = [];
    if (pastRef.current.length > 50) {
      pastRef.current.shift();
    }
  }, []);

  // Undo - 回到上一个状态
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) {
      console.log('Undo: no history');
      return;
    }
    
    // 获取当前最新状态
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    
    // 保存当前状态到 future 栈
    futureRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges))
    });
    
    // 从 past 栈取出上一个状态
    const prevState = pastRef.current.pop()!;
    console.log('Undo: restoring', prevState.nodes.length, 'nodes,', prevState.edges.length, 'edges');
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHasUnsavedChanges(true);
  }, [reactFlowInstance, setNodes, setEdges]);

  // Redo - 前进到下一个状态
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) {
      console.log('Redo: no future');
      return;
    }
    
    // 获取当前最新状态
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    
    // 保存当前状态到 past 栈
    pastRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges))
    });
    
    // 从 future 栈取出下一个状态
    const nextState = futureRef.current.pop()!;
    console.log('Redo: restoring', nextState.nodes.length, 'nodes,', nextState.edges.length, 'edges');
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHasUnsavedChanges(true);
  }, [reactFlowInstance, setNodes, setEdges]);

  // 通知父组件未保存状态变化
  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChange]);

  // 加载工作流
  useEffect(() => {
    const loadWorkflow = async () => {
      if (templates.length === 0) return; // 等待模板加载完成
      
      setIsLoading(true);
      try {
        if (workflowId) {
          const workflow = await workflowApi.getWorkflow(workflowId);
          if (workflow) {
            // 调试：打印加载的节点数据
            console.log('加载工作流 - 原始节点数据:', JSON.stringify(workflow.nodes, null, 2));
            setNodes(toReactFlowNodes(workflow.nodes || [], templates, hasProvider));
            setEdges(toReactFlowEdges(workflow.edges || []));
            setWorkflowName(workflow.name);
            setCurrentWorkflowId(workflow.id);
          }
        }
      } catch (err) {
        console.error('加载工作流失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadWorkflow();
  }, [workflowId, templates, hasProvider, setNodes, setEdges]);

  // 保存工作流
  const saveWorkflow = useCallback(async () => {
    if (!user?.id) { error('请先登录'); return; }
    setSaving(true);
    try {
      const workflowNodes = fromReactFlowNodes(nodes);
      const workflowEdges = fromReactFlowEdges(edges);
      if (currentWorkflowId) {
        await workflowApi.updateWorkflow(currentWorkflowId, { name: workflowName, nodes: workflowNodes, edges: workflowEdges });
      } else {
        const created = await workflowApi.createWorkflow(user.id, { name: workflowName, nodes: workflowNodes, edges: workflowEdges });
        setCurrentWorkflowId(created.id);
      }
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      success('工作流已保存');
    } catch (err: any) {
      error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [user?.id, currentWorkflowId, workflowName, nodes, edges, success, error]);

  // 加载工作流图片
  const loadWorkflowImages = useCallback(async () => {
    if (!user?.id || !currentWorkflowId) return;
    setLoadingImages(true);
    try {
      const images = await getWorkflowImages(user.id, currentWorkflowId);
      setWorkflowImages(images);
    } catch (err) {
      console.error('Load images failed:', err);
    } finally {
      setLoadingImages(false);
    }
  }, [user?.id, currentWorkflowId]);

  // 删除工作流图片
  const handleDeleteImage = useCallback(async (image: WorkflowImage) => {
    try {
      await deleteWorkflowImage(image.url);
      setWorkflowImages(prev => prev.filter(i => i.url !== image.url));
      // 检查是否有节点使用这张图片，如果有则清空
      setNodes(nds => nds.map(n => {
        if (n.data?.config?.src === image.url) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, src: '' } } };
        }
        return n;
      }));
      success('图片已删除');
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  }, [setNodes, success, error]);

  // 打开图片管理器时加载图片
  useEffect(() => {
    if (showImageManager) {
      loadWorkflowImages();
    }
  }, [showImageManager, loadWorkflowImages]);

  // 剪贴板状态（存储复制的节点和边）
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // ========== 图片预览打开时的快捷键 ==========
      if (imagePreview.open) {
        if (e.key === 'Escape') {
          setImagePreview({ src: '', open: false });
        }
        return;
      }
      
      // ========== 弹窗打开时的快捷键 ==========
      if (editingNodeId) {
        // Ctrl+S 保存节点配置提示
        if (isCtrlOrCmd && e.key === 's') {
          e.preventDefault();
          success('节点配置已保存');
        }
        // Escape 关闭弹窗
        if (e.key === 'Escape') {
          setEditingNodeId(null);
          document.body.focus();
        }
        // 弹窗打开时禁用其他所有快捷键
        return;
      }

      // ========== 画布快捷键（弹窗关闭时） ==========
      
      // 检查是否在输入框中
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.getAttribute('contenteditable') === 'true';

      // Ctrl+S 保存工作流（任何时候都可用）
      if (isCtrlOrCmd && e.key === 's') {
        e.preventDefault();
        saveWorkflow();
        return;
      }

      // 以下快捷键在输入框中时禁用
      if (isInInput) return;

      // Ctrl+Z 撤销
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if (isCtrlOrCmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+C 复制选中节点
      if (isCtrlOrCmd && e.key === 'c') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const selectedEdges = edges.filter(
            edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
          );
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
        }
        return;
      }

      // Ctrl+V 粘贴节点（图片粘贴由 paste 事件处理）
      if (isCtrlOrCmd && e.key === 'v') {
        if (clipboard && clipboard.nodes.length > 0) {
          e.preventDefault();
          const currentNodes = reactFlowInstance.getNodes();
          const currentEdges = reactFlowInstance.getEdges();
          pushToHistory(currentNodes, currentEdges);
          const idMap = new Map<string, string>();
          clipboard.nodes.forEach(n => idMap.set(n.id, generateId()));
          
          const newNodes: Node[] = clipboard.nodes.map(n => ({
            ...n,
            id: idMap.get(n.id)!,
            position: { x: n.position.x + 50, y: n.position.y + 50 },
            selected: true,
            data: { ...n.data },
          }));
          
          const newEdges: Edge[] = clipboard.edges.map(edge => ({
            ...edge,
            id: generateId(),
            source: idMap.get(edge.source)!,
            target: idMap.get(edge.target)!,
          }));
          
          setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
          setEdges(eds => [...eds, ...newEdges]);
          markUnsaved();
        }
        // 不 return，让 paste 事件有机会处理图片
      }

      // Ctrl+X 剪切
      if (isCtrlOrCmd && e.key === 'x') {
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const selectedNodes = currentNodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          pushToHistory(currentNodes, currentEdges);
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const selectedEdges = edges.filter(
            edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
          );
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(edge => !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)));
          markUnsaved();
        }
        return;
      }

      // Delete 或 Backspace 删除选中节点和边
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const selectedNodes = currentNodes.filter(n => n.selected);
        const selectedEdges = currentEdges.filter(edge => edge.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // 保存当前状态到历史（使用 reactFlowInstance 获取最新状态）
          console.log('Delete: saving history with', currentNodes.length, 'nodes,', currentEdges.length, 'edges');
          pushToHistory(currentNodes, currentEdges);
          
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(edge => !edge.selected && !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)));
          markUnsaved();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveWorkflow, nodes, edges, setNodes, setEdges, markUnsaved, clipboard, editingNodeId, success, undo, redo, pushToHistory, reactFlowInstance, imagePreview.open]);

  // 连接节点
  const onConnect = useCallback((params: Connection) => {
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    pushToHistory(currentNodes, currentEdges);
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#FF6B00', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#FF6B00' },
    }, eds));
    markUnsaved();
  }, [setEdges, markUnsaved, pushToHistory, reactFlowInstance]);

  // 节点变化时标记未保存
  const handleNodesChange = useCallback((changes: any) => {
    // 位置变化结束时保存历史
    const positionEnd = changes.some((c: any) => c.type === 'position' && c.dragging === false);
    if (positionEnd) {
      const currentNodes = reactFlowInstance.getNodes();
      const currentEdges = reactFlowInstance.getEdges();
      pushToHistory(currentNodes, currentEdges);
    }
    onNodesChange(changes);
    // 只有位置变化或删除时才标记未保存
    if (changes.some((c: any) => c.type === 'position' && c.dragging === false || c.type === 'remove')) {
      markUnsaved();
    }
  }, [onNodesChange, markUnsaved, pushToHistory, reactFlowInstance]);

  // 边变化时标记未保存
  const handleEdgesChange = useCallback((changes: any) => {
    // 如果有边被删除，先保存历史
    const hasRemove = changes.some((c: any) => c.type === 'remove');
    if (hasRemove) {
      const currentNodes = reactFlowInstance.getNodes();
      const currentEdges = reactFlowInstance.getEdges();
      console.log('Edge remove detected, saving history with', currentNodes.length, 'nodes,', currentEdges.length, 'edges');
      pushToHistory(currentNodes, currentEdges);
    }
    onEdgesChange(changes);
    if (hasRemove) {
      markUnsaved();
    }
  }, [onEdgesChange, markUnsaved, pushToHistory, reactFlowInstance]);

  // 添加组件
  const handleAddComponent = useCallback((component: NodeTemplate) => {
    const position = reactFlowInstance.screenToFlowPosition({ x: 200, y: 200 });
    const newNode: Node = {
      id: generateId(),
      type: component.type,
      position,
      data: { 
        label: component.name, 
        description: component.description, 
        config: { ...component.defaultConfig },
        template: component,
        hasProvider,
      },
    };
    setNodes(nds => [...nds, newNode]);
    setIsPanelOpen(false);
    markUnsaved();
  }, [setNodes, markUnsaved, reactFlowInstance, hasProvider]);

  // 拖放添加组件
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('component');
    if (!componentData) return;
    try {
      const component = JSON.parse(componentData);
      const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      // 检查是否是辅助工具（批注节点）
      const isAnnotation = component.isAnnotation === true;
      const nodeId = generateId();
      
      // 分组框放在底层
      const isGroupBox = component.type === 'GROUP_BOX';
      const defaultZIndex = isGroupBox ? 0 : undefined;
      
      const newNode: Node = {
        id: nodeId,
        type: component.type,
        position,
        zIndex: defaultZIndex,
        data: { 
          label: component.name, 
          description: component.description, 
          config: { ...component.defaultConfig },
          template: isAnnotation ? undefined : component,
          hasProvider: isAnnotation ? undefined : hasProvider,
          isAnnotation,
          nodeId, // 传递给节点组件用于事件通信
        },
      };
      setNodes(nds => [...nds, newNode]);
      setIsPanelOpen(false);
      markUnsaved();
    } catch {}
  }, [setNodes, markUnsaved, reactFlowInstance, hasProvider]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 双击编辑节点
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    // 辅助工具节点不打开配置弹窗
    if (node.data.isAnnotation) {
      return;
    }
    setEditingNodeId(node.id);
  }, []);

  // 右键菜单 - 节点
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    edgeContextMenu.close(); // 关闭边菜单
    contextMenu.open(e, node.id);
  }, [contextMenu, edgeContextMenu]);

  // 右键菜单 - 边
  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    contextMenu.close(); // 关闭节点菜单
    edgeContextMenu.open(e, edge.id);
  }, [contextMenu, edgeContextMenu]);

  // 更新节点数据
  const updateNodeData = useCallback((id: string, newData: any) => {
    setNodes(nds => nds.map(node => node.id === id ? { ...node, data: { ...node.data, ...newData } } : node));
    markUnsaved();
  }, [setNodes, markUnsaved]);

  // 删除节点
  const deleteNode = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    markUnsaved();
  }, [setNodes, setEdges, markUnsaved]);

  // 删除边
  const deleteEdge = useCallback((id: string) => {
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    pushToHistory(currentNodes, currentEdges);
    setEdges(eds => eds.filter(e => e.id !== id));
    markUnsaved();
  }, [setEdges, markUnsaved, pushToHistory, reactFlowInstance]);

  // 复制节点
  const duplicateNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      const newNode: Node = {
        ...node,
        id: generateId(),
        position: { x: node.position.x + 80, y: node.position.y + 20 },
        data: { ...node.data, label: node.data.label + ' (副本)' },
        selected: false,
      };
      setNodes(nds => [...nds, newNode]);
      markUnsaved();
    }
  }, [nodes, setNodes, markUnsaved]);

  // 图层控制 - 置于顶层
  const bringToFront = useCallback((id: string) => {
    setNodes(nds => {
      const maxZ = Math.max(...nds.map(n => n.zIndex ?? 0));
      return nds.map(n => n.id === id ? { ...n, zIndex: maxZ + 1 } : n);
    });
    markUnsaved();
  }, [setNodes, markUnsaved]);

  // 图层控制 - 置于底层
  const sendToBack = useCallback((id: string) => {
    setNodes(nds => {
      const minZ = Math.min(...nds.map(n => n.zIndex ?? 0));
      return nds.map(n => n.id === id ? { ...n, zIndex: minZ - 1 } : n);
    });
    markUnsaved();
  }, [setNodes, markUnsaved]);

  // 图层控制 - 上移一层
  const bringForward = useCallback((id: string) => {
    setNodes(nds => {
      const node = nds.find(n => n.id === id);
      if (!node) return nds;
      const currentZ = node.zIndex ?? 0;
      return nds.map(n => n.id === id ? { ...n, zIndex: currentZ + 1 } : n);
    });
    markUnsaved();
  }, [setNodes, markUnsaved]);

  // 图层控制 - 下移一层
  const sendBackward = useCallback((id: string) => {
    setNodes(nds => {
      const node = nds.find(n => n.id === id);
      if (!node) return nds;
      const currentZ = node.zIndex ?? 0;
      return nds.map(n => n.id === id ? { ...n, zIndex: currentZ - 1 } : n);
    });
    markUnsaved();
  }, [setNodes, markUnsaved]);

  // 导出工作流
  const exportWorkflow = useCallback(() => {
    console.log('导出时的 edges:', edges);
    console.log('导出时的 edges 数量:', edges.length);
    const w: Workflow = {
      id: currentWorkflowId || generateId(),
      name: workflowName,
      nodes: fromReactFlowNodes(nodes),
      edges: fromReactFlowEdges(edges),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    console.log('导出的工作流:', w);
    const blob = new Blob([JSON.stringify(w, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowName.replace(/\s+/g, '-')}.json`;
    a.click();
  }, [currentWorkflowId, workflowName, nodes, edges]);

  // 导出 PDF
  const [exporting, setExporting] = useState(false);
  const exportPDF = useCallback(async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport || nodes.length === 0) {
      error('画布为空，无法导出');
      return;
    }

    setExporting(true);
    try {
      // 计算所有节点的边界
      const nodesBounds = getRectOfNodes(nodes);
      const padding = 50;
      const width = nodesBounds.width + padding * 2;
      const height = nodesBounds.height + padding * 2;

      // 计算变换以适应所有节点
      const transform = getTransformForBounds(
        nodesBounds,
        width,
        height,
        0.5,
        2
      );

      // 生成图片
      const dataUrl = await toPng(viewport, {
        backgroundColor: canvasTheme === 'dark' ? '#1e1e1e' : '#fafafa',
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
        },
      });

      // 创建 PDF
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`${workflowName.replace(/\s+/g, '-')}.pdf`);
      success('PDF 导出成功');
    } catch (err) {
      console.error('PDF export failed:', err);
      error('PDF 导出失败');
    } finally {
      setExporting(false);
    }
  }, [nodes, workflowName, canvasTheme, success, error]);

  // 导入工作流
  const importWorkflow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        console.log('导入文件内容长度:', content?.length);
        const parsed = JSON.parse(content);
        console.log('解析后的对象 keys:', Object.keys(parsed));
        
        // 兼容多种导出格式：直接的工作流对象，或包含 workflow 字段的对象
        const w = parsed.workflow || parsed;
        console.log('工作流对象 keys:', Object.keys(w));
        console.log('nodes:', w.nodes?.length, 'edges:', w.edges?.length);
        
        if (w.nodes && Array.isArray(w.nodes)) {
          const edgesArray = w.edges || [];
          console.log('templates 数量:', templates.length, 'hasProvider:', hasProvider);
          const reactFlowNodes = toReactFlowNodes(w.nodes, templates, hasProvider);
          console.log('转换后的节点:', reactFlowNodes.length);
          setNodes(reactFlowNodes);
          setEdges(toReactFlowEdges(edgesArray));
          setWorkflowName(w.name || '导入的工作流');
          setCurrentWorkflowId(null);
          markUnsaved();
          success('工作流导入成功');
        } else {
          console.error('工作流数据不完整:', { nodes: w.nodes, edges: w.edges, parsed });
          error('无效的工作流文件：缺少 nodes 数组');
        }
      } catch (err) { 
        console.error('导入工作流失败:', err);
        error('无效的工作流文件'); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setNodes, setEdges, markUnsaved, error, success, templates, hasProvider]);

  const editingNode = useMemo(() => {
    const node = nodes.find(n => n.id === editingNodeId);
    if (!node) return null;
    return {
      id: node.id,
      type: node.type as NodeType,
      position: node.position,
      data: node.data,
    };
  }, [nodes, editingNodeId]);

  const handleComponentDragStart = useCallback((e: React.DragEvent, component: NodeTemplate) => {
    e.dataTransfer.setData('component', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="w-full h-full flex flex-col relative" style={{ backgroundColor: canvasThemes[canvasTheme as keyof typeof canvasThemes]?.containerBg || '#f8f8f8' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* 加载动画 */}
      {isLoading && <LoadingSpinner text="正在加载工作流..." />}
      
      {/* 顶部工具栏 */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all" title="返回主页">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
          )}
          <input type="text" value={workflowName} onChange={(e) => { setWorkflowName(e.target.value); markUnsaved(); }}
            className="bg-transparent border-none outline-none font-semibold text-gray-800 text-lg focus:bg-gray-100 px-2 py-1 rounded-lg transition-colors" />
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>保存中</span>
            ) : hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>未保存</span>
            ) : lastSavedAt && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>已保存</span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              {countWorkflowNodes(nodes)}
              <span className="text-gray-300">·</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
              {edges.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveWorkflow} disabled={!hasUnsavedChanges || saving} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${hasUnsavedChanges && !saving ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} title="Ctrl+S">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>保存
          </button>
          <button onClick={() => setIsPanelOpen(!isPanelOpen)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${isPanelOpen ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>组件库
          </button>
          {/* 更多菜单 */}
          <div className="relative" ref={moreMenuRef}>
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)} 
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button 
                  onClick={() => { fileInputRef.current?.click(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  导入工作流
                </button>
                <button 
                  onClick={() => { exportWorkflow(); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  导出工作流
                </button>
                <button 
                  onClick={() => { exportPDF(); setShowMoreMenu(false); }}
                  disabled={exporting}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  {exporting ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                  )}
                  {exporting ? '导出中...' : '导出 PDF'}
                </button>
                <div className="h-px bg-gray-100 my-1" />
                {currentWorkflowId && (
                  <button 
                    onClick={() => { setShowImageManager(true); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                    管理图片
                  </button>
                )}
                <button 
                  onClick={() => { 
                    const newTheme = canvasTheme === 'light' ? 'dark' : 'light';
                    setCanvasTheme(newTheme); 
                    localStorage.setItem('canvas-theme', newTheme);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {canvasTheme === 'light' ? (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                      夜间模式
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                      日间模式
                    </>
                  )}
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={importWorkflow} />
          </div>
        </div>
      </div>

      {/* React Flow 画布 */}
      <ThemeContext.Provider value={canvasTheme as 'light' | 'dark'}>
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectNodesOnDrag
          defaultViewport={defaultViewport}
          snapToGrid={false}
          edgesFocusable
          edgesUpdatable
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#FF6B00', strokeWidth: 2 },
          }}
          connectionLineStyle={{ stroke: '#FF6B00', strokeWidth: 2 }}
          connectionLineType={ConnectionLineType.SmoothStep}
          style={{ backgroundColor: canvasThemes[canvasTheme as keyof typeof canvasThemes]?.bg || '#fafafa' }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={canvasThemes[canvasTheme as keyof typeof canvasThemes]?.gridColor || '#e8e8e8'} gap={10} />
          <Controls position="bottom-left" showInteractive={false} />
          {nodes.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl shadow-sm flex items-center justify-center ${
                  canvasTheme === 'dark' ? 'bg-white/10' : 'bg-white'
                }`}>
                  <svg className={`w-10 h-10 ${canvasTheme === 'dark' ? 'text-white/30' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <p className={`text-sm mb-2 ${canvasTheme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>画布为空</p>
                <p className={`text-xs ${canvasTheme === 'dark' ? 'text-white/20' : 'text-gray-300'}`}>从右侧面板拖拽组件到这里，或框选多个节点</p>
              </div>
            </div>
          )}
        </ReactFlow>
      </div>
      </ThemeContext.Provider>

      <ComponentPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} onDragStart={handleComponentDragStart} onAddComponent={handleAddComponent} />
      <NodeConfigModal node={editingNode} onClose={() => setEditingNodeId(null)} onUpdate={updateNodeData} onDelete={deleteNode} />

      {/* 辅助节点样式工具栏 */}
      {(() => {
        const selectedNode = nodes.find(n => n.selected && n.data?.isAnnotation);
        if (!selectedNode) return null;
        
        const config = selectedNode.data.config || {};
        const nodeType = selectedNode.type;
        
        // 不同节点类型支持的样式选项
        const supportsTextColor = ['STICKY_NOTE', 'TEXT_LABEL', 'STATE', 'ACTOR'].includes(nodeType || '');
        const supportsBgColor = ['STICKY_NOTE', 'GROUP_BOX', 'STATE', 'TEXT_LABEL'].includes(nodeType || '');
        const supportsStrokeColor = ['ARROW', 'STATE', 'GROUP_BOX'].includes(nodeType || '');
        const supportsFontSize = ['STICKY_NOTE', 'TEXT_LABEL'].includes(nodeType || '');
        const supportsBold = ['STICKY_NOTE', 'TEXT_LABEL', 'STATE', 'ACTOR', 'GROUP_BOX'].includes(nodeType || '');
        
        const updateStyle = (updates: Record<string, any>) => {
          setNodes(nds => nds.map(n => {
            if (n.id === selectedNode.id) {
              return { ...n, data: { ...n.data, config: { ...n.data.config, ...updates } } };
            }
            return n;
          }));
          setHasUnsavedChanges(true);
        };
        
        const colors = ['#374151', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'];
        const bgColors = ['transparent', '#FFFFFF', '#FEF3C7', '#DCFCE7', '#DBEAFE', '#F3E8FF', '#FCE7F3', '#F3F4F6'];
        
        return (
          <div 
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-3"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 字体颜色 */}
            {(supportsTextColor || supportsStrokeColor) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">颜色</span>
                <div className="flex gap-1">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                        (config.color === c || config.borderColor === c) ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (supportsStrokeColor && nodeType === 'ARROW') updateStyle({ color: c });
                        else if (supportsStrokeColor) updateStyle({ borderColor: c });
                        else updateStyle({ color: c });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* 分隔线 */}
            {(supportsTextColor || supportsStrokeColor) && supportsBgColor && (
              <div className="w-px h-6 bg-gray-200" />
            )}
            
            {/* 填充颜色 */}
            {supportsBgColor && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">填充</span>
                <div className="flex gap-1">
                  {bgColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${
                        config.backgroundColor === c ? 'border-gray-800 scale-110' : 'border-gray-300'
                      } ${c === 'transparent' ? 'bg-white relative overflow-hidden' : ''}`}
                      style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStyle({ backgroundColor: c });
                      }}
                    >
                      {c === 'transparent' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-full h-0.5 bg-red-500 rotate-45" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 分隔线 */}
            {supportsBgColor && supportsFontSize && (
              <div className="w-px h-6 bg-gray-200" />
            )}
            
            {/* 字体大小 */}
            {supportsFontSize && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">字号</span>
                <select
                  value={config.fontSize || 14}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateStyle({ fontSize: parseInt(e.target.value) });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-primary"
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* 分隔线 */}
            {supportsFontSize && supportsBold && (
              <div className="w-px h-6 bg-gray-200" />
            )}
            
            {/* 加粗 */}
            {supportsBold && (
              <button
                type="button"
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  config.fontWeight === 'bold' ? 'bg-gray-200 text-gray-800' : 'hover:bg-gray-100 text-gray-600'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateStyle({ fontWeight: config.fontWeight === 'bold' ? 'normal' : 'bold' });
                }}
                title="加粗"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V4zm0 8h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6v-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </button>
            )}
          </div>
        );
      })()}

      {contextMenu.isOpen && (() => {
        const contextNode = nodes.find(n => n.id === contextMenu.data);
        const isAnnotation = contextNode?.data?.isAnnotation;
        const isImageNode = contextNode?.type === 'IMAGE';
        const imageSrc = contextNode?.data?.config?.src;
        
        // 图片节点的菜单
        if (isImageNode) {
          const menuItems = [
            ...(imageSrc ? [
              { 
                label: '预览图片', 
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>, 
                onClick: () => { setImagePreview({ src: imageSrc, open: true }); setImageZoom(1); setImagePan({ x: 0, y: 0 }); }
              },
              { 
                label: '保存图片', 
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>, 
                onClick: () => {
                  const link = document.createElement('a');
                  link.href = imageSrc;
                  link.download = `image-${Date.now()}.png`;
                  link.click();
                }
              },
              { 
                label: '更换图片', 
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>, 
                onClick: () => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      // 使用 imageUpload 事件上传到 Storage
                      window.dispatchEvent(new CustomEvent('imageUpload', { 
                        detail: { nodeId: contextMenu.data, file } 
                      }));
                    }
                  };
                  input.click();
                }
              },
              { divider: true, label: '', onClick: () => {} },
            ] : []),
            { label: '复制', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>, onClick: () => duplicateNode(contextMenu.data) },
            { divider: true, label: '', onClick: () => {} },
            { label: '置于顶层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>, onClick: () => bringToFront(contextMenu.data) },
            { label: '置于底层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>, onClick: () => sendToBack(contextMenu.data) },
            { divider: true, label: '', onClick: () => {} },
            { label: '删除', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, danger: true, onClick: () => deleteNode(contextMenu.data) }
          ];
          return <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={contextMenu.close} items={menuItems} />;
        }
        
        // 辅助节点的菜单
        if (isAnnotation) {
          const menuItems = [
            { label: '复制', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>, onClick: () => duplicateNode(contextMenu.data) },
            { divider: true, label: '', onClick: () => {} },
            { label: '置于顶层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>, onClick: () => bringToFront(contextMenu.data) },
            { label: '上移一层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V9M9 12l3-3 3 3"/></svg>, onClick: () => bringForward(contextMenu.data) },
            { label: '下移一层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v6M9 12l3 3 3-3"/></svg>, onClick: () => sendBackward(contextMenu.data) },
            { label: '置于底层', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>, onClick: () => sendToBack(contextMenu.data) },
            { divider: true, label: '', onClick: () => {} },
            { label: '删除', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, danger: true, onClick: () => deleteNode(contextMenu.data) }
          ];
          return <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={contextMenu.close} items={menuItems} />;
        }
        
        // 普通节点的菜单（无图层控制）
        const menuItems = [
          { 
            label: '编辑节点', 
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>, 
            onClick: () => setEditingNodeId(contextMenu.data) 
          },
          { label: '复制', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>, onClick: () => duplicateNode(contextMenu.data) },
          { divider: true, label: '', onClick: () => {} },
          { label: '删除', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, danger: true, onClick: () => deleteNode(contextMenu.data) }
        ];
        return <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={contextMenu.close} items={menuItems} />;
      })()}

      {/* 边右键菜单 */}
      {edgeContextMenu.isOpen && (
        <ContextMenu 
          x={edgeContextMenu.x} 
          y={edgeContextMenu.y} 
          onClose={edgeContextMenu.close}
          items={[
            { 
              label: '删除连线', 
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, 
              danger: true, 
              onClick: () => deleteEdge(edgeContextMenu.data) 
            }
          ]}
        />
      )}

      {/* 图片管理模态框 */}
      <Modal isOpen={showImageManager} onClose={() => setShowImageManager(false)} title="图片管理">
        <div className="min-h-[300px]">
          {loadingImages ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : workflowImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
              <svg className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <p>暂无图片</p>
              <p className="text-sm mt-1">在画布中添加图片节点后会显示在这里</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {workflowImages.map((image) => {
                const isUsed = nodes.some(n => n.data?.config?.src === image.url);
                return (
                  <div key={image.name} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      <img src={image.url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setImagePreview({ src: image.url, open: true }); setShowImageManager(false); }}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                        title="预览"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteImage(image)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-colors"
                        title="删除"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                    {isUsed && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded">
                        使用中
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500 truncate">
                      {(image.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
            <span>共 {workflowImages.length} 张图片</span>
            <span>总大小: {(workflowImages.reduce((sum, i) => sum + i.size, 0) / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        </div>
      </Modal>

      {/* 图片预览模态框 */}
      {imagePreview.open && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center overflow-hidden"
        >
          {/* 工具栏 */}
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setImageZoom(z => Math.max(0.1, z - 0.25))}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="缩小"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35M8 11h6" /></svg>
            </button>
            <span className="text-white text-sm min-w-[60px] text-center">{Math.round(imageZoom * 100)}%</span>
            <button 
              onClick={() => setImageZoom(z => Math.min(5, z + 0.25))}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="放大"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35M11 8v6M8 11h6" /></svg>
            </button>
            <div className="w-px h-6 bg-white/20" />
            <button 
              onClick={() => { setImageZoom(1); setImagePan({ x: 0, y: 0 }); }}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm transition-colors"
            >
              重置
            </button>
            <button 
              onClick={() => {
                const link = document.createElement('a');
                link.href = imagePreview.src;
                link.download = `image-${Date.now()}.png`;
                link.click();
              }}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="保存图片"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            </button>
            <button 
              onClick={() => setImagePreview({ src: '', open: false })}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="关闭 (Esc)"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* 图片容器 */}
          <div 
            className="w-full h-full flex items-center justify-center overflow-hidden"
            style={{ cursor: isDraggingImage ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingImage(true);
              dragStartRef.current = { x: e.clientX, y: e.clientY, panX: imagePan.x, panY: imagePan.y };
            }}
            onMouseMove={(e) => {
              if (!isDraggingImage) return;
              const dx = e.clientX - dragStartRef.current.x;
              const dy = e.clientY - dragStartRef.current.y;
              setImagePan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
            }}
            onMouseUp={() => setIsDraggingImage(false)}
            onMouseLeave={() => setIsDraggingImage(false)}
            onWheel={(e) => {
              e.stopPropagation();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setImageZoom(z => Math.max(0.1, Math.min(5, z + delta)));
            }}
          >
            <img 
              src={imagePreview.src} 
              alt="预览" 
              className="max-w-none select-none"
              style={{ 
                transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
                transition: isDraggingImage ? 'none' : 'transform 0.1s ease-out'
              }}
              draggable={false}
            />
          </div>
          
          {/* 提示 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none">
            拖拽移动 · 滚轮缩放 · Esc 关闭
          </div>
        </div>
      )}
    </div>
  );
};

// 包装组件，提供 ReactFlowProvider
export const WorkflowEditor: React.FC<WorkflowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
};
