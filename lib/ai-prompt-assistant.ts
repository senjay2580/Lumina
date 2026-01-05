// AI 提示词助手 - 翻译、优化、总结
import { supabase } from './supabase';
import { getDefaultProvider, decryptApiKey, AIProvider } from './ai-providers';

// ============================================
// 类型定义
// ============================================
export interface OptimizeResult {
  original: string;
  optimized: string;
  changes: string[];
  qualityBefore: number;
  qualityAfter: number;
}

export interface TranslateResult {
  original: string;
  translated: string;
  notes?: string;
}

export interface SummarizeResult {
  summary: string;
  purpose: string;
  keyPoints: string[];
  summarizedAt: string;
}

// 自定义提示词配置
export interface CustomPromptConfig {
  translate?: string | null;  // 自定义翻译提示词
  optimize?: string | null;   // 自定义优化提示词
}

// ============================================
// 默认系统提示词模板
// ============================================
export const DEFAULT_PROMPTS = {
  translate: `You are an expert prompt engineer specializing in cross-language prompt optimization.

Your task is to translate the given prompt from Chinese to English, but NOT as a literal translation. Instead, optimize it for LLM understanding:

Guidelines:
1. Use clear, direct language that LLMs respond well to
2. Apply common prompt engineering patterns:
   - "You are a [role]..." for role-playing
   - "Step by step..." for reasoning tasks
   - "Your task is to..." for clear instructions
3. Preserve the original intent and structure
4. Use precise technical terms where appropriate
5. Add implicit context that English prompts typically include
6. Format for readability (use markdown if helpful)

Output ONLY the translated prompt, no explanations.`,

  optimize: `You are a senior prompt engineer. Analyze and optimize the given prompt.

Respond in JSON format:
{
  "qualityBefore": <1-10 score>,
  "qualityAfter": <1-10 expected score after optimization>,
  "issues": ["issue1", "issue2", ...],
  "changes": ["change1", "change2", ...],
  "optimized": "<the optimized prompt>"
}

Optimization principles:
1. Clarity: Make instructions unambiguous
2. Structure: Use clear sections and formatting
3. Context: Add necessary background information
4. Constraints: Define boundaries and limitations
5. Examples: Add examples if helpful
6. Output format: Specify expected response format

Keep the same language as the original prompt.`,

  summarize: `You are a prompt analyst. Explain what the given prompt does.

Respond in JSON format:
{
  "summary": "<one sentence summary, max 50 characters>",
  "purpose": "<what this prompt is designed to achieve>",
  "keyPoints": ["point1", "point2", ...]
}

Use the same language as the prompt for your response.`,

  generateTags: `You are a prompt tagging expert. Analyze the given prompt and generate relevant tags.

Rules:
1. Generate 3-5 concise tags that describe the prompt's purpose, domain, and use case
2. Tags should be in the same language as the prompt (Chinese if prompt is Chinese)
3. Each tag should be 2-4 characters for Chinese, or 1-2 words for English
4. Focus on: topic, use case, target audience, technique used
5. Output ONLY comma-separated tags, nothing else

Example output for a coding prompt: 编程,代码审查,Python,最佳实践
Example output for a writing prompt: 写作,创意,故事,角色塑造`
};

// ============================================
// LocalStorage 配置管理
// ============================================
const CUSTOM_PROMPT_KEY = 'ai_custom_prompts';

export function getCustomPromptConfig(): CustomPromptConfig {
  try {
    const stored = localStorage.getItem(CUSTOM_PROMPT_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveCustomPromptConfig(config: CustomPromptConfig): void {
  try {
    localStorage.setItem(CUSTOM_PROMPT_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save custom prompt config:', e);
  }
}

export function getEffectivePrompt(type: 'translate' | 'optimize' | 'summarize'): string {
  const config = getCustomPromptConfig();
  if (type === 'translate' && config.translate) return config.translate;
  if (type === 'optimize' && config.optimize) return config.optimize;
  return DEFAULT_PROMPTS[type];
}

// ============================================
// AI API 调用（支持流式响应）
// ============================================
export async function* streamAIResponse(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string, void, unknown> {
  const apiKey = decryptApiKey(provider.apiKey);
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
  const model = provider.defaultModel || provider.models[0]?.id || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

export async function callAI(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let result = '';
  for await (const chunk of streamAIResponse(provider, systemPrompt, userPrompt)) {
    result += chunk;
  }
  return result;
}

// ============================================
// 核心功能函数
// ============================================

// 翻译提示词（流式）
export async function* translatePromptStream(
  userId: string,
  content: string
): AsyncGenerator<string, TranslateResult, unknown> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = getEffectivePrompt('translate');
  let translated = '';
  for await (const chunk of streamAIResponse(provider, systemPrompt, content)) {
    translated += chunk;
    yield chunk;
  }

  return { original: content, translated: translated.trim() };
}

// 翻译提示词（非流式，用于后台执行）
export async function translatePrompt(
  userId: string,
  content: string
): Promise<TranslateResult> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = getEffectivePrompt('translate');
  const translated = await callAI(provider, systemPrompt, content);
  return { original: content, translated: translated.trim() };
}

// 优化提示词（流式）
export async function* optimizePromptStream(
  userId: string,
  content: string
): AsyncGenerator<string, OptimizeResult | null, unknown> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = getEffectivePrompt('optimize');
  let result = '';
  for await (const chunk of streamAIResponse(provider, systemPrompt, content)) {
    result += chunk;
    yield chunk;
  }

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        original: content,
        optimized: parsed.optimized || '',
        changes: parsed.changes || [],
        qualityBefore: parsed.qualityBefore || 0,
        qualityAfter: parsed.qualityAfter || 0,
      };
    }
  } catch {
    console.error('Failed to parse optimize result');
  }
  return null;
}

