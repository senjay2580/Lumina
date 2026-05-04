// 文章朗读 TTS 引擎 —— 基于 Web Speech API
//
// 设计原则（针对之前几次失败的复盘）：
//   1. speak() 必须在用户手势同步栈内调用 —— 不要用 rAF/setTimeout 包裹，
//      Chrome 会因 user-gesture 上下文丢失而静默拒绝。
//   2. 高亮只用 className，不注入 DOM 节点 —— 避免和 React 的
//      dangerouslySetInnerHTML 互相干扰。
//   3. 进度推进用 setInterval（不用 rAF）—— rAF 在某些场景会被节流，
//      setInterval 30ms 间隔足够顺滑。
//   4. 不依赖 onstart / onboundary —— 中文 voice 经常不触发，
//      统一用「立即估算时长 + 启动 interval」兜底。

export type SegChangeReason = 'natural' | 'jump' | 'start';

export interface TtsCallbacks {
  /** reason='natural'=自然推进，'jump'=用户点击跳段，'start'=首次启动 */
  onSegmentChange?: (idx: number, reason: SegChangeReason) => void;
  /** 全篇绝对进度 0-100（已包含 idx + 段内进度，前端直接用即可） */
  onProgress?: (pct: number) => void;
  onStateChange?: (state: TtsState) => void;
  onError?: (msg: string) => void;
}

export type TtsState = 'idle' | 'playing' | 'paused';

const PROGRESS_TICK_MS = 30;
const CHARS_PER_SEC_ZH = 4.2;
const CHARS_PER_SEC_EN = 13;

export class TtsEngine {
  private segments: HTMLElement[] = [];
  private idx = 0;
  private cancelled = false;
  private utterance: SpeechSynthesisUtterance | null = null;
  private progressTimer: number | null = null;
  private segStartTs = 0;
  private segDurationMs = 0;
  private pausedElapsed = 0;
  private rate = 1;
  private voiceName: string | null = null;
  private state: TtsState = 'idle';
  private cb: TtsCallbacks;
  private nextChangeReason: SegChangeReason = 'natural';

  constructor(cb: TtsCallbacks = {}) {
    this.cb = cb;
  }

  setRate(rate: number) {
    this.rate = rate;
  }

