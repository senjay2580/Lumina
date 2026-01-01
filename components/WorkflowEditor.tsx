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
  Handle,
  Position,
  Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowNode, WorkflowEdge, NodeType, ComponentDefinition, Workflow } from '../types';
import { generateId } from './utils';
import { NodeConfigModal } from './NodeConfigModal';
import { ComponentPanel } from './ComponentPanel';
import { ContextMenu, useContextMenu, useToast, ToastContainer } from '../shared';
import { getStoredUser } from '../lib/auth';
import * as workflowApi from '../lib/workflows';

interface WorkflowEditorProps {
  onBack?: () => void;
  workflowId?: string;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

// 自定义节点组件 - 简化以提升性能
const CustomNode: React.FC<{ data: any; selected: boolean; type: string }> = ({ data, selected, type }) => {
  const isInput = type === 'AI_INPUT';
  const iconBg = isInput ? 'bg-green-500' : 'bg-blue-500';
  
  return (
    <div className="relative">
      <div className={`relative w-14 h-14 rounded-xl bg-white border-2 flex items-center justify-center ${
        selected ? 'border-primary shadow-[0_0_0_3px_rgba(255,107,0,0.2)]' : 'border-gray-200'
      } shadow-md`}>
        {/* 输入 Handle */}
        {!isInput && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !rounded-full !bg-white !border-2 !border-gray-400 hover:!border-primary !-left-1.5"
          />
        )}
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center text-white`}>
          {isInput ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div className="mt-2 text-center" style={{ width: '80px', marginLeft: '-13px' }}>
        <p className="text-xs text-gray-700 font-medium truncate">{data.label}</p>
        <p className="text-[10px] text-gray-400">manual</p>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  AI_INPUT: (props) => <CustomNode {...props} type="AI_INPUT" />,
  AI_PROCESSOR: (props) => <CustomNode {...props} type="AI_PROCESSOR" />,
};

// 转换函数：内部格式 -> React Flow 格式
const toReactFlowNodes = (nodes: WorkflowNode[]): Node[] => {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    selected: false,
  }));
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
  return nodes.map(node => ({
    id: node.id,
    type: node.type as NodeType,
    position: node.position,
    data: node.data,
  }));
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
  const contextMenu = useContextMenu();
  const { toasts, removeToast, success, error } = useToast();
  const reactFlowInstance = useReactFlow();

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

  // 通知父组件未保存状态变化
  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChange]);

  // 加载工作流
  useEffect(() => {
    const loadWorkflow = async () => {
      if (workflowId) {
        try {
          const workflow = await workflowApi.getWorkflow(workflowId);
          if (workflow) {
            setNodes(toReactFlowNodes(workflow.nodes || []));
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
  }, [workflowId, setNodes, setEdges]);

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

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveWorkflow();
      }
      // Delete 或 Backspace 删除选中节点
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(e => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
          markUnsaved();
        }
      }
      // Ctrl+X 剪切（删除）
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          setNodes(nds => nds.filter(n => !n.selected));
          setEdges(eds => eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
          markUnsaved();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveWorkflow, nodes, edges, setNodes, setEdges, markUnsaved]);

  // 连接节点
  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#FF6B00', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#FF6B00' },
    }, eds));
    markUnsaved();
  }, [setEdges, markUnsaved]);

  // 节点变化时标记未保存
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    // 只有位置变化或删除时才标记未保存
    if (changes.some((c: any) => c.type === 'position' && c.dragging === false || c.type === 'remove')) {
      markUnsaved();
    }
  }, [onNodesChange, markUnsaved]);

  // 边变化时标记未保存
  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    if (changes.some((c: any) => c.type === 'remove')) {
      markUnsaved();
    }
  }, [onEdgesChange, markUnsaved]);

  // 添加组件
  const handleAddComponent = useCallback((component: ComponentDefinition) => {
    const position = reactFlowInstance.screenToFlowPosition({ x: 200, y: 200 });
    const newNode: Node = {
      id: generateId(),
      type: component.type,
      position,
      data: { label: component.name, description: component.description, config: { ...component.defaultConfig } },
    };
    setNodes(nds => [...nds, newNode]);
    setIsPanelOpen(false);
    markUnsaved();
  }, [setNodes, markUnsaved, reactFlowInstance]);

  // 拖放添加组件
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('component');
    if (!componentData) return;
    try {
      const component: ComponentDefinition = JSON.parse(componentData);
      const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: generateId(),
        type: component.type,
        position,
        data: { label: component.name, description: component.description, config: { ...component.defaultConfig } },
      };
      setNodes(nds => [...nds, newNode]);
      setIsPanelOpen(false);
      markUnsaved();
    } catch {}
  }, [setNodes, markUnsaved, reactFlowInstance]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 双击编辑节点
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
  }, []);

  // 右键菜单
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    contextMenu.open(e, node.id);
  }, [contextMenu]);

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
          setNodes(toReactFlowNodes(w.nodes));
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

  const handleComponentDragStart = useCallback((e: React.DragEvent, component: ComponentDefinition) => {
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
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectNodesOnDrag
          defaultViewport={defaultViewport}
          snapToGrid={false}
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

      {contextMenu.isOpen && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={contextMenu.close}
          items={[
            { label: '编辑节点', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>, onClick: () => setEditingNodeId(contextMenu.data) },
            { label: '复制节点', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>, onClick: () => duplicateNode(contextMenu.data) },
            { divider: true, label: '', onClick: () => {} },
            { label: '删除节点', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, danger: true, onClick: () => deleteNode(contextMenu.data) }
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
