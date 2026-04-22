# CLAUDE_REVIEW.md — Migration Review & Action Plan

This file tracks open questions and the planned action plan for converting `weblatencytest` into a reusable Web Component with AudioWorklet-based recording. LLMs should read this file alongside CLAUDE.md before starting any work.

---

## Decisions Made

| # | Decision | Rationale |
|---|---|---|
| 1 | **Headless-first API** | Primary target is Hi-Audio, which has its own UI. A `start()` method + events interface slots cleanly into any host without conflict. Built-in UI is optional and deferred. |
| 2 | **Keep `worker.js` separate** | The cross-correlation algorithm is validated and correct. No benefit to merging it into the AudioWorklet thread; doing so would add complexity and risk audio glitches. |
| 3 | **v1 default `recording-mode`: `"mediarecorder"`** | MediaRecorder is already implemented and working. v1 ships with it as default. v2 switches the default to `"audioworklet"` once the AudioWorklet processor is stable. Both modes remain available as explicit attribute values in both versions. |
| 4 | **Priority order: minimal migration risk → accuracy → API simplicity** | Migration risk is minimised by keeping the algorithm untouched and refactoring the wrapper only. Accuracy is already handled by the existing cross-correlation logic and the 18 dB threshold — it is preserved, not re-designed. API simplicity is important but params and methods are not yet finalised; keep the surface small and avoid premature abstractions. |
| 5 | **Live demo: dedicated GitHub Pages page, not an embedded sandbox** | The component requires real `getUserMedia` access. Sandboxed iframes (CodeSandbox, StackBlitz) frequently block audio APIs and would give a broken first impression. A standalone `demo/index.html` served at `https://idsinge.github.io/rountriplatencytest-webcomponent/demo/` over HTTPS is the right approach. The docs site links to it prominently. This is a Phase 5 deliverable — it cannot exist before the component bundle does. |
| 6 | **npm and CDN are both first-class distribution targets** | Some consumers use bundlers (npm import); others drop in a `<script>` tag. Both paths must be validated before publishing. The component bundle must work in both contexts. |
| 7 | **Root README stays short and repo-oriented once the docs site is live** | The VitePress docs site becomes the canonical integration reference. The README covers repo purpose, origin, run-locally instructions, and research context — not component API details. |
| 8 | **AudioContext ownership: read-write property, component never closes it** | `element.audioContext` is a read-write JS property. Setter: host provides an existing context — component uses it and never closes it. Getter: always returns the active context, whether host-provided or internally created. If no context was set, the component creates one lazily on the first `start()` call and exposes it via the getter so the host can grab it for other audio work. The component never calls `.close()` on the AudioContext in either case — the host owns cleanup. This solves the edge case where the component is the first thing to touch audio: the host calls `start()`, then reads `element.audioContext` to get the context and continue building their audio graph. |
| 9 | **Shadow DOM (open mode), empty root by default** | A shadow root is attached in the constructor but nothing is rendered into it initially (headless). This is the standard custom element pattern, is future-proof if optional UI is added later, and ensures event retargeting works correctly. Open mode is used so host apps can inspect internals when debugging; no CSS custom properties are exposed in v1 since there is no visible UI. |
| 10 | **Lifecycle events: fire `latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-error`, `latency-complete`** | Host apps need state transitions to update their own UI (disable buttons, show spinners). Events are low-cost to emit and high-value for consumers. `latency-start` fires after permission is granted; `latency-recording` when MLS playback and capture begin; `latency-processing` when recording ends and the worker starts; `latency-result` with `{ latency, ratio, timestamp }`; `latency-error` with `{ message }`; `latency-complete` when all N tests finish (immediately after the single result in v1). |

---

## Open Questions

### 1. AudioWorklet Recording Strategy

The current `MediaRecorder` approach captures audio as a compressed Blob, then decodes it back to PCM — introducing codec latency and quality loss. Two alternatives exist for AudioWorklet:

**Option A — SharedArrayBuffer (ring buffer)**
- Worklet writes raw Float32 PCM directly into a `SharedArrayBuffer`; main thread reads it when recording ends.
- Zero-copy, sample-accurate.
- **Requires** cross-origin isolation headers on the server: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This may block embedding in DAWs that don't set these headers.

