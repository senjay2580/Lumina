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
