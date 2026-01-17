// 人物角色数据库操作
import { supabase } from './supabase';
import type {
  Character,
  CharacterWithDetails,
  CharacterEvent,
  CharacterBehavior,
  CreateCharacterData,
  UpdateCharacterData,
  CreateEventData,
  UpdateEventData,
  CreateBehaviorData,
  UpdateBehaviorData
} from '../types/character';

// ============ 角色操作 ============

export async function getCharacters(userId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateCharacterOrder(characterId: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({ sort_order: sortOrder })
    .eq('id', characterId);

  if (error) throw error;
}

export async function getCharacter(characterId: string): Promise<CharacterWithDetails | null> {
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single();

  if (characterError) throw characterError;
  if (!character) return null;

  const { data: events, error: eventsError } = await supabase
    .from('character_events')
    .select('*')
    .eq('character_id', characterId)
    .order('sort_order', { ascending: true });

  if (eventsError) throw eventsError;

  const eventsWithBehaviors = await Promise.all(
    (events || []).map(async (event) => {
      const { data: behaviors, error: behaviorsError } = await supabase
        .from('character_behaviors')
        .select('*')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true });

      if (behaviorsError) throw behaviorsError;

      return {
        ...event,
        behaviors: behaviors || []
      };
    })
  );

  return {
    ...character,
    events: eventsWithBehaviors
  };
}

export async function createCharacter(
  userId: string,
  data: CreateCharacterData
): Promise<Character> {
  const { data: character, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      ...data
    })
    .select()
    .single();

  if (error) throw error;
  return character;
}

export async function updateCharacter(
  characterId: string,
  data: UpdateCharacterData
): Promise<Character> {
  const { data: character, error } = await supabase
    .from('characters')
    .update(data)
    .eq('id', characterId)
    .select()
    .single();

  if (error) throw error;
  return character;
}

export async function deleteCharacter(characterId: string): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', characterId);

  if (error) throw error;
}

// ============ 事件操作 ============

export async function createEvent(data: CreateEventData): Promise<CharacterEvent> {
  const { data: event, error } = await supabase
    .from('character_events')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return event;
}

export async function updateEvent(
  eventId: string,
  data: UpdateEventData
): Promise<CharacterEvent> {
  const { data: event, error } = await supabase
    .from('character_events')
    .update(data)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return event;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('character_events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

// ============ 言行操作 ============

export async function createBehavior(data: CreateBehaviorData): Promise<CharacterBehavior> {
  const { data: behavior, error } = await supabase
    .from('character_behaviors')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return behavior;
}

export async function updateBehavior(
  behaviorId: string,
  data: UpdateBehaviorData
): Promise<CharacterBehavior> {
  const { data: behavior, error } = await supabase
    .from('character_behaviors')
    .update(data)
    .eq('id', behaviorId)
    .select()
    .single();

  if (error) throw error;
  return behavior;
}

export async function deleteBehavior(behaviorId: string): Promise<void> {
  const { error } = await supabase
    .from('character_behaviors')
    .delete()
    .eq('id', behaviorId);

  if (error) throw error;
}
