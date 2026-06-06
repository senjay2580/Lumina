// 文章/想法类型定义

export type IdeaKind = 'idea' | 'article';

export interface Idea {
  id: string;
  user_id: string;
  kind: IdeaKind;
  title?: string;
  content: string;
  excerpt?: string;
  cover_url?: string;
  tags: string[];
  source: 'manual' | 'feishu';
  is_pinned?: boolean;
  pinned_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIdeaData {
  kind?: IdeaKind;
  title?: string;
  content: string;
  excerpt?: string;
  cover_url?: string;
  tags?: string[];
  source?: 'manual' | 'feishu';
  is_pinned?: boolean;
  pinned_at?: string | null;
  deleted_at?: string | null;
}

export interface UpdateIdeaData {
  title?: string;
  content?: string;
  excerpt?: string;
  cover_url?: string;
  tags?: string[];
  is_pinned?: boolean;
  pinned_at?: string | null;
  deleted_at?: string | null;
}
