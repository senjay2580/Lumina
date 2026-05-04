// 文章数据库操作（kind='article'）
import { supabase } from './supabase';
import type { Idea, CreateIdeaData, UpdateIdeaData } from '../types/idea';

export type Article = Idea;

export async function getArticles(userId: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'article')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getArticle(articleId: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', articleId)
    .single();

  if (error) throw error;
  return data;
}

export async function createArticle(
  userId: string,
  data: CreateIdeaData
): Promise<Article> {
  const { data: article, error } = await supabase
    .from('ideas')
    .insert({
      user_id: userId,
      ...data,
      kind: 'article',
      source: data.source || 'manual'
    })
    .select()
    .single();

  if (error) throw error;
  return article;
}

export async function updateArticle(
  articleId: string,
  data: UpdateIdeaData
): Promise<Article> {
  const { data: article, error } = await supabase
    .from('ideas')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', articleId)
    .select()
    .single();

  if (error) throw error;
  return article;
}

export async function deleteArticle(articleId: string): Promise<void> {
  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', articleId);

  if (error) throw error;
}

export async function searchArticles(userId: string, keyword: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'article')
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,excerpt.ilike.%${keyword}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============ 笔记/备注（评论区式） ============
export interface ArticleNote {
  id: string;
  article_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export async function getNotes(articleId: string): Promise<ArticleNote[]> {
  const { data, error } = await supabase
    .from('article_notes')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addNote(
  userId: string,
  articleId: string,
  content: string
): Promise<ArticleNote> {
  const { data, error } = await supabase
    .from('article_notes')
    .insert({ user_id: userId, article_id: articleId, content })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('article_notes').delete().eq('id', noteId);
  if (error) throw error;
}

// ============ 同类文章推荐 ============
function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  const t = text.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[#>*`_\-\[\]\(\)]/g, ' ');
  const tokens = new Set<string>();
  // 英文词
  (t.match(/[a-z]{3,}/g) || []).forEach((w) => tokens.add(w));
  // 中文 2-gram
  const chunks = t.match(/[一-龥]+/g) || [];
  for (const seg of chunks) {
    for (let i = 0; i + 2 <= seg.length; i++) tokens.add(seg.slice(i, i + 2));
  }
  return tokens;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function intersectionSize<T>(a: Set<T>, b: Set<T>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export async function getRelatedArticles(
  userId: string,
  current: Article,
  limit = 5
): Promise<{ article: Article; score: number }[]> {
  const all = await getArticles(userId);
  const others = all.filter((a) => a.id !== current.id);
  if (others.length === 0) return [];

  const tagsA = new Set(current.tags || []);
  const titleA = tokenize(current.title || '');
  const contentA = tokenize(current.content || '');

  const scored = others.map((a) => {
    const tagsB = new Set(a.tags || []);
    const titleB = tokenize(a.title || '');
    const contentB = tokenize(a.content || '');

    const tagJaccard = jaccard(tagsA, tagsB);
    const titleOverlap = intersectionSize(titleA, titleB);
    const contentOverlap = intersectionSize(contentA, contentB);
    const contentScore = Math.min(contentOverlap / 30, 1);

    const score = tagJaccard * 6 + titleOverlap * 0.6 + contentScore * 1.5;
    return { article: a, score };
  });

  return scored
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
