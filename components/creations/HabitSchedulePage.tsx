// 习惯纠正站 - 时间段计划管理
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Clock, Trash2, Edit2, Power, PowerOff } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getHabitSchedules,
  createHabitSchedule,
  updateHabitSchedule,
  deleteHabitSchedule,
  getScheduleStats
} from '../../lib/habit-schedules';
import type { HabitSchedule, CreateHabitScheduleData } from '../../types/habit';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  onBack: () => void;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function HabitSchedulePage({ userId, onBack }: Props) {
  const [schedules, setSchedules] = useState<HabitSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<HabitSchedule | null>(null);
  
  const [formData, setFormData] = useState<CreateHabitScheduleData>({
    title: '',
    description: '',
    reminder_times: [],
    days_of_week: [1, 2, 3, 4, 5], // 默认工作日
    is_active: true
  });

  const [newTimeInput, setNewTimeInput] = useState('');
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    danger: false
  });

  useEffect(() => {
    loadSchedules();
  }, [userId]);

  const loadSchedules = async () => {
    try {
      const data = await getHabitSchedules(userId);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;

    try {
      await createHabitSchedule(userId, formData);
      await loadSchedules();
      setShowNewDialog(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create schedule:', err);
    }
  };

  const handleUpdate = async () => {
    if (!editingSchedule || !formData.title.trim()) return;

    try {
      await updateHabitSchedule(editingSchedule.id, formData);
      await loadSchedules();
      setEditingSchedule(null);
      resetForm();
    } catch (err) {
      console.error('Failed to update schedule:', err);
    }
  };

  const handleDelete = (schedule: HabitSchedule) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除计划',
      message: `确定要删除"${schedule.title}"吗？`,
      danger: true,
      onConfirm: async () => {
        try {
          await deleteHabitSchedule(schedule.id);
          await loadSchedules();
        } catch (err) {
          console.error('Failed to delete schedule:', err);
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleToggleActive = async (schedule: HabitSchedule) => {
    try {
      await updateHabitSchedule(schedule.id, { is_active: !schedule.is_active });
      await loadSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handleEdit = (schedule: HabitSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      title: schedule.title,
      description: schedule.description || '',
      reminder_times: schedule.reminder_times,
      days_of_week: schedule.days_of_week,
      is_active: schedule.is_active
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      reminder_times: [],
      days_of_week: [1, 2, 3, 4, 5],
      is_active: true
    });
    setNewTimeInput('');
    setEditingTimeIndex(null);
    setEditingTimeValue('');
  };

  const addReminderTime = () => {
    if (newTimeInput && !formData.reminder_times.includes(newTimeInput)) {
      setFormData({
        ...formData,
        reminder_times: [...formData.reminder_times, newTimeInput].sort()
      });
      setNewTimeInput('');
    }
  };

  const removeReminderTime = (time: string) => {
    setFormData({
      ...formData,
      reminder_times: formData.reminder_times.filter(t => t !== time)
    });
  };

  const startEditTime = (index: number) => {
    setEditingTimeIndex(index);
    setEditingTimeValue(formData.reminder_times[index]);
  };

  const saveEditTime = () => {
    if (editingTimeIndex !== null && editingTimeValue) {
      const newTimes = [...formData.reminder_times];
      newTimes[editingTimeIndex] = editingTimeValue;
      setFormData({
        ...formData,
        reminder_times: newTimes.sort()
      });
      setEditingTimeIndex(null);
      setEditingTimeValue('');
    }
  };

  const cancelEditTime = () => {
    setEditingTimeIndex(null);
    setEditingTimeValue('');
  };

  const toggleWeekday = (day: number) => {
    const current = formData.days_of_week || [];
    if (current.includes(day)) {
      setFormData({ ...formData, days_of_week: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, days_of_week: [...current, day].sort() });
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回创作中心
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">习惯纠正站</h1>
              <p className="text-gray-600">配置时间段计划，飞书提前提醒</p>
            </div>
            
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
            >
              <Plus className="w-5 h-5" />
              新建计划
            </button>
          </div>
        </div>

        {/* 计划列表 */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有计划</h3>
            <p className="text-gray-600 mb-6">创建你的第一个时间段计划</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              新建计划
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-gray-900 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{schedule.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium ${
                        schedule.is_active 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {schedule.is_active ? '进行中' : '已完成'}
                      </span>
                    </div>
                    
                    {schedule.description && (
                      <p className="text-gray-600 text-sm mb-3">{schedule.description}</p>
                    )}
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Clock className="w-4 h-4" />
                        {schedule.reminder_times.map((time, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 font-medium">
                            {time}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {schedule.days_of_week.map(day => (
                          <span key={day} className="px-2 py-1 bg-gray-100 text-xs">
                            {WEEKDAYS[day - 1]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(schedule)}
                      className="p-2 hover:bg-gray-100 transition-colors"
                      title={schedule.is_active ? '标记为已完成' : '标记为进行中'}
                    >
                      {schedule.is_active ? (
                        <Power className="w-5 h-5 text-blue-600" />
                      ) : (
                        <PowerOff className="w-5 h-5 text-green-600" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-2 hover:bg-gray-100 transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule)}
                      className="p-2 hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 新建/编辑对话框 */}
        {(showNewDialog || editingSchedule) && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowNewDialog(false);
              setEditingSchedule(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-6">
                {editingSchedule ? '编辑计划' : '新建计划'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    计划标题 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例如：晨间锻炼、午休时间"
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="详细描述这个时间段要做什么..."
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none resize-none"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    提醒时间 * (可添加多个)
                  </label>
                  
                  {/* 已添加的时间列表 */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.reminder_times.map((time, index) => (
                      <div key={time}>
                        {editingTimeIndex === index ? (
                          // 编辑模式
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-2 border-blue-500">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <input
                              type="time"
                              value={editingTimeValue}
                              onChange={(e) => setEditingTimeValue(e.target.value)}
                              className="w-24 px-2 py-1 border border-blue-300 focus:border-blue-500 outline-none text-sm"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveEditTime}
                              className="text-green-600 hover:text-green-800 font-bold"
                              title="保存"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditTime}
                              className="text-red-600 hover:text-red-800"
                              title="取消"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          // 显示模式
                          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-2 border-gray-300 hover:border-gray-400 transition-colors cursor-pointer group">
                            <Clock className="w-4 h-4 text-gray-600" />
                            <span 
                              className="font-medium"
                              onClick={() => startEditTime(index)}
                              title="点击编辑"
                            >
                              {time}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeReminderTime(time)}
                              className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="删除"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 添加新时间 */}
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={newTimeInput}
                      onChange={(e) => setNewTimeInput(e.target.value)}
                      placeholder="选择时间"
                      className="flex-1 px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addReminderTime}
                      disabled={formData.reminder_times.includes(newTimeInput)}
                      className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    重复日期
                  </label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map((day, index) => (
                      <button
                        key={index}
                        onClick={() => toggleWeekday(index + 1)}
                        className={`flex-1 py-2 text-sm font-medium border-2 transition-colors ${
                          formData.days_of_week?.includes(index + 1)
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNewDialog(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={editingSchedule ? handleUpdate : handleCreate}
                  disabled={!formData.title.trim() || !formData.days_of_week?.length || !formData.reminder_times?.length}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingSchedule ? '保存' : '创建'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 确认对话框 */}
        <Confirm
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        />
      </div>
    </div>
  );
}
