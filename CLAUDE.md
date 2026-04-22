# CLAUDE.md — weblatencytest

## CRITICAL RULE FOR LLMs

**Always ask the user for confirmation before editing or modifying any existing file.** You may freely read files and propose changes, but do not apply them without explicit approval. This is a research codebase with deliberate design choices that may not be obvious.

---

## Project Overview

**weblatencytest** is a proof-of-concept web application that measures browser round-trip audio latency using an MLS (Maximum Length Sequence) signal and cross-correlation. It is a research tool associated with a WAC 2025 paper (see README.md for citation).

**Future goal (in progress):** Convert this app into a reusable Web Component that can be embedded in other Web Audio projects. v1 ships with `MediaRecorder` as the default recording backend. v2 will switch the default to `AudioWorklet` for sample-accurate raw PCM capture.

---

## Tech Stack

- Vanilla JavaScript (ES modules, no framework)
- Web Audio API (`AudioContext`, `AudioBuffer`, `BufferSource`)
- `MediaRecorder` API (current recording mechanism, default in v1 — to be replaced by `AudioWorklet` default in v2)
- Web Workers (off-main-thread cross-correlation computation)
- Parcel v2 (bundler, dev + build)
- No TypeScript, no test suite

**Dev commands:**
```
npm run dev           # parcel dev server at http://localhost:1234
npm run build         # production build (demo app, not the npm package)
npm run deploy        # deploy demo app to gh-pages
npm run docs:dev      # VitePress docs dev server
npm run docs:build    # build VitePress docs
npm run docs:preview  # preview built docs locally
```

**npm package publishing:** The component will be published as `@hi-audio/latency-test`. Before the first publish, `package.json` needs `main`, `module`, `exports`, `files`, and `publishConfig.access: "public"` fields added, and a separate `build:component` script is needed distinct from `npm run build`. Full publishing checklist is in CLAUDE_REVIEW.md — Phase 7.

---

## File Map

Ignore `.parcel-cache/`, `dist/`, and `node_modules/` — they are build artifacts.

```
src/
  index.html              — Minimal app shell: single anchor button (#testlatencymlsbtn)
  scripts/
    index.js              — Entry point: getUserMedia, AudioContext creation, calls TestLatencyMLS.initialize()
    test.js               — Core class TestLatencyMLS (all-static singleton pattern)
    mls.js                — MLS signal generation (LFSR algorithm, tap tables for bits 2–16)
    worker.js             — Web Worker: cross-correlation and peak detection (off main thread)
assets/
  ERC_logo.png
docs/
  .vitepress/
    config.mjs            — VitePress site config (nav, sidebar, base URL for GitHub Pages)
  public/
    hi-audio.svg          — Hi-Audio logo served as static asset by VitePress (used in site header)
  index.md                — VitePress home page (hero + features layout)
  api.md                  — Full API reference (attributes, methods, events, signal types)
  install.md              — Installation: npm, CDN, AudioContext sharing
  examples/
    vanilla-js.md
    react.md
    vue.md
    svelte.md
    angular.md
    nextjs.md
.github/
  workflows/
    docs.yml              — GitHub Actions: build VitePress and deploy to GitHub Pages
```

**Deleted files (no longer in repo):**
- `src/style.css` — removed
- `src/scripts/helper.js` — removed (contained all canvas drawing: waveform, cross-correlation, histogram)

---

## Architecture & Data Flow

```
index.js
  └─ getUserMedia() → stream (mono, no echo/noise/AGC processing)
  └─ new AudioContext({ latencyHint: 0 })
  └─ TestLatencyMLS.initialize(ac, stream, btnId)
        └─ creates Web Worker (worker.js)
        └─ generateMLS(15) → 32767-sample binary sequence
        └─ generateAudio() → AudioBuffer (+1.0 / -1.0 samples)
        └─ getCorrectStreamForSafari() — applies 50x gain on Safari > 16  ← removed in Phase 1 (replaced by input-gain attribute)
        └─ displayStart() — renders "TEST LATENCY" button in #testlatencymlsbtn

  [User clicks button]
  └─ prepareAudioToPlayAndrecord()
        └─ creates silence buffer (keeps AudioContext alive — cwilso trick)
        └─ creates noiseSource (MLS AudioBuffer)
        └─ creates MediaRecorder on inputStream
        └─ noiseSource.start() + mediaRecorder.start() simultaneously
        └─ noiseSource.onended → mediaRecorder.stop()

  [Recording stops]
  └─ displayAudioTagElem(chunks, mimeType)
        └─ Blob → decodeAudioData → AudioBuffer (signalrecorded)
        └─ worker.postMessage({ command: 'correlation', data1, data2, maxLag, channel: 0 })

  [Worker: calculateCrossCorrelation]
        └─ O(n × maxLag) time-domain cross-correlation
        └─ maxLag = 0.600 × sampleRate (600 ms window)
        └─ postMessage({ correlation, channel })

  [Worker: findPeakAndMean]
        └─ finds peak index (max squared value) and mean energy
        └─ postMessage({ peakValuePow, peakIndex, mean, channel })

  [Main thread: displayresults]
        └─ latency (ms) = peakIndex / sampleRate × 1000
        └─ ratio (dB)   = 10 × log10(peakValuePow / mean)
        └─ threshold: ratio > 18 dB → reliable measurement
        └─ result rendered inline into the button's innerHTML (badge spans)
        └─ channel 1 path exists in code but only logs to console (no canvas)
```

---

## Key Algorithmic Details

