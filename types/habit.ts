// 习惯纠正站类型定义

export interface HabitSchedule {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  reminder_times: string[]; // HH:MM format array
  days_of_week: number[]; // 1-7 (Monday-Sunday)
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export interface CreateHabitScheduleData {
  title: string;
  description?: string;
  reminder_times: string[];
  days_of_week?: number[];
  is_active?: boolean;
}

export interface UpdateHabitScheduleData {
  title?: string;
  description?: string;
  reminder_times?: string[];
  days_of_week?: number[];
  is_active?: boolean;
  sort_order?: number;
}
