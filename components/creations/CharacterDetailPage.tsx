// 人物角色详情页面 - 重新设计
import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Plus, Edit2, X, Save } from 'lucide-react';
import { updateCharacter, deleteCharacter, createEvent, updateEvent, deleteEvent, createBehavior, updateBehavior, deleteBehavior } from '../../lib/characters';
import type { CharacterWithDetails, CharacterEvent, CharacterBehavior } from '../../types/character';
import { Confirm } from '../../shared/Confirm';

interface Props {
  character: CharacterWithDetails;
  onBack: () => void;
}

export default function CharacterDetailPage({ character, onBack }: Props) {
  const [editData, setEditData] = useState({
    personality_traits: character.personality_traits || '',
    learning_points: character.learning_points || ''
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [events, setEvents] = useState(character.events);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: ''
  });
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
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  useEffect(() => {
    const changed = 
      editData.personality_traits !== (character.personality_traits || '') ||
      editData.learning_points !== (character.learning_points || '');
    setHasChanges(changed);
  }, [editData, character]);

  const handleSave = async () => {
    try {
      await updateCharacter(character.id, editData);
      setAlertDialog({
        isOpen: true,
        title: '保存成功',
        message: '角色信息已更新'
      });
      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (err) {
      console.error('Failed to save:', err);
      setAlertDialog({
        isOpen: true,
        title: '保存失败',
        message: '请稍后重试'
      });
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '删除角色',
      message: '确定删除这个角色吗？所有相关数据都将被删除。',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteCharacter(character.id);
          onBack();
        } catch (err) {
          console.error('Failed to delete:', err);
          setAlertDialog({
            isOpen: true,
            title: '删除失败',
            message: '请稍后重试'
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddEvent = async () => {
    if (!newEventData.title.trim()) return;
    
    try {
      const newEvent = await createEvent({
        character_id: character.id,
        title: newEventData.title,
        description: newEventData.description || undefined,
        sort_order: events.length
      });
      setEvents([...events, { ...newEvent, behaviors: [] }]);
      setShowNewEvent(false);
      setNewEventData({ title: '', description: '' });
    } catch (err) {
      console.error('Failed to add event:', err);
      setAlertDialog({
        isOpen: true,
        title: '添加失败',
        message: '请稍后重试'
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除事件',
      message: '确定删除这个事件吗？',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteEvent(eventId);
          setEvents(events.filter(e => e.id !== eventId));
        } catch (err) {
          console.error('Failed to delete event:', err);
          setAlertDialog({
            isOpen: true,
            title: '删除失败',
            message: '请稍后重试'
          });
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 头部导航 */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="grid grid-cols-3 gap-6">
          {/* 左侧：角色信息卡片 */}
          <div className="col-span-1">
            <div className="bg-white border-2 border-gray-900 p-6 sticky top-6">
              {/* 头像 */}
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 border-2 border-gray-900 bg-gray-100 flex items-center justify-center">
                  {character.type === 'real' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" className="text-gray-400">
                      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                        <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                      </g>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" className="text-gray-400">
                      <path fill="currentColor" d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 18A1.5 1.5 0 0 0 6 19.5A1.5 1.5 0 0 0 7.5 21A1.5 1.5 0 0 0 9 19.5A1.5 1.5 0 0 0 7.5 18m9 0a1.5 1.5 0 0 0-1.5 1.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5a1.5 1.5 0 0 0-1.5-1.5"/>
                    </svg>
                  )}
                </div>
              </div>

              {/* 名字 */}
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
                {character.name}
              </h1>

              {/* 性格特点 */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">性格特点</h3>
                <textarea
                  value={editData.personality_traits}
                  onChange={(e) => setEditData({ ...editData, personality_traits: e.target.value })}
                  className="w-full p-3 border border-gray-300 text-sm resize-none focus:border-gray-900 outline-none"
                  rows={6}
                  placeholder="描述性格特点..."
                />
                {character.personality_summary && (
                  <div className="mt-2 p-2 bg-blue-50 text-xs text-gray-700">
                    <div className="font-medium text-blue-600 mb-1">AI 总结</div>
                    {character.personality_summary}
                  </div>
                )}
              </div>

              {/* 值得学习的特点 */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">值得学习的特点</h3>
                <textarea
                  value={editData.learning_points}
                  onChange={(e) => setEditData({ ...editData, learning_points: e.target.value })}
                  className="w-full p-3 border border-gray-300 text-sm resize-none focus:border-gray-900 outline-none"
                  rows={6}
                  placeholder="记录值得学习的特点..."
                />
                {character.learning_summary && (
                  <div className="mt-2 p-2 bg-blue-50 text-xs text-gray-700">
                    <div className="font-medium text-blue-600 mb-1">AI 总结</div>
                    {character.learning_summary}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="space-y-2">
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    className="w-full py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    保存更改
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="w-full py-2 border-2 border-red-600 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  删除角色
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：事件时间线 */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">经历的事件</h2>
              <button
                onClick={() => setShowNewEvent(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加事件
              </button>
            </div>

            {/* 新建事件表单 */}
            {showNewEvent && (
              <div className="bg-white border-2 border-gray-900 p-6 mb-4">
                <h3 className="font-bold text-gray-900 mb-4">添加新事件</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      事件标题 *
                    </label>
                    <input
                      type="text"
                      value={newEventData.title}
                      onChange={(e) => setNewEventData({ ...newEventData, title: e.target.value })}
                      placeholder="例如：第一次见面、重要对话"
                      className="w-full px-3 py-2 border border-gray-300 focus:border-gray-900 outline-none"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      事件描述
                    </label>
                    <textarea
                      value={newEventData.description}
                      onChange={(e) => setNewEventData({ ...newEventData, description: e.target.value })}
                      placeholder="描述事件的背景、情境、发生了什么..."
                      className="w-full px-3 py-2 border border-gray-300 focus:border-gray-900 outline-none resize-none"
                      rows={4}
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowNewEvent(false);
                      setNewEventData({ title: '', description: '' });
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddEvent}
                    disabled={!newEventData.title.trim()}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    保存事件
                  </button>
                </div>
              </div>
            )}

            {/* 事件列表 */}
            {events.length === 0 ? (
              <div className="bg-white border-2 border-gray-900 p-12 text-center">
                <div className="text-gray-400 mb-2">暂无事件记录</div>
                <button
                  onClick={() => setShowNewEvent(true)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  添加第一个事件
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="bg-white border-2 border-gray-900 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {event.description && (
                      <p className="text-gray-700 text-sm mb-4">{event.description}</p>
                    )}

                    {/* 言行记录 */}
                    {event.behaviors.length > 0 && (
                      <div className="space-y-2 border-t border-gray-200 pt-4">
                        {event.behaviors.map((behavior) => (
                          <div key={behavior.id} className="flex gap-3 text-sm">
                            <div className={`px-2 py-1 text-xs font-medium ${
                              behavior.type === 'speech' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {behavior.type === 'speech' ? '语言' : '行为'}
                            </div>
                            <div className="flex-1">
                              <div className="text-gray-900">{behavior.content}</div>
                              {behavior.context && (
                                <div className="text-gray-500 text-xs mt-1">{behavior.context}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      <Confirm
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />

      {/* 提示对话框 */}
      <Confirm
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        confirmText="确定"
        onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        onCancel={() => setAlertDialog({ ...alertDialog, isOpen: false })}
      />
    </div>
  );
}
