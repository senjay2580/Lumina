// 节点类型（动态从数据库加载，这里只定义常用的）
export type NodeType = string;

// 常用节点类型常量
export const NODE_TYPES = {
  MANUAL_TRIGGER: 'MANUAL_TRIGGER',
  INPUT: 'INPUT',
  AI_MODEL: 'AI_MODEL',
} as const;

export interface Position {
  x: number;
  y: number;
}

// 节点配置（动态，根据 config_schema 生成）
export interface NodeConfig {
  [key: string]: any;
}

// 连接点定义
export interface HandleDefinition {
  id: string;
  type: string;
  label?: string;
}

// 工作流中的节点实例
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: {
    label: string;
    description?: string;
    config?: NodeConfig;
  };
}

// 工作流中的连线
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// 工作流
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

// 节点模板（组件库中的定义，从数据库加载）
export interface NodeTemplate {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  category: 'trigger' | 'input' | 'processor' | 'output' | 'annotation';
  // 外观
  icon: string;
  iconSvg: string;
  color: string;
  shape: 'diamond' | 'rounded' | 'hexagon' | 'rectangle' | 'circle' | 'sticky' | 'group';
  // 连接点
  inputHandles: HandleDefinition[];
  outputHandles: HandleDefinition[];
  // 配置
  defaultConfig: NodeConfig;
  configSchema: any; // JSON Schema
  // API 关联
  requiresProvider: boolean;
  // 元数据
  sortOrder: number;
  isSystem: boolean;
}

// 兼容旧代码的别名
export type ComponentDefinition = NodeTemplate;

// AI 提供商模板（系统预设）
export interface AIProviderTemplate {
  id: string;
  providerKey: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  color: string;
  sortOrder: number;
}

// 用户的 AI 提供商配置
export interface AIProvider {
  id: string;
  userId: string;
  providerKey: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: { id: string; name: string }[];
  isEnabled: boolean;
}

// Prompt 相关类型
export interface PromptCategory {
  id: string;
  name: string;
  color: string;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
