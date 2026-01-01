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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowNode, WorkflowEdge, NodeType, NodeTemplate, Workflow } from '../types';
import { generateId } from './utils';
import { NodeConfigModal } from './NodeConfigModal';
import { ComponentPanel } from './ComponentPanel';
import { ContextMenu, useContextMenu, useToast, ToastContainer } from '../shared';
import { getStoredUser } from '../lib/auth';
import { getNodeTemplates } from '../lib/components';
import { hasEnabledProvider } from '../lib/ai-providers';
import * as workflowApi from '../lib/workflows';
import { createNodeTypes } from './CustomNodes';

interface WorkflowEditorProps {
  onBack?: () => void;
  workflowId?: string;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

// 转换函数：内部格式 -> React Flow 格式
const toReactFlowNodes = (nodes: WorkflowNode[], templates: NodeTemplate[], hasProvider: boolean): Node[] => {
  const templateMap = new Map(templates.map(t => [t.type, t]));
  const annotationTypes = ['STICKY_NOTE', 'GROUP_BOX'];
  
  return nodes.map(node => {
    const isAnnotation = annotationTypes.includes(node.type);
    const isGroupBox = node.type === 'GROUP_BOX';
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      zIndex: isGroupBox ? -1 : undefined, // 分组框在底层
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
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const contextMenu = useContextMenu(); // 节点右键菜单
  const edgeContextMenu = useContextMenu(); // 边右键菜单
  const { toasts, removeToast, success, error } = useToast();
  const reactFlowInstance = useReactFlow();

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

  // 监听辅助工具节点的更新事件
  useEffect(() => {
    const handleStickyNoteUpdate = (e: CustomEvent) => {
      const { nodeId, text } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, text } } };
        }
        return n;
      }));
      setHasUnsavedChanges(true);
    };

    const handleGroupBoxUpdate = (e: CustomEvent) => {
      const { nodeId, title } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, title } } };
        }
        return n;
      }));
      setHasUnsavedChanges(true);
    };

    const handleStickyNoteResize = (e: CustomEvent) => {
      const { nodeId, width, height } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, width, height } } };
        }
        return n;
      }));
      setHasUnsavedChanges(true);
    };

    const handleGroupBoxResize = (e: CustomEvent) => {
      const { nodeId, width, height } = e.detail;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, config: { ...n.data.config, width, height } } };
        }
        return n;
      }));
      setHasUnsavedChanges(true);
    };

    window.addEventListener('stickyNoteUpdate', handleStickyNoteUpdate as EventListener);
    window.addEventListener('groupBoxUpdate', handleGroupBoxUpdate as EventListener);
    window.addEventListener('stickyNoteResize', handleStickyNoteResize as EventListener);
    window.addEventListener('groupBoxResize', handleGroupBoxResize as EventListener);
    return () => {
      window.removeEventListener('stickyNoteUpdate', handleStickyNoteUpdate as EventListener);
      window.removeEventListener('groupBoxUpdate', handleGroupBoxUpdate as EventListener);
      window.removeEventListener('stickyNoteResize', handleStickyNoteResize as EventListener);
      window.removeEventListener('groupBoxResize', handleGroupBoxResize as EventListener);
    };
  }, [setNodes]);

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
      if (workflowId && templates.length > 0) {
        try {
          const workflow = await workflowApi.getWorkflow(workflowId);
          if (workflow) {
            setNodes(toReactFlowNodes(workflow.nodes || [], templates, hasProvider));
            setEdges(toReactFlowEdges(workflow.edges || []));
            setWorkflowName(workflow.name);
            setCurrentWorkflowId(workflow.id);
          }
        } catch (err) {
          console.error('加载工作流失败:', err);
        }
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

  // 剪贴板状态（存储复制的节点和边）
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
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

      // Ctrl+V 粘贴节点
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
        return;
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
  }, [saveWorkflow, nodes, edges, setNodes, setEdges, markUnsaved, clipboard, editingNodeId, success, undo, redo, pushToHistory, reactFlowInstance]);

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
      
      // 分组框放在最底层
      const isGroupBox = component.type === 'GROUP_BOX';
      
      const newNode: Node = {
        id: nodeId,
        type: component.type,
        position,
        zIndex: isGroupBox ? -1 : undefined, // 分组框在底层
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

  // 导出工作流
  const exportWorkflow = useCallback(() => {
    const w: Workflow = {
      id: currentWorkflowId || generateId(),
      name: workflowName,
      nodes: fromReactFlowNodes(nodes),
      edges: fromReactFlowEdges(edges),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(w, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowName.replace(/\s+/g, '-')}.json`;
    a.click();
  }, [currentWorkflowId, workflowName, nodes, edges]);

  // 导入工作流
  const importWorkflow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const w: Workflow = JSON.parse(event.target?.result as string);
        if (w.nodes && w.edges) {
          setNodes(toReactFlowNodes(w.nodes, templates, hasProvider));
          setEdges(toReactFlowEdges(w.edges));
          setWorkflowName(w.name || '导入的工作流');
          setCurrentWorkflowId(null);
          markUnsaved();
        }
      } catch { error('无效的工作流文件'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setNodes, setEdges, markUnsaved, error]);

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
    <div className="w-full h-full flex flex-col relative bg-[#f8f8f8]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
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
              {nodes.length}
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
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
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
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={importWorkflow} />
          </div>
        </div>
      </div>

      {/* React Flow 画布 */}
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
          style={{ backgroundColor: '#fafafa' }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e8e8e8" gap={10} />
          <Controls position="bottom-left" showInteractive={false} />
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm mb-2">画布为空</p>
                <p className="text-gray-300 text-xs">从右侧面板拖拽组件到这里，或框选多个节点</p>
              </div>
            </div>
          )}
        </ReactFlow>
      </div>

      <ComponentPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} onDragStart={handleComponentDragStart} onAddComponent={handleAddComponent} />
      <NodeConfigModal node={editingNode} onClose={() => setEditingNodeId(null)} onUpdate={updateNodeData} onDelete={deleteNode} />

      {contextMenu.isOpen && (() => {
        const contextNode = nodes.find(n => n.id === contextMenu.data);
        const isAnnotation = contextNode?.data?.isAnnotation;
        const menuItems = [
          // 编辑节点 - 辅助节点不显示
          ...(!isAnnotation ? [{ 
            label: '编辑节点', 
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>, 
            onClick: () => setEditingNodeId(contextMenu.data) 
          }] : []),
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
