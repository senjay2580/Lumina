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
  /**
   * 世代号：每次 start/jumpTo/stop 递增。所有 setInterval / utterance.onend /
   * utterance.onerror 在执行业务逻辑前必须比对世代号，不一致直接 bail。
   *
   * 解决高频跨段点击场景下旧 utterance 的延迟回调污染新段状态的根本问题：
   *   t=0   click  → jumpTo(5)  → speak(u5)
   *   t=50  click  → jumpTo(10) → speak(u10)（会触发 u5 的 onerror）
   *   t=51  u5.onerror 异步执行 → 若不比对世代，会对 idx 做 ++
   */
  private generation = 0;

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

    this.generation++;
    this.cancelled = true;
    window.speechSynthesis.cancel();
    this.clearProgressTimer();
    this.clearActiveClass();

    this.segments = segments;
    this.idx = Math.max(0, Math.min(fromIdx, segments.length - 1));
    this.cancelled = false;
    this.nextChangeReason = 'start';
    this.setState('playing');
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
    this.startProgressTimer(this.generation);
    this.setState('playing');
  }

  stop() {
    this.generation++;
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
    this.generation++;
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
    // 锁定本次调用的世代号，所有异步回调都用它判断是否过期
    const myGen = this.generation;
    const el = segs[this.idx];
    const text = (el.textContent || '').trim();

    this.clearActiveClass();
    el.classList.add('tts-active');
    const reason = this.nextChangeReason;
    this.nextChangeReason = 'natural';
    this.cb.onSegmentChange?.(this.idx, reason);
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

    if (this.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const found = voices.find(v => v.name === this.voiceName);
      if (found) u.voice = found;
    }

    u.onend = () => {
      // 世代过期 → 这是一个老 utterance 的延迟事件，丢弃
      if (myGen !== this.generation) return;
      if (this.cancelled) return;
      this.cb.onProgress?.(((this.idx + 1) / Math.max(1, this.segments.length)) * 100);
      this.idx++;
      this.speakCurrent();
    };
    u.onerror = (e) => {
      if (myGen !== this.generation) return;  // ← 关键：丢弃过期回调
      if (this.cancelled) return;
      // 'interrupted' / 'canceled' 是 cancel() 引发的正常事件，静默忽略
      const err = e.error || '';
      if (err === 'interrupted' || err === 'canceled') return;
      console.warn('[TTS] utterance error', err);
      this.cb.onError?.(err || 'speak failed');
      this.idx++;
      this.speakCurrent();
    };

    this.utterance = u;
    this.startProgressTimer(myGen);
    window.speechSynthesis.speak(u);
  }

  private startProgressTimer(myGen: number) {
    this.clearProgressTimer();
    const tick = () => {
      // 世代过期 / 已取消 / 不在 playing → 直接放弃，不再续 tick
      if (myGen !== this.generation || this.cancelled || this.state !== 'playing') {
        this.clearProgressTimer();
        return;
      }
      const total = Math.max(1, this.segments.length);
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

// 锁定一个稳定可用的中文音色：
// 浏览器 getVoices() 会返回大量「老 SAPI / 残废」音色（Huihui / Hanhan / Lily 等
// 全部停止维护，且经常无声）。我们只信微软 Edge Neural（Online Natural）这一档：
//   - 在 Windows 上由 Edge 浏览器内置（Chrome 也能用）
//   - 走 Azure Neural TTS 的网络合成，免费无限次
//   - 单独的 voice.name 形如 "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)"
//
// 解析时按下面的优先级链查找；只要任意一个命中就用它。
// 如果整条链都查不到（说明用户在非 Windows 平台或 Chrome 没下载 online voice），
// 我们 fallback 到任意带 'zh' lang 的第一条 voice，让用户「至少能出声」。

const PREFERRED_VOICE_CHAIN_ZH = [
  // 第一档：Edge Online Natural（神经语音，最自然）
  'Xiaoxiao Online',
  'Yunxi Online',
  'Yunjian Online',
  'Xiaoyi Online',
  // 第二档：旧版本命名（部分系统）
  'Xiaoxiao',
  'Yunxi',
  'Yunjian',
  'Xiaoyi',
];

const PREFERRED_VOICE_CHAIN_EN = [
  'Aria Online',
  'Guy Online',
  'Aria',
  'Guy',
];

export interface ResolvedVoice {
  name: string;
  /** 用户友好的展示名 */
  label: string;
  /** 是否是神经语音（Online Natural） */
  isNeural: boolean;
}

/** 按优先级链查中文 / 英文音色，返回 null 表示一个都没找到 */
export function pickStableVoice(
  voices: SpeechSynthesisVoice[],
  lang: 'zh' | 'en' = 'zh'
): ResolvedVoice | null {
  if (voices.length === 0) return null;
  const chain = lang === 'zh' ? PREFERRED_VOICE_CHAIN_ZH : PREFERRED_VOICE_CHAIN_EN;
  for (const kw of chain) {
    const found = voices.find(v => v.name.includes(kw));
    if (found) {
      return {
        name: found.name,
        label: kw.replace(' Online', ''),
        isNeural: kw.includes('Online'),
      };
    }
  }
  // 兜底：任意同语种 voice
  const langPrefix = lang === 'zh' ? 'zh' : 'en';
  const fallback = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (fallback) {
    return { name: fallback.name, label: fallback.name, isNeural: false };
  }
  return null;
}