**Option B — MessagePort chunking**
- Worklet sends Float32Array chunks back via `postMessage` on each `process()` call.
- Works without COOP/COEP headers, but has some GC pressure from repeated transfers.
- Chunks can be transferred (not copied) using `Transferable` to mitigate this.

> **Question:** Which option fits better with Hi-Audio's hosting environment? Does Hi-Audio already set COOP/COEP headers?

---

### 2. AudioContext Ownership

**Resolved — see Decision #8.**

`element.audioContext` is a read-write property. The getter always returns the active context (host-provided or internally created). If no context was set before `start()`, the component creates one lazily and exposes it via the getter so the host can use it for other audio work afterward. The component never calls `.close()` — the host owns cleanup in both cases.

---

### 3. Component Public API

The headless-first decision shapes this directly. The primary interface is imperative + events; built-in UI is not part of the first version.

**Methods (imperative interface — primary)**

| Method | Description |
|---|---|
| `start()` | Begins a latency test run (or a sequence if `number-of-tests` > 1) |
| `stop()` | Aborts an in-progress test |

**Attributes / Properties**

| Name | Type | Default | Description |
|---|---|---|---|
| `number-of-tests` | number | `1` | Consecutive tests to run (was removed from current code; re-implemented as component attribute) |
| `mls-bits` | number | `15` | MLS order (sequence length = 2^n − 1). Only applies when `signal-type="mls"`. |
| `max-lag-ms` | number | `600` | Cross-correlation search window in ms |
| `recording-mode` | string | `"mediarecorder"` *(v1)* / `"audioworklet"` *(v2)* | Capture backend. v1 default: `"mediarecorder"` (implemented). v2 default: `"audioworklet"` (planned). Both values available in both versions. `ScriptProcessor` is not an attribute value but noted as an older-browser reference. |
| `signal-type` | string | `"mls"` | Test signal. `"mls"` = Maximum Length Sequence (default). `"chirp"` = logarithmic sine sweep. `"golay"` = Golay complementary sequence pair. |
| `input-gain` | number | `0` | Gain multiplier applied to the input stream before capture. `0` = no gain. Generalises the hardcoded Safari 50× workaround into a general user-configurable param. |

**Events dispatched by the component**

| Event | `detail` payload | Description |
|---|---|---|
| `latency-start` | `{}` | Permission granted and test is about to begin |
| `latency-recording` | `{}` | MLS playback started; capture is running |
| `latency-processing` | `{}` | Recording stopped; cross-correlation worker is running |
| `latency-result` | `{ latency, ratio, timestamp }` | Result of one test run |
| `latency-complete` | `{ results[], mean, std, min, max }` | All N runs finished (fires immediately after the single result in v1) |
| `latency-error` | `{ message }` | getUserMedia, AudioContext, or worker failure |

The demo `index.html` will own the button and result display, wiring them to `element.start()` and the `latency-result` event. This replaces what `displayStart()` and `displayresults()` currently do inside `test.js`.