  setVoiceName(voiceName: string | null) {
    this.voiceName = voiceName;
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** 启动朗读（必须在 click handler 同步栈内调用） */
  start(segments: HTMLElement[], fromIdx: number = 0) {
    if (!this.isAvailable()) return;
    if (segments.length === 0) return;

    // 先停掉现有的（同步），再重置状态
    this.cancelled = true;
    window.speechSynthesis.cancel();
    this.clearProgressTimer();
    this.clearActiveClass();

    this.segments = segments;
    this.idx = Math.max(0, Math.min(fromIdx, segments.length - 1));
    this.cancelled = false;
    this.nextChangeReason = 'start';
    this.setState('playing');
    // 同步启动第一段（保留 user gesture）
    this.speakCurrent();
  }

  pause() {
    if (this.state !== 'playing') return;
    window.speechSynthesis.pause();
    this.pausedElapsed = Date.now() - this.segStartTs;
    this.clearProgressTimer();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    window.speechSynthesis.resume();
    this.segStartTs = Date.now() - this.pausedElapsed;
    this.startProgressTimer();
    this.setState('playing');
  }

  stop() {
    this.cancelled = true;
    window.speechSynthesis.cancel();
    this.clearProgressTimer();
    this.clearActiveClass();
    this.utterance = null;
    this.idx = 0;
    this.pausedElapsed = 0;
    this.setState('idle');
  }

  /** 切到指定段（用户点击段落跳转） */
  jumpTo(idx: number, reason: SegChangeReason = 'jump') {
    if (this.state === 'idle') return;
    this.idx = Math.max(0, Math.min(idx, this.segments.length - 1));
    this.cancelled = true;
    window.speechSynthesis.cancel();
    this.cancelled = false;
    this.nextChangeReason = reason;
    this.speakCurrent();
  }

  destroy() {
    this.stop();
    this.segments = [];
  }

  // ---------- 内部 ----------

  private setState(s: TtsState) {
    this.state = s;
    this.cb.onStateChange?.(s);
  }

  private speakCurrent() {
    const segs = this.segments;
    if (this.idx >= segs.length) {
      this.stop();
      return;
    }
    const el = segs[this.idx];
    const text = (el.textContent || '').trim();

    this.clearActiveClass();
    el.classList.add('tts-active');
    const reason = this.nextChangeReason;
    this.nextChangeReason = 'natural';
    this.cb.onSegmentChange?.(this.idx, reason);
    // 段切换瞬间立刻把绝对进度归零到「该段起点」，避免视觉跳变
    this.cb.onProgress?.((this.idx / Math.max(1, segs.length)) * 100);

    if (!text) {
      this.idx++;
      this.speakCurrent();
      return;
    }

    const isChinese = /[一-龥]/.test(text);
    const charsPerSec = (isChinese ? CHARS_PER_SEC_ZH : CHARS_PER_SEC_EN) * this.rate;
    this.segDurationMs = Math.max(1500, (text.length / charsPerSec) * 1000);
    this.segStartTs = Date.now();
    this.pausedElapsed = 0;

    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    u.lang = isChinese ? 'zh-CN' : 'en-US';

    // 仅在 voiceName 显式指定且能查到时才设置 voice，否则交给浏览器默认（最稳）
    if (this.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const found = voices.find(v => v.name === this.voiceName);
      if (found) u.voice = found;
    }

    u.onend = () => {
      if (this.cancelled) return;
      this.cb.onProgress?.(100);
      this.idx++;
      this.speakCurrent();
    };
    u.onerror = (e) => {
      if (this.cancelled) return;
      console.warn('[TTS] utterance error', e);
      this.cb.onError?.(e.error || 'speak failed');
      // 跳到下一段，避免单段失败卡死
      this.idx++;
      this.speakCurrent();
    };

    this.utterance = u;
    this.startProgressTimer();
    // ⚡ 直接同步调用，不要包 rAF/setTimeout，否则会丢 user gesture
    window.speechSynthesis.speak(u);
  }

  private startProgressTimer() {
    this.clearProgressTimer();
    const total = Math.max(1, this.segments.length);
    const tick = () => {
      if (this.cancelled || this.state !== 'playing') return;
      const elapsed = Date.now() - this.segStartTs;
      const segPct = Math.min(0.99, elapsed / this.segDurationMs);
      const absPct = ((this.idx + segPct) / total) * 100;
      this.cb.onProgress?.(absPct);
      if (elapsed >= this.segDurationMs) {
        this.clearProgressTimer();
      }
    };
    this.progressTimer = window.setInterval(tick, PROGRESS_TICK_MS);
  }

  private clearProgressTimer() {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private clearActiveClass() {
    for (const el of this.segments) {
      el.classList.remove('tts-active');
    }
  }
}

// 收集文章正文中的可朗读段落
export function collectReadableSegments(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, blockquote, li')
  ).filter(el => (el.textContent || '').trim().length > 0);
}

// 精选音色（用 voice.name 精确匹配，匹配不到时返回 null 让浏览器用默认）
export interface CuratedVoice {
  key: string;
  label: string;
  desc: string;
  lang: 'zh' | 'en';
  /** 用于在 voices.name 里子串匹配 */
  match: string[];
}

export const CURATED_VOICES: CuratedVoice[] = [
  { key: 'auto',     label: '自动 · 浏览器默认', desc: '让浏览器选最合适的中文语音', lang: 'zh', match: [] },
  { key: 'xiaoxiao', label: '晓晓 · 女声温柔',   desc: '微软主推，自然亲切',         lang: 'zh', match: ['Xiaoxiao'] },
  { key: 'yunxi',    label: '云希 · 男声少年感', desc: '清亮少年',                   lang: 'zh', match: ['Yunxi'] },
  { key: 'yunjian',  label: '云健 · 男声浑厚',   desc: '醇厚低音',                   lang: 'zh', match: ['Yunjian'] },
  { key: 'xiaoyi',   label: '晓伊 · 女声甜美',   desc: '甜美轻盈',                   lang: 'zh', match: ['Xiaoyi'] },
  { key: 'yunyang',  label: '云扬 · 男声播音',   desc: '新闻播音腔',                 lang: 'zh', match: ['Yunyang'] },
  { key: 'yunxia',   label: '云夏 · 男童儿童感', desc: '童声活泼',                   lang: 'zh', match: ['Yunxia'] },
  { key: 'aria',     label: 'Aria · English',    desc: 'Natural female English',     lang: 'en', match: ['Aria'] },
  { key: 'guy',      label: 'Guy · English',     desc: 'Natural male English',       lang: 'en', match: ['Guy'] },
];

export const DEFAULT_VOICE_KEY = 'auto';

/** 把 curated key 解析成 voice.name；'auto' 或匹配不到则返回 null */
export function resolveVoiceName(
  key: string,
  voices: SpeechSynthesisVoice[]
): string | null {
  const def = CURATED_VOICES.find(c => c.key === key);
  if (!def || def.match.length === 0) return null;
  for (const kw of def.match) {
    const found = voices.find(v => v.name.includes(kw));
    if (found) return found.name;
  }
  return null;
}
