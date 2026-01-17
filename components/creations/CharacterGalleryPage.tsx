// 人物角色列表页面（与简历列表样式一致）
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, User, Loader2, Edit2, Trash2, Clock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { getCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter } from '../../lib/characters';
import type { Character, CharacterWithDetails } from '../../types/character';
import CharacterDetailPage from './CharacterDetailPage';
import { Confirm } from '../../shared/Confirm';

interface Props {
  userId: string;
  onBack: () => void;
}

export default function CharacterGalleryPage({ userId, onBack }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterType, setNewCharacterType] = useState<'real' | 'virtual'>('real');
  const [creating, setCreating] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'real' | 'virtual'>('real');
  const [isHidden, setIsHidden] = useState(() => {
    // 从 localStorage 读取保存的状态
    const saved = localStorage.getItem('character-cards-hidden');
    return saved === 'true';
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
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
    loadCharacters();
  }, [userId]);

  // 保存隐藏状态到 localStorage
  useEffect(() => {
    localStorage.setItem('character-cards-hidden', isHidden.toString());
  }, [isHidden]);

  const loadCharacters = async () => {
    try {
      const data = await getCharacters(userId);
      setCharacters(data);
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (newOrder: Character[]) => {
    setCharacters(newOrder);
    
    // 批量更新排序到数据库
    try {
      await Promise.all(
        newOrder.map((character, index) => 
          updateCharacter(character.id, { sort_order: index })
        )
      );
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  const handleDragStart = (index: number) => {
    if (isHidden) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || isHidden) return;

    const newCharacters = [...characters];
    const draggedItem = newCharacters[draggedIndex];
    newCharacters.splice(draggedIndex, 1);
    newCharacters.splice(index, 0, draggedItem);

    setCharacters(newCharacters);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);
    
    // 保存新顺序到数据库
    try {
      await Promise.all(
        characters.map((character, index) => 
          updateCharacter(character.id, { sort_order: index })
        )
      );
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCreateCharacter = async () => {
    if (!newCharacterName.trim()) return;
    
    setCreating(true);
    try {
      await createCharacter(userId, {
        name: newCharacterName,
        type: newCharacterType
      });
      await loadCharacters();
      setShowNewDialog(false);
      setNewCharacterName('');
      setNewCharacterType('real');
    } catch (err) {
      console.error('Failed to create character:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleEditCharacter = (character: Character, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCharacter(character);
    setEditName(character.name);
    setEditType(character.type);
  };

  const handleSaveEdit = async () => {
    if (!editingCharacter || !editName.trim()) return;
    
    try {
      await updateCharacter(editingCharacter.id, {
        name: editName,
        type: editType
      });
      await loadCharacters();
      setEditingCharacter(null);
    } catch (err) {
      console.error('Failed to update character:', err);
    }
  };

  const handleDeleteCharacter = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: '删除角色',
      message: '确定要删除这个角色吗？所有相关数据都将被删除。',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteCharacter(id);
          await loadCharacters();
        } catch (err) {
          console.error('Failed to delete character:', err);
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleSelectCharacter = async (characterId: string) => {
    try {
      const character = await getCharacter(characterId);
      setSelectedCharacter(character);
      setView('detail');
    } catch (err) {
      console.error('Failed to load character:', err);
    }
  };

  const handleBackToList = () => {
    setSelectedCharacter(null);
    setView('list');
    loadCharacters();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (view === 'detail' && selectedCharacter) {
    return (
      <CharacterDetailPage
        character={selectedCharacter}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            ← 返回创作中心
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">语言/行为</h1>
              <p className="text-gray-600">收录角色，学习优秀特质</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsHidden(!isHidden)}
                className="flex items-center gap-2 px-4 py-3 border-2 border-gray-900 hover:bg-gray-100 transition-colors"
                title={isHidden ? '显示卡片' : '隐藏卡片'}
              >
                {isHidden ? (
                  <>
                    <Eye className="w-5 h-5" />
                    显示
                  </>
                ) : (
                  <>
                    <EyeOff className="w-5 h-5" />
                    隐藏
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
              >
                <Plus className="w-5 h-5" />
                收录角色
              </button>
            </div>
          </div>
        </div>

        {/* 角色列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-20">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有角色</h3>
            <p className="text-gray-600 mb-6">收录身边的优秀人物或虚拟角色</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              收录角色
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {characters.map((character, index) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: draggedIndex === index ? 0.3 : 1, 
                  y: 0,
                  scale: draggedIndex === index ? 0.95 : 1
                }}
                transition={{ delay: draggedIndex === null ? index * 0.05 : 0, duration: 0.2 }}
                draggable={!isHidden}
                onDragStart={(e) => {
                  handleDragStart(index);
                  // 创建自定义拖拽图像
                  const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
                  dragImage.style.position = 'absolute';
                  dragImage.style.top = '-9999px';
                  dragImage.style.width = e.currentTarget.clientWidth + 'px';
                  dragImage.style.opacity = '0.8';
                  dragImage.style.transform = 'rotate(3deg)';
                  document.body.appendChild(dragImage);
                  e.dataTransfer.setDragImage(dragImage, e.currentTarget.clientWidth / 2, e.currentTarget.clientHeight / 2);
                  setTimeout(() => document.body.removeChild(dragImage), 0);
                }}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                className={`relative group transition-all duration-200 ${
                  !isHidden ? 'cursor-move' : 'cursor-pointer'
                } ${draggedIndex === index ? 'z-50' : ''}`}
                style={{ perspective: '1000px' }}
              >
                {/* 拖拽指示器 */}
                {!isHidden && draggedIndex !== index && (
                  <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border-2 border-dashed border-transparent group-hover:border-gray-400 rounded transition-colors pointer-events-none" />
                )}
                
                {/* 3D 翻转容器 */}
                <div
                  className="relative h-80 transition-transform duration-700"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isHidden ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                  onClick={() => !isHidden && handleSelectCharacter(character.id)}
                >
                  {/* 正面 - 角色卡片 */}
                  <div
                    className={`absolute inset-0 bg-white border-2 border-gray-900 overflow-hidden transition-all ${
                      draggedIndex === index 
                        ? 'shadow-2xl' 
                        : 'hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden'
                    }}
                  >
                    {/* 内容区域 */}
                    <div className="p-4 flex flex-col h-full">
                      {/* 头像区域 - 通过图标区分类型 */}
                      <div className="flex-1 flex items-center justify-center mb-4">
                        <div className="w-24 h-24 border-2 border-gray-900 bg-gray-100 flex items-center justify-center">
                          {character.type === 'real' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" className="text-gray-400">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                                <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                              </g>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" className="text-gray-400">
                              <path fill="currentColor" d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 18A1.5 1.5 0 0 0 6 19.5A1.5 1.5 0 0 0 7.5 21A1.5 1.5 0 0 0 9 19.5A1.5 1.5 0 0 0 7.5 18m9 0a1.5 1.5 0 0 0-1.5 1.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5a1.5 1.5 0 0 0-1.5-1.5"/>
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* 名字 */}
                      <div className="text-center mb-3">
                        <h3 className="text-xl font-bold text-gray-900 line-clamp-2">
                          {character.name}
                        </h3>
                      </div>

                      {/* 底部按钮 */}
                      <button
                        className="w-full py-2 border-2 border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-900 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCharacter(character.id);
                        }}
                      >
                        查看详情
                      </button>
                    </div>

                    {/* 编辑/删除按钮 - 悬停显示 */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditCharacter(character, e)}
                        className="p-2 bg-white hover:bg-gray-100 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCharacter(character.id, e)}
                        className="p-2 bg-white hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* 背面 - 塔罗牌背面 */}
                  <div
                    className="absolute inset-0 bg-gray-900 border-2 border-gray-900 flex items-center justify-center"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    {/* 塔罗牌印记 */}
                    <div className="text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" className="opacity-30">
                        <path fill="currentColor" d="M12 2L2 7l10 5l10-5M2 17l10 5l10-5M2 12l10 5l10-5"/>
                      </svg>
                    </div>
                    
                    {/* 装饰性边框 */}
                    <div className="absolute inset-4 border border-gray-700 opacity-20" />
                    <div className="absolute inset-8 border border-gray-700 opacity-10" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 新建角色对话框 */}
        {showNewDialog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">收录新角色</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    角色名称 *
                  </label>
                  <input
                    type="text"
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                    placeholder="例如：张三、孙悟空"
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCharacterName.trim()) {
                        handleCreateCharacter();
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    角色类型 *
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setNewCharacterType('real')}
                      className={`flex-1 px-4 py-3 border-2 transition-colors flex items-center justify-center gap-2 ${
                        newCharacterType === 'real'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={newCharacterType === 'real' ? 'text-blue-600' : 'text-gray-600'}>
                          <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                        </g>
                      </svg>
                      <span className={newCharacterType === 'real' ? 'text-blue-700' : 'text-gray-700'}>真实人物</span>
                    </button>
                    <button
                      onClick={() => setNewCharacterType('virtual')}
                      className={`flex-1 px-4 py-3 border-2 transition-colors flex items-center justify-center gap-2 ${
                        newCharacterType === 'virtual'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="currentColor" className={newCharacterType === 'virtual' ? 'text-purple-600' : 'text-gray-600'} d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 18A1.5 1.5 0 0 0 6 19.5A1.5 1.5 0 0 0 7.5 21A1.5 1.5 0 0 0 9 19.5A1.5 1.5 0 0 0 7.5 18m9 0a1.5 1.5 0 0 0-1.5 1.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5a1.5 1.5 0 0 0-1.5-1.5"/>
                      </svg>
                      <span className={newCharacterType === 'virtual' ? 'text-purple-700' : 'text-gray-700'}>虚拟角色</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewDialog(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCharacter}
                  disabled={!newCharacterName.trim() || creating}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 编辑角色对话框 */}
        {editingCharacter && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setEditingCharacter(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-2 border-gray-900 p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">编辑角色信息</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    角色名称 *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 focus:border-gray-900 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    角色类型 *
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditType('real')}
                      className={`flex-1 px-4 py-3 border-2 transition-colors flex items-center justify-center gap-2 ${
                        editType === 'real'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={editType === 'real' ? 'text-blue-600' : 'text-gray-600'}>
                          <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                        </g>
                      </svg>
                      <span className={editType === 'real' ? 'text-blue-700' : 'text-gray-700'}>真实人物</span>
                    </button>
                    <button
                      onClick={() => setEditType('virtual')}
                      className={`flex-1 px-4 py-3 border-2 transition-colors flex items-center justify-center gap-2 ${
                        editType === 'virtual'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="currentColor" className={editType === 'virtual' ? 'text-purple-600' : 'text-gray-600'} d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 18A1.5 1.5 0 0 0 6 19.5A1.5 1.5 0 0 0 7.5 21A1.5 1.5 0 0 0 9 19.5A1.5 1.5 0 0 0 7.5 18m9 0a1.5 1.5 0 0 0-1.5 1.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5a1.5 1.5 0 0 0-1.5-1.5"/>
                      </svg>
                      <span className={editType === 'virtual' ? 'text-purple-700' : 'text-gray-700'}>虚拟角色</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingCharacter(null)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
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
    </div>
  );
}