| Parameter | Value | Notes |
|---|---|---|
| MLS order (nbits) | 15 | Sequence length = 2^15 − 1 = 32767 samples |
| maxLag | 0.600 × sampleRate | 600 ms search window for the correlation peak |
| Reliability threshold | 18 dB | `10 × log10(peakPow / meanEnergy)` |
| Safari gain boost | 50× | Was applied automatically when Safari > v16 and echoCancellation is disabled — now host-controlled via `input-gain` attribute; `getCorrectStreamForSafari()` removed in Phase 1 |
| AudioContext latencyHint | 0 | Requests minimum latency |
| Mic constraints | echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 | Essential for accurate measurement |

---

## DOM Elements

Only one hardcoded ID remains in the current codebase:

| ID | Location | Purpose |
|---|---|---|
| `testlatencymlsbtn` | index.html | Anchor element that `displayStart()` replaces with a button |

Results (latency ms and ratio dB) are written directly into the button's `innerHTML` as `<span>` badges. There is no separate log element, no popup, and no canvas in the current HTML.

---

## Known Design Issues (relevant to web component conversion)

1. **All-static class** — `TestLatencyMLS` uses only static methods and properties, making it a disguised singleton. Multiple instances are not possible. Must be refactored to instance-based before wrapping in a Custom Element.

2. **Hardcoded DOM ID** — `displayStart()` calls `document.getElementById(TestLatencyMLS.btnId)` to reach outside the class. For Shadow DOM, all internal DOM must live inside the shadow root.

3. **MediaRecorder for recording** — Captures audio as a compressed Blob, then decodes it back to PCM via `decodeAudioData`. Introduces codec round-trip and quality loss. The plan is to replace this with an `AudioWorklet` for sample-accurate raw PCM capture.

4. **Safari workaround** — `getCorrectStreamForSafari()` inserts a 50× gain node and forces `channelCount = 1` on the stream before it reaches `MediaRecorder`. **Removed in Phase 1.** Gain compensation is replaced by the general `input-gain` attribute — the host sets the value, the component applies it with no browser detection internally.

5. **Single test only** — The multi-test loop, result accumulation (`LATENCYTESTRESULTS`), statistics, and histogram were removed during simplification. These may be re-implemented as web component features (via attributes and events) rather than in-page logic.

6. **No visual debugging** — `helper.js` (waveform and cross-correlation canvas drawing) was removed. If debug visualization is needed in the web component it must be re-implemented inside the shadow root.

---

## Web Component + AudioWorklet Migration Goals

- Wrap the latency test into a `<latency-test>` Custom Element
- Shadow DOM attached in the constructor with an empty shadow root — no built-in UI in v1 (headless-first)
- Headless-first: primary API is `start()` / `stop()` methods + custom events; no built-in UI in v1
- Events dispatched: `latency-result`, `latency-error` (and optionally `latency-complete` for multi-test runs)
- `worker.js` correlation logic is preserved but updated in Phase 3: it will receive `{ mic, ref }` Float32 buffers (two-channel capture) and cross-correlate them against each other, not correlate mic against the pre-known MLS sequence
- The AudioWorklet processor uses `numberOfInputs: 2` — input 0 = mic, input 1 = reference signal loopback — and returns `{ mic, ref }` PCM chunks to the main thread via MessagePort or SharedArrayBuffer (see CLAUDE_REVIEW.md Phase 3 for architecture rationale)

**Planned configurable attributes (beyond `number-of-tests`, `mls-bits`, `max-lag-ms`):**

| Attribute | Values | Description |
|---|---|---|
| `recording-mode` | `"mediarecorder"` \| `"audioworklet"` | Selects the capture backend. **v1 default: `"mediarecorder"`** (already implemented). **v2 default: `"audioworklet"`** (sample-accurate raw PCM, to be implemented). `ScriptProcessor` is deprecated but documented as an older-browser reference (see CLAUDE_REVIEW.md). |
| `signal-type` | `"mls"` \| `"chirp"` \| `"golay"` | Selects the test signal. `"mls"` is default. `"chirp"` is a logarithmic sine sweep. `"golay"` uses Golay complementary sequence pairs for high-SNR impulse response measurement. |
| `input-gain` | number \| `0` | Applies a gain multiplier to the input stream before capture. `0` (default) means no gain. Replaces the hardcoded Safari-only 50× workaround with a general user-configurable parameter. |

**External references used during design:**
- [naomiaro/recording-calibration](https://github.com/naomiaro/recording-calibration) — AudioWorklet two-channel capture (mic + reference loopback), logarithmic chirp, cross-correlation — primary Phase 3 reference
- [padenot/roundtrip-latency-tester](https://github.com/padenot/roundtrip-latency-tester) — AudioWorklet round-trip latency reference (same author as ringbuf.js)
- [padenot/ringbuf.js](https://github.com/padenot/ringbuf.js) — wait-free SPSC ring buffer for SharedArrayBuffer-based AudioWorklet → main thread PCM transfer
- [superpoweredSDK/WebBrowserAudioLatencyMeasurement](https://github.com/superpoweredSDK/WebBrowserAudioLatencyMeasurement) — AudioWorklet + ScriptProcessor fallback pattern

---

## Browser Compatibility Notes

- Chrome/Chromium/Edge: Standard behavior, higher latency variability
- Firefox: Most stable results (std dev often 0), higher absolute latency on Windows
- Safari: The 50× gain boost is now host-controlled — set `input-gain="50"` if microphone levels are too low (common on Safari > v16 with `echoCancellation: false`). Wired earpods force stereo input (only left channel used).
- iOS: Some devices exhibit aliasing above 12 kHz on audio input, degrading MLS quality. The chirp signal is bandlimited to 1500–8000 Hz to avoid this. Use `signal-type="chirp"` or `"golay"` if MLS gives unreliable results on iOS.
- All browsers: require HTTPS (or localhost) for `getUserMedia`

---

## Running Locally

```bash
npm install
npm run dev
# open http://localhost:1234
```
