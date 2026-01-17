// 习惯纠正站数据库操作
import { supabase } from './supabase';
import type {
  HabitSchedule,
  CreateHabitScheduleData,
  UpdateHabitScheduleData
} from '../types/habit';

// ============ 计划操作 ============

export async function getHabitSchedules(userId: string): Promise<HabitSchedule[]> {
  const { data, error } = await supabase
    .from('habit_schedules')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getHabitSchedule(scheduleId: string): Promise<HabitSchedule | null> {
  const { data, error } = await supabase
    .from('habit_schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error) throw error;
  return data;
}

export async function createHabitSchedule(
  userId: string,
  data: CreateHabitScheduleData
): Promise<HabitSchedule> {
  const { data: schedule, error } = await supabase
    .from('habit_schedules')
    .insert({
      user_id: userId,
      ...data
    })
    .select()
    .single();

  if (error) throw error;
  return schedule;
}

export async function updateHabitSchedule(
  scheduleId: string,
  data: UpdateHabitScheduleData
): Promise<HabitSchedule> {
  const { data: schedule, error } = await supabase
    .from('habit_schedules')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) throw error;
  return schedule;
}

export async function deleteHabitSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('habit_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) throw error;
}

// ============ 统计操作 ============

export async function getScheduleStats(userId: string): Promise<{
  total: number;
  active: number;
}> {
  const { data: schedules, error } = await supabase
    .from('habit_schedules')
    .select('id, is_active')
    .eq('user_id', userId);

  if (error) throw error;

  const total = schedules?.length || 0;
  const active = schedules?.filter(s => s.is_active).length || 0;

  return { total, active };
}
