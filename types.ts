export enum NodeType {
  AI_INPUT = 'AI_INPUT',
  AI_PROCESSOR = 'AI_PROCESSOR'
}

export interface Position {
  x: number;
  y: number;
}

export interface NodeConfig {
  // AI Input 配置
  inputType?: 'text' | 'file' | 'api';
  placeholder?: string;
  
  // AI Processor 配置
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  apiUrl?: string;
  ignoreSSL?: boolean;
}

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

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

// 组件定义（用于右侧面板）
export interface ComponentDefinition {
  type: NodeType;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: 'input' | 'processor' | 'output';
  defaultConfig: NodeConfig;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: NodeType.AI_INPUT,
    name: 'AI 输入',
    description: '接收用户输入或外部数据，作为工作流的起点',
    icon: 'input',
    color: 'green',
    category: 'input',
    defaultConfig: {
      inputType: 'text',
      placeholder: '请输入内容...'
    }
  },
  {
    type: NodeType.AI_PROCESSOR,
    name: 'AI 处理器',
    description: '配置 AI 提示词，处理输入流并生成输出流',
    icon: 'processor',
    color: 'blue',
    category: 'processor',
    defaultConfig: {
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      maxTokens: 2048
    }
  }
];

// Prompt 相关类型 - 动态分类
export interface PromptCategory {
  id: string;
  name: string;
  color: string; // Tailwind color class
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string; // 关联到 PromptCategory.id
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// 默认分类
export const DEFAULT_PROMPT_CATEGORIES: PromptCategory[] = [
  { id: 'creative', name: 'Creative', color: 'orange' },
  { id: 'technical', name: 'Technical', color: 'blue' },
  { id: 'business', name: 'Business', color: 'green' },
  { id: 'academic', name: 'Academic', color: 'purple' }
];
