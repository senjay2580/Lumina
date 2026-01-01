import { supabase } from './supabase';
import { NodeTemplate, HandleDefinition } from '../types';

// 数据库记录类型
interface NodeTemplateRecord {
  id: string;
  type: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  icon_svg: string | null;
  color: string | null;
  shape: string | null;
  input_handles: HandleDefinition[] | null;
  output_handles: HandleDefinition[] | null;
  default_config: Record<string, any> | null;
  config_schema: any | null;
  requires_provider: boolean | null;
  sort_order: number | null;
  is_system: boolean;
}

// 获取所有节点模板（组件库）
export async function getNodeTemplates(): Promise<NodeTemplate[]> {
  const { data, error } = await supabase
    .from('node_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取节点模板失败:', error);
    return [];
  }

  return (data || []).map((r: NodeTemplateRecord) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description || '',
    category: r.category as NodeTemplate['category'],
    icon: r.icon || 'default',
    iconSvg: r.icon_svg || '',
    color: r.color || 'gray',
    shape: (r.shape || 'rectangle') as NodeTemplate['shape'],
    inputHandles: r.input_handles || [],
    outputHandles: r.output_handles || [],
    defaultConfig: r.default_config || {},
    configSchema: r.config_schema || {},
    requiresProvider: r.requires_provider || false,
    sortOrder: r.sort_order || 0,
    isSystem: r.is_system,
  }));
}

// 兼容旧代码
export const getComponents = getNodeTemplates;

// 根据类型获取单个模板
export async function getNodeTemplateByType(type: string): Promise<NodeTemplate | null> {
  const { data, error } = await supabase
    .from('node_templates')
    .select('*')
    .eq('type', type)
    .single();

  if (error || !data) return null;

  const r = data as NodeTemplateRecord;
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description || '',
    category: r.category as NodeTemplate['category'],
    icon: r.icon || 'default',
    iconSvg: r.icon_svg || '',
    color: r.color || 'gray',
    shape: (r.shape || 'rectangle') as NodeTemplate['shape'],
    inputHandles: r.input_handles || [],
    outputHandles: r.output_handles || [],
    defaultConfig: r.default_config || {},
    configSchema: r.config_schema || {},
    requiresProvider: r.requires_provider || false,
    sortOrder: r.sort_order || 0,
    isSystem: r.is_system,
  };
}
