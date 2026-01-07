// 拖拽创建文件夹预览组件 - 安卓风格
import { motion, AnimatePresence } from 'motion/react';
import { Folder, Plus, X, FolderInput } from 'lucide-react';
import { Resource } from '../lib/resources';
import { ResourceFolder } from '../lib/resource-folders';

interface DragFolderPreviewProps {
  isVisible: boolean;
  position: { x: number; y: number };
  sourceResource?: Resource;
  targetResource?: Resource;
  sourceFolder?: ResourceFolder;
  targetFolder?: ResourceFolder;
  canDrop?: boolean;
  dropError?: string;
  isCopyMode?: boolean; // 新增：是否为复制模式
}

export function DragFolderPreview({
  isVisible,
  position,
  sourceResource,
  targetResource,
  sourceFolder,
  targetFolder,
  canDrop = true,
  dropError,
  isCopyMode = false
}: DragFolderPreviewProps) {
  // 资源拖拽到文件夹 - 不显示预览UI（用户要求移除）
  if (isVisible && sourceResource && targetFolder) {
    return null;
  }

  // 文件夹拖拽到文件夹的预览
  if (isVisible && sourceFolder && targetFolder) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          style={{
            position: 'fixed',
            left: position.x - 50,
            top: position.y - 50,
            pointerEvents: 'none',
            zIndex: 9999
          }}
          className="w-[100px] h-[100px]"
        >
          <div className="relative w-full h-full">
            {/* 背景圆圈 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`absolute inset-0 rounded-3xl ${canDrop ? 'bg-amber-100' : 'bg-red-100'}`}
            />
            
            {/* 文件夹移入图标 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
                <FolderInput className={`w-12 h-12 ${canDrop ? 'text-amber-500' : 'text-red-400'}`} />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                    canDrop ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                >
                  {canDrop ? (
                    <Plus className="w-3 h-3 text-white" />
                  ) : (
                    <X className="w-3 h-3 text-white" />
                  )}
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* 提示文字 */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className={`text-xs font-medium px-2 py-1 rounded-full shadow-sm ${
              canDrop 
                ? 'text-amber-600 bg-white/90' 
                : 'text-red-600 bg-red-50/90'
            }`}>
              {canDrop ? '松开移入文件夹' : (dropError || '无法移入')}
            </span>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 资源拖拽到资源的预览（创建文件夹）
  if (!isVisible || !sourceResource || !targetResource) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          style={{
            position: 'fixed',
            left: position.x - 60,
            top: position.y - 60,
            pointerEvents: 'none',
            zIndex: 9999
          }}
          className="w-[120px] h-[120px]"
        >
          {/* 文件夹创建预览 - 安卓风格 */}
          <div className="relative w-full h-full">
            {/* 背景圆圈 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`absolute inset-0 rounded-3xl ${canDrop ? 'bg-indigo-100' : 'bg-red-100'}`}
            />
            
            {/* 文件夹图标 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
                <Folder className={`w-16 h-16 ${canDrop ? 'text-indigo-500' : 'text-red-400'}`} />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${
                    canDrop ? 'bg-indigo-500' : 'bg-red-500'
                  }`}
                >
                  {canDrop ? (
                    <Plus className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* 两个资源的缩略图 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
            >
              <div className="w-8 h-8 rounded-lg bg-white shadow-md border border-gray-200 flex items-center justify-center text-xs overflow-hidden">
                {getResourceIcon(sourceResource)}
              </div>
              <div className="w-8 h-8 rounded-lg bg-white shadow-md border border-gray-200 flex items-center justify-center text-xs overflow-hidden">
                {getResourceIcon(targetResource)}
              </div>
            </motion.div>
          </div>

          {/* 提示文字 */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className={`text-xs font-medium px-2 py-1 rounded-full shadow-sm ${
              canDrop 
                ? 'text-indigo-600 bg-white/90' 
                : 'text-red-600 bg-red-50/90'
            }`}>
              {canDrop ? '松开创建文件夹' : '类型不同，无法合并'}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 获取资源图标
function getResourceIcon(resource: Resource) {
  if (resource.type === 'image' && resource.storage_path) {
    return (
      <img
        src={resource.storage_path}
        alt=""
        className="w-full h-full object-cover"
      />
    );
  }
  
  switch (resource.type) {
    case 'github':
      return '📦';
    case 'document':
      return '📄';
    case 'article':
      return '📰';
    case 'image':
      return '🖼️';
    default:
      return '🔗';
  }
}

export default DragFolderPreview;
