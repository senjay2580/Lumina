// 高频跨段点击测试 — 验证 generation token 能阻止旧 utterance 的 onerror/onend
// 污染新段状态。
//
// 运行方式：
//   npx tsx lib/tts.test.ts
//   （或：node --import tsx/esm lib/tts.test.ts）
//
// 设计：用 fake DOM + fake speechSynthesis 模拟高频点击 100 次，每次切到一个
// 随机段，最后一次点击后等所有过期 onerror 回调清空，断言最终 idx ===
// 最后一次点击的 idx，且 segments[最后 idx] 是唯一 .tts-active。

import { TtsEngine } from './tts.js';

// === Fake DOM ===
class FakeClassList {
  private set = new Set<string>();
  add(c: string) { this.set.add(c); }
  remove(c: string) { this.set.delete(c); }
  contains(c: string) { return this.set.has(c); }
}
class FakeElement {
  classList = new FakeClassList();
  textContent = '';
  constructor(text: string) { this.textContent = text; }
}

// === Fake speechSynthesis ===
class FakeUtterance {
  text: string;
  rate = 1;
  lang = '';
  voice: any = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  onboundary: ((e: any) => void) | null = null;
  constructor(text: string) { this.text = text; }
}

const pendingErrorCallbacks: Array<() => void> = [];

const fakeSynth = {
  speaking: false,
  pending: false,
  paused: false,
  _current: null as FakeUtterance | null,
  speak(u: FakeUtterance) {
    // 如果已经在朗读，把现有的 utterance 通过 onerror('interrupted') 通知
    if (this._current) {
      const stale = this._current;
      pendingErrorCallbacks.push(() => stale.onerror?.({ error: 'interrupted' }));
    }
    this._current = u;
    this.speaking = true;
  },
  cancel() {
    if (this._current) {
      const stale = this._current;
      pendingErrorCallbacks.push(() => stale.onerror?.({ error: 'canceled' }));
      this._current = null;
    }
    this.speaking = false;
  },
  pause() { this.paused = true; },
  resume() { this.paused = false; },
  getVoices() { return []; },
  addEventListener() {},
  removeEventListener() {},
};

// 注入到 global
(globalThis as any).window = {
  speechSynthesis: fakeSynth,
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
};
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;

// === 测试 ===
function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    console.error(`✗ ${msg}\n  expected: ${expected}\n  actual:   ${actual}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

function flushStaleCallbacks() {
  // 模拟浏览器延迟 fire 的 onerror/onend
  while (pendingErrorCallbacks.length > 0) {
    const cb = pendingErrorCallbacks.shift()!;
    cb();
  }
}

function makeSegments(n: number): FakeElement[] {
  return Array.from({ length: n }, (_, i) => new FakeElement(`段落${i}: 这是一段中文测试文本，用来模拟朗读内容。`));
}

console.log('\n=== Test 1: 单次 jumpTo ===');
{
  let lastIdx = -1;
  const eng = new TtsEngine({
    onSegmentChange: (i) => { lastIdx = i; },
  });
  const segs = makeSegments(50) as any;
  eng.start(segs, 0);
  assertEq(lastIdx, 0, '启动后 idx=0');
  eng.jumpTo(25);
  flushStaleCallbacks();
  assertEq(lastIdx, 25, '单次 jumpTo(25) 后 idx=25');
  // active class 唯一
  const active = segs.filter((s: FakeElement) => s.classList.contains('tts-active'));
  assertEq(active.length, 1, '只有一个段落带 tts-active');
  assertEq(active[0], segs[25], '带 tts-active 的是 segs[25]');
  eng.stop();
}

console.log('\n=== Test 2: 高频跨段 100 次点击 ===');
{
  let lastIdx = -1;
  const eng = new TtsEngine({
    onSegmentChange: (i) => { lastIdx = i; },
  });
  const segs = makeSegments(200) as any;
  eng.start(segs, 0);
  // 模拟用户高频点击 100 次
  const targets: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t = Math.floor(Math.random() * 200);
    targets.push(t);
    eng.jumpTo(t);
  }
  // 最后一次点击的目标
  const finalTarget = targets[targets.length - 1];
  // flush 所有 pending 的 onerror（模拟浏览器延迟）
  flushStaleCallbacks();
  assertEq(lastIdx, finalTarget, `100 次跳段后 idx === 最后目标 ${finalTarget}`);
  const active = segs.filter((s: FakeElement) => s.classList.contains('tts-active'));
  assertEq(active.length, 1, '只有一个段落带 tts-active（无残留）');
  assertEq(active[0], segs[finalTarget], `tts-active 在 segs[${finalTarget}]`);
  eng.stop();
}

console.log('\n=== Test 3: 极端 — flush 期间继续点击 ===');
{
  let lastIdx = -1;
  const eng = new TtsEngine({
    onSegmentChange: (i) => { lastIdx = i; },
  });
  const segs = makeSegments(100) as any;
  eng.start(segs, 0);
  eng.jumpTo(10);
  eng.jumpTo(20);
  flushStaleCallbacks();  // 此时所有过期 onerror 触发
  eng.jumpTo(30);          // 再点一次
  flushStaleCallbacks();
  eng.jumpTo(40);
  flushStaleCallbacks();
  assertEq(lastIdx, 40, '交替点击 + flush 后 idx=40');
  eng.stop();
}

console.log('\n=== Test 4: stop 后旧回调不影响 ===');
{
  let lastIdx = -1;
  const eng = new TtsEngine({
    onSegmentChange: (i) => { lastIdx = i; },
  });
  const segs = makeSegments(50) as any;
  eng.start(segs, 0);
  eng.jumpTo(25);
  eng.stop();
  // stop 后过期 onerror 不应再调用 onSegmentChange
  const idxAtStop = lastIdx;
  flushStaleCallbacks();
  assertEq(lastIdx, idxAtStop, 'stop 后 flush 不会再改变 idx');
}

console.log('\n=== ALL TESTS PASSED ===\n');
