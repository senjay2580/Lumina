// 人物角色类型定义

export interface Character {
  id: string;
  user_id: string;
  name: string;
  type: 'real' | 'virtual'; // 真实人物或虚拟角色
  personality_traits?: string; // 性格特点描述
  personality_summary?: string; // AI总结的性格
  learning_points?: string; // 应该模仿的特点
  learning_summary?: string; // AI总结的学习要点
  avatar_url?: string; // 头像
  created_at: string;
  updated_at: string;
}

export interface CharacterEvent {
  id: string;
  character_id: string;
  title: string;
  description?: string;
  event_date?: string;
  created_at: string;
  sort_order: number;
}

export interface CharacterBehavior {
  id: string;
  event_id: string;
  type: 'speech' | 'action'; // 语言或行为
  content: string;
  context?: string; // 情境描述
  created_at: string;
  sort_order: number;
}

export interface CharacterWithDetails extends Character {
  events: (CharacterEvent & { behaviors: CharacterBehavior[] })[];
}

export interface CreateCharacterData {
  name: string;
  type: 'real' | 'virtual';
  personality_traits?: string;
  avatar_url?: string;
}

export interface UpdateCharacterData {
  name?: string;
  type?: 'real' | 'virtual';
  personality_traits?: string;
  personality_summary?: string;
  learning_points?: string;
  learning_summary?: string;
  avatar_url?: string;
  sort_order?: number;
}

export interface CreateEventData {
  character_id: string;
  title: string;
  description?: string;
  event_date?: string;
  sort_order?: number;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  event_date?: string;
  sort_order?: number;
}

export interface CreateBehaviorData {
  event_id: string;
  type: 'speech' | 'action';
  content: string;
  context?: string;
  sort_order?: number;
}

export interface UpdateBehaviorData {
  type?: 'speech' | 'action';
  content?: string;
  context?: string;
  sort_order?: number;
}