Note: `recording-mode` makes the AudioWorklet migration non-breaking — both backends can coexist. `input-gain` promotes the Safari-only gain workaround into a general explicit API. For very old browser support, `ScriptProcessor` (deprecated, no longer part of the Web Audio spec) is documented as a reference pattern via [superpoweredSDK/WebBrowserAudioLatencyMeasurement](https://github.com/superpoweredSDK/WebBrowserAudioLatencyMeasurement) but is not a first-class `recording-mode` value in the component.

**Signal type notes:**
- `"chirp"`: logarithmic sine sweep; cross-correlation with matched filter (time-reversed chirp) gives the impulse response. Reference implementation: [naomiaro/recording-calibration](https://github.com/naomiaro/recording-calibration).
- `"golay"`: Golay complementary sequence pair (sequences A and B). The sum of their individual autocorrelations equals a perfect impulse, giving high SNR even in noisy environments. Requires two playback-and-record passes. More complex than MLS but superior in reverberant or noisy conditions.

**External references:**
- [naomiaro/recording-calibration](https://github.com/naomiaro/recording-calibration) — AudioWorklet + chirp sweep, cross-correlation, adaptive amplitude control
- [padenot/roundtrip-latency-tester](https://github.com/padenot/roundtrip-latency-tester) — AudioWorklet round-trip latency reference (same author as ringbuf.js)
- [superpoweredSDK/WebBrowserAudioLatencyMeasurement](https://github.com/superpoweredSDK/WebBrowserAudioLatencyMeasurement) — AudioWorklet + ScriptProcessor fallback pattern for older browsers
- [padenot/ringbuf.js](https://github.com/padenot/ringbuf.js) — Wait-free SPSC ring buffer for SharedArrayBuffer-based AudioWorklet → main thread PCM transfer (Option A implementation)
- [A wait-free SPSC ring buffer for the web](https://blog.paul.cx/post/a-wait-free-spsc-ringbuffer-for-the-web/) — Paul Adenot's blog post explaining the design rationale

> **Question:** Is `start()` / `stop()` + events sufficient for Hi-Audio's integration needs, or is additional control required (e.g. passing a pre-existing stream, or hooking into a specific point in the audio graph)?

---

### 4. Shadow DOM Mode

**Resolved — see Decision #9.**

Shadow DOM, open mode, with an empty shadow root attached in the constructor. No CSS custom properties are exposed in v1 — the component has no visible UI to style.

---

### 5. Safari Gain Workaround

**Resolved.**

The `input-gain` attribute is a general-purpose gain multiplier. The component applies a GainNode with the given value before capture, regardless of browser or recording backend. No browser detection lives inside the component.

The hardcoded `getCorrectStreamForSafari()` method in `test.js` is **removed during Phase 1**. Its responsibility moves to the host: if the host knows it is running on Safari ≥ 16 with `echoCancellation: false`, it sets `element.inputGain = 50` before calling `start()`. The demo page will include a code example showing this pattern.

Residual Safari AudioWorklet timing concerns (frame drops, scheduling jitter) are a Phase 4 testing item and are handled best-effort — they do not block Phase 1–3 work. Users on Safari can always fall back to `recording-mode="mediarecorder"` which is the v1 default anyway.

---

### 6. Worker Strategy (cross-correlation)

`worker.js` runs cross-correlation off the main thread. Two options for the migrated design:

**Option A — Keep worker.js as a separate Web Worker (recommended)**
- The AudioWorklet collects PCM; when done it sends the buffer to the main thread, which forwards it to the existing worker.
- Minimal refactor, proven and validated logic.

**Option B — Merge into the AudioWorklet processor**
- Run cross-correlation inside the AudioWorklet's dedicated thread after recording finishes.
- Avoids an extra postMessage hop, but AudioWorklet threads have real-time priority — running a heavy O(n × maxLag) loop there risks audio glitches in other connected nodes.

> **Recommendation:** Keep worker.js as-is (Option A). The bottleneck is the O(n × maxLag) correlation loop (~32767 × 26460 ops at 44100 Hz), which is already off the main thread and requires no changes regardless of recording method.

---

### 7. Bundler / Distribution Format

**Resolved — see Decision #6.**

Both npm import and CDN/script-tag are first-class targets. The concrete packaging strategy (single bundle vs unbundled ES modules, AudioWorklet processor inlining vs separate asset) is a Phase 5 deliverable. Key constraint: `AudioContext.audioWorklet.addModule()` requires a URL, so the processor file must be either inlined as a Blob URL or shipped as a separate asset alongside the bundle.

---

### 8. Histogram / Multi-test Visualization

**Resolved** by the headless-first decision.

`helper.js` (which contained all canvas drawing including the histogram) was deleted during simplification. The component will not re-implement histogram rendering. Instead:

- After `number-of-tests` runs complete, the component fires `latency-complete` with the full results array (`{ results[], mean, std, min, max }`).
- The host app (or demo page) renders the histogram however it chooses.

This is the correct approach for DAW embedding: Hi-Audio controls its own UI, and the component stays out of the way.

---

### 9. Lifecycle / State Events

**Resolved — see Decision #10.**

All six events are emitted from v1. See the updated events table in Q3 above.

---

### 10. Stream Ownership / Permission Model

**Resolved — same pattern as AudioContext (Decision #8), with one difference in cleanup.**

`element.inputStream` is a read-write JS property:

- **Host provides a stream** (`element.inputStream = existingStream` before `start()`): component uses it, never stops its tracks. Host owns the mic lifecycle.
- **No stream provided**: component calls `getUserMedia` lazily on the first `start()` call, then stops the tracks when the test ends (not on `disconnectedCallback` — leaving the mic open unnecessarily triggers the browser's recording indicator). The stream is exposed via the getter for completeness, though hosts rarely need it back.

`getUserMedia` is always called lazily on `start()`, never on `connectedCallback`. This is the correct model for embedded use where the host may not want a permission prompt on element insertion.

---

## Action Plan

Below is the proposed sequence of migration tasks. **No file should be modified until the open questions above are resolved and the user has explicitly approved each step.**

### Phase 0 — Decisions (prerequisite)
- [x] AudioContext ownership model — Q2 → Decision #8
- [x] Shadow DOM mode — Q4 → Decision #9
- [x] Lifecycle events scope — Q9 → Decision #10
- [x] Headless-first API confirmed — Decision #1
- [x] Keep worker.js separate — Decision #2
- [x] v1 recording-mode default — Decision #3
- [x] Priority order — Decision #4
- [x] Live demo strategy — Decision #5
- [x] npm + CDN both first-class — Decision #6
- [x] README scope — Decision #7
- ~~Histogram/visualization approach~~ — resolved: emit `latency-complete` event, host renders
- [x] Stream/permission model — Q10 resolved: same read-write property pattern as AudioContext; lazy getUserMedia on start(); component stops own tracks when done, never touches host-provided stream
- [x] Safari gain workaround — Q5 resolved: input-gain attribute is general-purpose; getCorrectStreamForSafari() removed in Phase 1; host decides gain value; Safari AudioWorklet timing is Phase 4 best-effort
- [ ] AudioWorklet recording strategy (SharedArrayBuffer + ringbuf.js vs MessagePort) — Q1 — still open, not a blocker for Phase 1–2
- ~~Distribution format (Q7)~~ — deferred to Phase 5

### Phase 1 — Refactor `TestLatencyMLS` to instance-based class
- [ ] Convert all `static` methods and properties to instance methods and fields
- [ ] Strip all DOM manipulation out of the class: remove `displayStart()`, `finishTest()`, and the `innerHTML` writes in `displayresults()` — these move to the demo page
- [ ] Replace DOM side-effects in `displayresults()` with a callback or event emission
- [ ] Remove `getCorrectStreamForSafari()` — browser detection and gain selection moves to the host/demo page; the component applies whatever `input-gain` value it receives via its property
- [ ] Keep `mls.js` and `worker.js` untouched

### Phase 2 — Create the Custom Element shell
- [ ] Create `src/scripts/latency-test-element.js` — the Custom Element class extending `HTMLElement`
- [ ] Attach shadow root (open mode) in constructor — leave it empty for now
- [ ] Expose `start()` and `stop()` as public methods
- [ ] Expose `audioContext` as a read-write JS property (Decision #8): setter accepts a host-provided context; getter always returns the active context (creating one lazily on first `start()` if needed); component never calls `.close()` on it
- [ ] Wire observed attributes (`number-of-tests`, `mls-bits`, `max-lag-ms`, `recording-mode`, `signal-type`, `input-gain`)
- [ ] Dispatch all six lifecycle + result events (Decision #10): `latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-complete`, `latency-error`
- [ ] Microphone permission (`getUserMedia`) is requested lazily on the first `start()` call — never on `connectedCallback`. This is the correct model for embedded use in host apps that may not want immediate permission prompts.
- [ ] Handle `connectedCallback` and `disconnectedCallback`: on disconnect, stop any in-progress test, terminate the worker, and disconnect audio nodes — do not close the AudioContext (host always owns cleanup per Decision #8)

### Phase 3 — AudioWorklet processor (replaces MediaRecorder)

> **Architecture note — WAC 2025 peer review + naomiaro/recording-calibration reference:**
>
> A peer reviewer identified a fundamental weakness in the current MediaRecorder approach: the duration between `mediaRecorder.start()` and `noiseSource.start()` is variable and unknown, introducing an uncontrolled timing offset into every measurement. The fix is to record both the output signal (MLS/chirp reference) and the mic input simultaneously as two inputs to the same AudioWorklet, then cross-correlate those two captures against each other. This makes the measurement timing-independent — the start moment is shared by both channels — and keeps all latency-critical computation in the audio domain, eliminating JavaScript scheduler jitter.
>
> This architecture is already validated in [naomiaro/recording-calibration](https://github.com/naomiaro/recording-calibration): the worklet is created with `numberOfInputs: 2` (input 0 = mic, input 1 = reference signal loopback), and each `process()` call posts `{ mic, ref }` chunks. Cross-correlation runs on the two captured buffers, not against the pre-known MLS sequence.
>
> For the chirp signal type, bandlimit to **1500–8000 Hz** (matching the naomiaro reference). This implicitly avoids the aliasing distortion above 12 kHz present on some iOS devices without needing platform detection.

- [ ] Create `src/scripts/recorder-processor.js` — `AudioWorkletProcessor` with `numberOfInputs: 2`
  - Input 0: mic stream (via `MediaStreamSourceNode` → GainNode → worklet)
  - Input 1: MLS/chirp reference signal loopback (same `AudioBufferSourceNode` connected to both `AudioContext.destination` and the worklet)
- [ ] Implement `process()` to buffer both input channels simultaneously and post `{ mic, ref }` chunks via MessagePort
- [ ] Implement chosen data-return strategy (MessagePort chunks or SharedArrayBuffer — Q1)
- [ ] Update `worker.js` to accept `{ mic, ref }` buffers and cross-correlate them against each other instead of correlating mic against the pre-known MLS sequence
- [ ] Wire the worklet into the latency test flow, replacing the `MediaRecorder` block in `prepareAudioToPlayAndrecord()`
- [ ] Verify that the `input-gain` GainNode is inserted correctly before the worklet's input 0 in the audio graph (replaces the removed `getCorrectStreamForSafari()` — host sets the value, component applies it)
- [ ] For `signal-type="chirp"`: bandlimit the signal to 1500–8000 Hz to avoid iOS aliasing above 12 kHz
- [ ] Validate that measurement results are stable across multiple runs (variability should now reflect true system audio buffer size, not JS scheduler jitter)

### Phase 4 — Demo page & integration
- [ ] Rewrite `src/index.html` as a minimal demo: a plain button that calls `element.start()` and a `<latency-test>` element
- [ ] Demo page listens for `latency-result` and `latency-error` and updates its own UI
- [ ] Demo page optionally listens for `latency-complete` and renders a histogram (host-side, not component-side)
- [ ] Verify `worker.js` works correctly with Float32 PCM coming from the AudioWorklet path
- [ ] Test `number-of-tests` > 1 loop driven by the component

### Phase 5 — Build & distribution
- [ ] Configure bundler output for a single component file (`build:component` script, separate from `npm run build`)
- [ ] Handle AudioWorklet processor file URL (Blob inlining or separate asset)
- [ ] Verify the bundle works as an npm import in a bundler-based project (CDN/script-tag and npm are both first-class targets — Decision #6)
- [ ] Verify the bundle works as a `<script type="module">` drop-in with no build step
- [ ] Test in Chrome, Firefox, Edge, and Safari
- [ ] **The component bundle is a prerequisite for the live demo page (Phase 6)**

### Phase 6 — Documentation & demo
- [ ] Update README.md to stay short and repo-oriented once the docs site is live (Decision #7)
- [ ] Remove component API details from README — those belong in the VitePress docs
- [ ] Document public API (attributes, properties, events, methods) in `docs/api.md` — mark planned items clearly
- [ ] Document CSS custom properties for theming if Shadow DOM is open
- [ ] Create `demo/index.html` — standalone showcase gallery (no framework, no build step) that pairs code snippets with live working component instances. Patterns to show: (1) minimal headless — `start()` + `latency-result` event; (2) AudioContext injection — host creates the context and passes it via `element.audioContext`; (3) input-gain usage — demonstrating Safari compensation; (4) all lifecycle events — showing `latency-start`, `latency-recording`, `latency-processing`, `latency-result`. Each pattern shows the code alongside a rendered, clickable `<latency-test>` element.
- [ ] Deploy `demo/` alongside the VitePress build in the GitHub Actions workflow (update `.github/workflows/docs.yml` to copy `demo/` into the Pages output)
- [ ] Link the live demo prominently from `docs/index.md` ("Try it live →" on the hero and install page)
- [ ] Add a `docs/demo.md` page that embeds the live demo via a same-origin iframe (the demo is hosted on the same GitHub Pages deployment, not a third-party sandbox) and explains what to expect
- [ ] **Pre-release gate:** before removing the `> **Draft.**` notice from any framework example page, verify a working end-to-end example in that framework against the actual installed published package — not against the local source. Draft labels stay until that verification is done.

### Phase 7 — npm publishing

> **Prerequisite:** Phases 1–5 must be complete. The component bundle must exist before publishing.

#### One-time setup (do once, not per release)

**1. Create the npm organisation**

The package name `@hi-audio/latency-test` requires an `hi-audio` org on npmjs.com.

- Go to https://www.npmjs.com and log in (or create an account).
- Create the organisation `hi-audio` at https://www.npmjs.com/org/create.
- Add any collaborators who should be able to publish.

**2. Update `package.json` for publishing**

Before the first publish, add the following fields to `package.json`:

```json
{
  "name": "@hi-audio/latency-test",
  "version": "1.0.0",
  "description": "...",
  "main": "dist/latency-test.cjs",
  "module": "dist/latency-test.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/latency-test.js",
      "require": "./dist/latency-test.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

Key points:
- `types` / `exports["types"]` points to the TypeScript declaration file — consumers get full IntelliSense with no manual setup.
- `files` controls what gets included in the published package — only the built output, README, and LICENSE. Everything else (`src/`, `docs/`, `assets/`, config files) is excluded automatically.
- `publishConfig.access: "public"` is **required** for scoped packages (`@scope/name`) — without it npm defaults to private and the publish will either fail or charge for a private package.
- `main` / `module` / `exports` point to the built component file, not the Parcel dev build. The bundler output for npm should be a separate build script (e.g. `npm run build:component`), distinct from the current `npm run build` which builds the demo app.

**3a. Create `src/index.d.ts` — TypeScript declaration file**

This file ships with the package and gives consumers typed access to the element, its properties, methods, and event payloads with no manual setup:

```ts
export interface LatencyResultDetail {
  latency: number
  ratio: number
  timestamp: number
}

export interface LatencyCompleteDetail {
  results: LatencyResultDetail[]
  mean: number
  std: number
  min: number
  max: number
}

export interface LatencyErrorDetail {
  message: string
}

interface LatencyTestEventMap extends HTMLElementEventMap {
  'latency-start':      CustomEvent<null>
  'latency-recording':  CustomEvent<null>
  'latency-processing': CustomEvent<null>
  'latency-result':     CustomEvent<LatencyResultDetail>
  'latency-complete':   CustomEvent<LatencyCompleteDetail>
  'latency-error':      CustomEvent<LatencyErrorDetail>
}

export interface LatencyTestElement extends HTMLElement {
  start(): Promise<void>
  stop(): void
  audioContext: AudioContext | null
  inputStream: MediaStream | null
  inputGain: number
  numberOfTests: number
  mlsBits: number
  maxLagMs: number
  recordingMode: 'mediarecorder' | 'audioworklet'
  signalType: 'mls' | 'chirp' | 'golay'
  addEventListener<K extends keyof LatencyTestEventMap>(
    type: K,
    listener: (this: LatencyTestElement, ev: LatencyTestEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener<K extends keyof LatencyTestEventMap>(
    type: K,
    listener: (this: LatencyTestElement, ev: LatencyTestEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void
}

declare global {
  interface HTMLElementTagNameMap {
    'latency-test': LatencyTestElement
  }
}
```

Key points on this declaration:
- `HTMLElementTagNameMap` augmentation makes `document.querySelector('latency-test')` return `LatencyTestElement` automatically. React 19+ also picks this up for JSX.
- `LatencyTestEventMap` + overloaded `addEventListener`/`removeEventListener` make event callback parameters fully typed — `e.detail.latency` is a `number`, not `any`.
- React < 19 still needs the manual JSX namespace declaration (documented in the React and Next.js example pages).
- **Build step:** `src/index.d.ts` is the hand-written source file (committed to version control). The `build:component` script must copy it to `dist/index.d.ts` so the `package.json` `types` field resolves correctly in the published package. A simple `cp src/index.d.ts dist/` at the end of the build script is sufficient.

**3. Add an `.npmignore`** (alternative to `files`)

If `files` is not used, add `.npmignore` to explicitly exclude development files:

```
src/
docs/
assets/
.github/
.parcel-cache/
*.config.*
CLAUDE*.md
CODEX_REVIEW.md
```

#### Manual publishing (per release)

```bash
# Log in to npm (only needed once per machine)
npm login

# Build the component bundle
npm run build:component

# Dry run — inspect what will be published without actually publishing
npm publish --dry-run

# Publish (scoped packages require --access public on first publish)
npm publish --access public
```

For subsequent releases, bump the version in `package.json` first:

```bash
npm version patch   # 1.0.0 → 1.0.1 (bug fix)
npm version minor   # 1.0.0 → 1.1.0 (new feature, backwards compatible)
npm version major   # 1.0.0 → 2.0.0 (breaking change — e.g. AudioWorklet default)
npm publish
```

#### Versioning plan

| Version | Default `recording-mode` | Notes |
|---|---|---|
| `1.x.x` | `"mediarecorder"` | Current implementation, stable |
| `2.0.0` | `"audioworklet"` | Breaking default change — bump major version |

#### Automated publishing via GitHub Actions (recommended)

Add a publish workflow that triggers on a GitHub release or version tag:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build:component
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then add `NPM_TOKEN` as a GitHub Actions secret:
- Go to npmjs.com → Account → Access Tokens → Generate New Token (choose **Automation** type).
- Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret → name it `NPM_TOKEN`.

Releases then follow this flow:
```bash
npm version minor          # bumps version, creates git tag
git push --follow-tags     # pushes tag → triggers the publish workflow
```

---

## Notes for LLMs

- Read `CLAUDE.md` first for full architectural context before touching any file.
- The cross-correlation algorithm in `worker.js` is correct and validated against published paper results — do not modify it without explicit instruction.
- The 18 dB reliability threshold and 600 ms maxLag are research-derived constants — do not change them without asking.
- The Safari-specific `getCorrectStreamForSafari()` method is **removed in Phase 1**. Gain compensation is now a general `input-gain` property set by the host — the component applies whatever value it receives and does no browser detection internally.
- `helper.js` no longer exists — do not reference it or attempt to import from it.
- **Docs homepage expectation management:** `docs/index.md` must always carry a visible draft/work-in-progress signal near the top (currently at line 30). The homepage shows install and usage code snippets that read like a published package — without an explicit notice, readers will assume the package already exists. Do not remove or soften this notice until the package is actually published on npm.
- **Phase 3 dual-channel capture is not optional:** A WAC 2025 peer reviewer identified that the current single-channel MediaRecorder approach has an uncontrolled timing offset between `mediaRecorder.start()` and `noiseSource.start()`. The AudioWorklet processor must use `numberOfInputs: 2` — mic on input 0, reference signal loopback on input 1 — and cross-correlate the two captures. The `naomiaro/recording-calibration` reference implements this correctly. Do not implement Phase 3 as a direct MediaRecorder-to-AudioWorklet port without adopting this two-channel architecture.
- Always ask the user before editing or modifying any existing file.
