import { useEffect, useRef } from 'react';
import * as workflowApi from './workflows';
import * as promptApi from './prompts';
import { getNodeTemplates } from './components';
import { getProviderTemplates } from './ai-providers';

// 预加载关键数据，在用户登录后立即执行
export function usePreloadData(userId: string | undefined) {
  const preloaded = useRef(false);

  useEffect(() => {
    if (!userId || preloaded.current) return;
    
    preloaded.current = true;
    
    // 并行预加载所有关键数据
    Promise.all([
      // 首页需要的数据
      workflowApi.getStats(userId),
      workflowApi.getWorkflows(userId),
      workflowApi.getWorkflowActivity(userId),
      // 提示词页面需要的数据
      promptApi.getCategories(userId),
      promptApi.getPrompts(userId),
      // 全局模板数据（不依赖用户）
      getNodeTemplates(),
      getProviderTemplates(),
    ]).catch(err => {
      console.error('预加载数据失败:', err);
    });
  }, [userId]);
}

// 预加载回收站数据（可选，在用户访问回收站前调用）
export function preloadTrashData(userId: string) {
  return Promise.all([
    workflowApi.getDeletedWorkflows(userId),
    promptApi.getDeletedPrompts(userId),
  ]);
}
