<claude-mem-context>
# Memory Context

# [Lumina] recent context, 2026-05-05 1:57pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,040t read) | 2,014,252t work | 99% savings

### May 4, 2026
410 4:22p 🟣 Email Preview UI — User-Selectable Options with Default Second
411 " 🔵 TypeScript Errors in ArticleDetailPage.tsx — Missing Article Properties
413 4:25p 🔄 TTS Highlight Mechanism Replaced — DOM Mutation Removed, CSS Custom Property Approach Adopted
414 " 🔄 speakSegment Fully Reimplemented — RAF + CSS Variable Progress Instead of Span-Based Highlight
415 4:34p 🔵 Lumina Project Structure Mapped for TTS Integration
416 4:35p 🔵 ArticleDetailPage.tsx TTS Implementation Fully Mapped (2223 lines)
417 4:36p 🔵 Edge Function Env Var Pattern in api/skills/prompts.ts
418 " 🟣 Volcengine Doubao TTS Edge Function Created at api/tts/synthesize.ts
419 4:37p 🟣 lib/tts-doubao.ts Created: Client TTS Library with Character-Level Highlight Controller
420 4:39p ✅ Git Commit and Push with Versa Auto-Deployment
434 4:45p 🔵 TTS Progress Highlight Bug Persists After Initial Fix Attempt
435 4:47p 🔴 Full Web Speech API TTS Refactor: Doubao Removed, rAF Progress Fixed
421 5:21p 🔵 Blockchain & Crypto Speed-Course Request for Chinese Mainland Programmer
422 5:22p 🔵 Dependency Check: ffmpeg Missing in D:\Desktop\Lumina Environment
423 5:28p 🟣 Blockchain/Crypto Educational Deep-Dive Request for Chinese Mainland Programmer
S298 Blockchain/crypto educational document for Chinese mainland programmer + Bilibili video transcription (BV12dnbzFEof) + video-transcribe SKILL.md bug fix (May 4, 5:28 PM)
424 5:30p 🔵 video-transcribe Skill: Full Architecture — Groq Whisper + DeepSeek Polish Pipeline
425 " 🔵 fluxfilter-video-ops Skill: Bilibili Subtitle Extraction + video-transcribe Integration
426 5:31p ✅ video-transcribe SKILL.md Overhauled: Anti-Preflight-Check Rules + Script Path Fix + Output Path Fix
427 " 🟣 video-transcribe Successfully Transcribed Bilibili Video BV12dnbzFEof End-to-End
430 " ✅ transcribe.py: Added `import time` — Prerequisite for Rate-Limit Retry Logic
S299 Prompt optimization using prompt-stack-optimizer: Chinese-language financial education prompt about "AI investing" for a zero-knowledge audience (May 4, 5:31 PM)
428 5:32p 🟣 Prompt Optimization Request: AI Investment & Financial System Explainer
S300 零基础入门区块链/币圈：生成2小时速成教育文档 + 转录孙宇晨发家史B站视频 + 套用"真价值vs噱头"5维框架分析波场/TRX + 对视频中所有金融/币圈术语做中文零基础解释 (May 4, 5:32 PM)
429 5:33p 🔵 prompt-stack-optimizer Skill: Lv3 Frameworks Reference Loaded
431 5:34p 🟣 transcribe.py Major Robustness Upgrade: find_yt_dlp(), probe_proxy(), 4-Attempt Download Fallback
432 " 🟣 transcribe.py: Groq API Network Retry + Status-Code-Aware Key Rotation + Automatic Proxy Fallback Wired In
S301 Comprehensive Chinese-language financial education article on AI investing — how capital flows into companies like Anthropic, from LP to VC to AI company to exit (May 4, 5:34 PM)
433 5:40p 🟣 Comprehensive AI Investment Education Article Commissioned
S302 Fix TTS bugs in ArticleDetailPage.tsx: some voices not triggering and highlight sync not displaying; also rename "同类文章" → "更多文章" (May 4, 5:41 PM)
441 7:35p 🔵 TTS overlay rewrite introduced regression: no audio and no highlight on deployed Vercel site
S303 TTS module rewrite — highlight not showing, audio not playing in ArticleDetailPage (May 4, 7:35 PM)
443 7:37p 🔴 TTS Module Full Rewrite — Highlight + Voice Trigger Fixes
S305 TTS module full refactor for Lumina project — fixed silent audio and broken highlighting by extracting TtsEngine class to lib/tts.ts (May 4, 7:38 PM)
445 7:44p 🔄 TTS Engine Extracted to Standalone lib/tts.ts Module
447 7:47p 🔄 CURATED_VOICES and DEFAULT_VOICE_KEY Deduplicated — Inline Definitions Removed from ArticleDetailPage
449 " 🔄 TTS Refs Collapsed to Single ttsEngineRef in ArticleDetailPage
452 " 🔴 TTS Highlight CSS Simplified — Overlay Approach Abandoned
453 " 🔄 ArticleDetailPage TTS Logic Fully Delegated to TtsEngine via getEngine Lazy Init Pattern
455 " 🔵 TTS Module Multiple Failures Reported — Refactor Requested
456 7:48p 🔄 TTS Logic Extracted to Standalone TtsEngine Class in lib/tts.ts
457 " 🔴 TTS Silent Audio Bug Fixed — Chrome Requires Synchronous speak() in User Gesture Stack
458 " 🔴 TTS Highlight Simplified to Pure className — Removed DOM-Injected Overlay
459 " 🟣 TTS Progress Bar Now Shows Composite Segment + Within-Segment Progress
S306 Lumina TTS module full refactor — fixed broken highlighting and silent audio by extracting TtsEngine class and enforcing 3 architectural rules (May 4, 7:49 PM)
S307 New TTS bugs reported after refactor — progress bar wildly jumping, page bouncing on paragraph click, beginning logical flow analysis to fix (May 4, 7:50 PM)
460 7:50p 🔵 New TTS Bugs After Refactor — Progress Bar Jumping and Page Jitter on Paragraph Click
461 7:54p 🔴 TTS Progress Bar Jumping Fixed — Absolute Progress Formula
462 " 🔴 TTS Progress Bar Stops Causing React Re-renders — Direct DOM Mutation
463 " 🔴 Auto-Scroll No Longer Hijacks Viewport After User Clicks Paragraph
464 7:57p 🔴 Fixed TTS Progress Bar Jitter and Page Layout Shake
465 7:59p 🟣 TTS High-Availability: Rapid Paragraph-Switching Stability
466 8:00p 🔴 TTS Generation Counter to Prevent Stale Callback Pollution
467 " 🔴 Generation Increment Wired into `start()` Method
468 8:01p 🔴 Generation Increment Added to `stop()` and `jumpTo()` Methods
469 " 🔴 Generation Guard Applied Inside `speakCurrent()` Async Callbacks
470 " 🔴 Progress Timer Tick Guards Against Stale Generation
471 " 🔄 Voice Selection Replaced with Priority-Chain `pickStableVoice()`
472 8:02p ✅ ArticleDetailPage Import Updated to New Voice API
S311 Lumina TTS 高可用性重构 — 高频跨段点击稳定性 + 自动音色锁定 (May 4, 8:03 PM)
**Investigated**: Web Speech API 在高频 jumpTo() 调用下的竞态条件：cancel() 触发 onerror 异步回调，旧 utterance 的 onend/onerror 在新段已启动后仍会执行并污染 idx 状态。识别出三类问题：(1) 过期回调修改 idx，(2) 'interrupted'/'canceled' onerror 被误当真实错误处理，(3) 旧版静态音色下拉框存在不稳定性。

