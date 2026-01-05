// AI 提供商图标组件
// 图标数据从数据库 ai_provider_templates.icon_svg 字段读取
// icon_svg 可以是：
// 1. 内嵌 SVG 字符串（以 <svg 开头）
// 2. 图片 URL（http:// 或 https://）
import React, { useEffect, useState } from 'react';
import { getProviderTemplates, AIProviderTemplate } from '../lib/ai-providers';

// 缓存模板数据
let templatesCache: AIProviderTemplate[] | null = null;
let templatesCachePromise: Promise<AIProviderTemplate[]> | null = null;

// 获取模板（带缓存）
const getTemplatesCached = async (): Promise<AIProviderTemplate[]> => {
  if (templatesCache) return templatesCache;
  if (templatesCachePromise) return templatesCachePromise;
  
  templatesCachePromise = getProviderTemplates().then(templates => {
    templatesCache = templates;
    return templates;
  });
  
  return templatesCachePromise;
};

// 默认图标（齿轮）
const DefaultIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    width={size}
    height={size}
    className={className}
  >
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);

// 图标组件
export const AIProviderIcon: React.FC<{
  providerKey: string;
  size?: number;
  className?: string;
}> = ({ providerKey, size = 24, className = '' }) => {
  const [iconSvg, setIconSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTemplatesCached().then(templates => {
      const template = templates.find(t => t.providerKey === providerKey);
      setIconSvg(template?.iconSvg || null);
      setLoading(false);
    });
  }, [providerKey]);

  if (loading) {
    return <div style={{ width: size, height: size }} className={className} />;
  }

  // 没有图标配置，显示默认图标
  if (!iconSvg) {
    return <DefaultIcon size={size} className={className} />;
  }

  // 内嵌 SVG
  if (iconSvg.trim().startsWith('<svg')) {
    // 处理 SVG：移除原有的 width/height，添加新的尺寸
    let processedSvg = iconSvg
      .replace(/width="[^"]*"/g, '')
      .replace(/height="[^"]*"/g, '')
      .replace('<svg', `<svg width="${size}" height="${size}" style="display:block"`);
    
    return (
      <div 
        className={className}
        style={{ 
          width: size, 
          height: size, 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0
        }}
        dangerouslySetInnerHTML={{ __html: processedSvg }}
      />
    );
  }

  // URL 图片
  return (
    <img 
      src={iconSvg}
      alt={providerKey}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
      onError={(e) => {
        // 加载失败时隐藏
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};

// 带背景色的图标组件
export const AIProviderIconWithBg: React.FC<{
  providerKey: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ providerKey, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 36,
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-xl bg-gray-100 flex items-center justify-center ${className}`}>
      <AIProviderIcon providerKey={providerKey} size={iconSizes[size]} />
    </div>
  );
};

// 纯图标组件（无背景）
export const AIProviderIconRaw: React.FC<{
  providerKey: string;
  size?: number;
  className?: string;
}> = ({ providerKey, size = 24, className = '' }) => {
  return <AIProviderIcon providerKey={providerKey} size={size} className={className} />;
};

// 获取图标 URL（兼容旧代码）
export const getProviderIconUrl = (providerKey: string): string => {
  // 这个函数现在只返回空字符串，实际图标由组件从数据库获取
  return '';
};

// 为了兼容旧代码
export const getProviderIcon = (providerKey: string): React.FC<{ size?: number; className?: string }> => {
  return ({ size = 24, className = '' }) => (
    <AIProviderIcon providerKey={providerKey} size={size} className={className} />
  );
};

export default {
  AIProviderIcon,
  AIProviderIconWithBg,
  AIProviderIconRaw,
  getProviderIcon,
  getProviderIconUrl,
};
