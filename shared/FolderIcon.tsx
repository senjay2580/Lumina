// 自定义文件夹图标 - macOS 风格

interface FolderIconProps {
  className?: string;
  size?: number;
}

export function FolderIcon({ className, size = 64 }: FolderIconProps) {
  const height = Math.round(size * 0.7);
  return (
    <svg 
      width={size} 
      height={height} 
      viewBox="0 0 120 84" 
      fill="none" 
      className={className}
      style={{ display: 'block' }}
    >
      {/* 后面的标签页 */}
      <path 
        d="M0 8C0 3.58172 3.58172 0 8 0H30L40 8H96C100.418 8 104 11.5817 104 16V68C104 72.4183 100.418 76 96 76H8C3.58172 76 0 72.4183 0 68V8Z" 
        fill="#D97706"
      />
      {/* 主文件夹体 */}
      <path 
        d="M0 16C0 11.5817 3.58172 8 8 8H96C100.418 8 104 11.5817 104 16V68C104 72.4183 100.418 76 96 76H8C3.58172 76 0 72.4183 0 68V16Z" 
        fill="url(#folderGradient)"
      />
      <defs>
        <linearGradient id="folderGradient" x1="52" y1="8" x2="52" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 打开状态的文件夹图标
export function FolderOpenIcon({ className, size = 64 }: FolderIconProps) {
  const height = Math.round(size * 0.7);
  return (
    <svg 
      width={size} 
      height={height} 
      viewBox="0 0 120 84" 
      fill="none" 
      className={className}
      style={{ display: 'block' }}
    >
      {/* 后面的标签页 */}
      <path 
        d="M0 8C0 3.58172 3.58172 0 8 0H30L40 8H96C100.418 8 104 11.5817 104 16V68C104 72.4183 100.418 76 96 76H8C3.58172 76 0 72.4183 0 68V8Z" 
        fill="#D97706"
      />
      {/* 打开的盖子 */}
      <path 
        d="M-4 28C-4 23.5817 -0.418278 20 4 20H100C104.418 20 108 23.5817 108 28V68C108 72.4183 104.418 76 100 76H4C-0.418278 76 -4 72.4183 -4 68V28Z" 
        fill="url(#folderOpenGradient)"
      />
      <defs>
        <linearGradient id="folderOpenGradient" x1="52" y1="20" x2="52" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default FolderIcon;