// 优化提示词（非流式，用于后台执行）
export async function optimizePrompt(
  userId: string,
  content: string
): Promise<OptimizeResult> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = getEffectivePrompt('optimize');
  const result = await callAI(provider, systemPrompt, content);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        original: content,
        optimized: parsed.optimized || result,
        changes: parsed.changes || [],
        qualityBefore: parsed.qualityBefore || 0,
        qualityAfter: parsed.qualityAfter || 0,
      };
    }
  } catch {
    // 如果解析失败，直接返回结果
  }
  
  return {
    original: content,
    optimized: result,
    changes: [],
    qualityBefore: 0,
    qualityAfter: 0,
  };
}

// 总结提示词
export async function summarizePrompt(
  userId: string,
  content: string
): Promise<SummarizeResult> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = getEffectivePrompt('summarize');
  const result = await callAI(provider, systemPrompt, content);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        purpose: parsed.purpose || '',
        keyPoints: parsed.keyPoints || [],
        summarizedAt: new Date().toISOString(),
      };
    }
  } catch {
    console.error('Failed to parse summary result');
  }

  return {
    summary: result.trim(),
    purpose: '',
    keyPoints: [],
    summarizedAt: new Date().toISOString(),
  };
}

// 生成标签
export async function generateTags(
  userId: string,
  content: string
): Promise<string[]> {
  const provider = await getDefaultProvider(userId);
  if (!provider) throw new Error('请先配置 AI 提供商');

  const systemPrompt = DEFAULT_PROMPTS.generateTags;
  const result = await callAI(provider, systemPrompt, content);
  
  // 解析逗号分隔的标签
  const tags = result
    .trim()
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0 && tag.length <= 20);
  
  return tags.slice(0, 5); // 最多返回5个标签
}

// ============================================
// 数据库操作
// ============================================

// 保存翻译结果
export async function saveTranslation(promptId: string, contentEn: string): Promise<boolean> {
  const { error } = await supabase.rpc('update_prompt_translation', {
    p_prompt_id: promptId,
    p_content_en: contentEn,
  });
  return !error;
}

// 获取提示词的翻译数据
export async function getPromptAIData(promptId: string): Promise<{
  contentEn: string | null;
  translatedAt: string | null;
}> {
  const { data, error } = await supabase
    .from('prompts')
    .select('content_en, content_translated_at')
    .eq('id', promptId)
    .single();

  if (error || !data) {
    return { contentEn: null, translatedAt: null };
  }

  return {
    contentEn: data.content_en,
    translatedAt: data.content_translated_at,
  };
}

// ============================================
// LocalStorage 操作 - 总结数据
// ============================================
const SUMMARY_STORAGE_KEY = 'prompt_summaries';

export function saveSummaryToLocal(promptId: string, summary: SummarizeResult): void {
  try {
    const stored = localStorage.getItem(SUMMARY_STORAGE_KEY);
    const summaries = stored ? JSON.parse(stored) : {};
    summaries[promptId] = summary;
    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaries));
  } catch (e) {
    console.error('Failed to save summary to localStorage:', e);
  }
}

export function getSummaryFromLocal(promptId: string): SummarizeResult | null {
  try {
    const stored = localStorage.getItem(SUMMARY_STORAGE_KEY);
    if (!stored) return null;
    const summaries = JSON.parse(stored);
    return summaries[promptId] || null;
  } catch (e) {
    console.error('Failed to get summary from localStorage:', e);
    return null;
  }
}
