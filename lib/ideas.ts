// 文章/想法数据库操作
import { supabase } from './supabase';
import type { Idea, CreateIdeaData, UpdateIdeaData } from '../types/idea';

export async function getIdeas(userId: string): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getIdea(ideaId: string): Promise<Idea | null> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', ideaId)
    .single();

  if (error) throw error;
  return data;
}

export async function createIdea(
  userId: string,
  data: CreateIdeaData
): Promise<Idea> {
  const { data: idea, error } = await supabase
    .from('ideas')
    .insert({
      user_id: userId,
      ...data,
      source: data.source || 'manual'
    })
    .select()
    .single();

  if (error) throw error;
  return idea;
}

export async function updateIdea(
  ideaId: string,
  data: UpdateIdeaData
): Promise<Idea> {
  const { data: idea, error } = await supabase
    .from('ideas')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', ideaId)
    .select()
    .single();

  if (error) throw error;
  return idea;
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', ideaId);

  if (error) throw error;
}

export async function searchIdeas(userId: string, keyword: string): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
