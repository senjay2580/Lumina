import React from 'react';

interface Props {
  fileName: string;
  className?: string;
}

export const FileTypeIcon: React.FC<Props> = ({ fileName, className = 'w-4 h-4' }) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Markdown
  if (ext === 'md') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41M6 15.5v-4l1.5 2l1.5-2v4h1.5V8.5H9L7.5 11L6 8.5H4.5v7H6m7.5-4.5h3v-1.5h-3v-1.5h3V8.5h-4.5v7h4.5v-1.5h-3v-1.5m6 0h1.5v3H19.5v-3H18v-1.5h4.5V11H21v4.5h-1.5V11z"/>
      </svg>
    );
  }
  
  // JSON
  if (ext === 'json') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h2v2H5v5a2 2 0 0 1-2 2a2 2 0 0 1 2 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 0 0-2-2H0v-2h1a2 2 0 0 0 2-2V5a2 2 0 0 1 2-2m14 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2a2 2 0 0 1-2-2V5h-2V3h2m-7 12a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m-4 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1m8 0a1 1 0 0 1 1 1a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1z"/>
      </svg>
    );
  }
  
  // TXT
  if (ext === 'txt') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m4 18H6V4h7v5h5v11M9 13v2h6v-2H9m0 4v2h6v-2H9"/>
      </svg>
    );
  }
  
  // PDF
  if (ext === 'pdf') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="#e53935">
        <path d="M14 2l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8m4 18V9h-5V4H6v16h12m-9.5-8c.3 0 .5.2.5.5v5c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-5c0-.3.2-.5.5-.5m2.5 0c.8 0 1.5.7 1.5 1.5S11.8 15 11 15h-.5v2.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-5c0-.3.2-.5.5-.5h1m0 2c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-.5v1h.5m4 0h-1v1h1c.3 0 .5-.2.5-.5s-.2-.5-.5-.5m0-2c.8 0 1.5.7 1.5 1.5v2c0 .8-.7 1.5-1.5 1.5h-1.5c-.3 0-.5-.2-.5-.5v-4c0-.3.2-.5.5-.5H15z"/>
      </svg>
    );
  }
  
  // Word
  if (ext === 'doc' || ext === 'docx') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="#2196f3">
        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6m0 2h7v5h5v11H6V4m2 8v2h8v-2H8m0 4v2h5v-2H8"/>
      </svg>
    );
  }
  
  // 图片
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="#4caf50">
        <path d="M8.5 13.5l2.5 3l3.5-4.5l4.5 6H5l3.5-4.5M21 3H3C2 3 1 4 1 5v14c0 1 1 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2z"/>
      </svg>
    );
  }
  
  // 默认文档图标
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m4 18H6V4h7v5h5v11z"/>
    </svg>
  );
};