**Learned**: - Generation counter 是解决 Web Speech API 竞态的标准模式：所有状态转换方法递增计数器，所有异步回调在入口处比对计数器，不匹配则 bail
    - cancel() 会触发当前 utterance 的 onerror，error 值为 'interrupted' 或 'canceled'，必须与真实错误区分，静默处理
    - Edge Online Natural 神经语音（如 Microsoft Xiaoxiao Online Natural）质量远优于本地 SAPI 语音，应优先选择
    - setInterval 进度计时器也需要 generation 参数，否则旧定时器继续运行会干扰新段进度显示
    - resume() 调用 startProgressTimer() 时必须传入 this.generation，否则 TypeScript TS2554 报错

**Completed**: - lib/tts.ts：实现 generation counter 模式（private generation = 0），start/stop/jumpTo 均递增；speakCurrent() 捕获 myGen，所有异步回调检查；startProgressTimer(myGen) 自终止；pickStableVoice() 自动选最佳音色；resume() 修复 TS2554 错误
    - lib/tts.test.ts：新建测试文件，4 个确定性测试覆盖高频点击竞态，fake DOM + fake speechSynthesis，全部通过
    - components/creations/ArticleDetailPage.tsx：移除 ttsVoices/ttsVoiceKey/CURATED_VOICES/resolveVoiceName；改用 ttsResolvedVoice + pickStableVoice；语音选择从下拉框改为只读音色信息条（显示神经语音状态点）；相关 CSS 类全部更新
    - TypeScript 0 错误（npx tsc --noEmit clean）
    - Git commit b20c42c 推送到 GitHub main 分支，Vercel 自动部署触发

**Next Steps**: 无待处理任务。所有成功指标已达成。如有后续工作，可能是验证 Vercel 部署构建结果，或处理用户新提出的功能需求。


Access 2014k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>