// 文章/想法类型定义

export interface Idea {
  id: string;
  user_id: string;
  title?: string; // 标题可选
  content: string;
  tags: string[];
  source: 'manual' | 'feishu';
  created_at: string;
  updated_at: string;
}

export interface CreateIdeaData {
  title?: string; // 标题可选
  content: string;
  tags?: string[];
  source?: 'manual' | 'feishu';
}

export interface UpdateIdeaData {
  title?: string;
  content?: string;
  tags?: string[];
}
