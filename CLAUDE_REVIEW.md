# CLAUDE_REVIEW.md — Migration Review & Action Plan

This file tracks open questions and the planned action plan for converting `weblatencytest` into a reusable Web Component with AudioWorklet-based recording. LLMs should read this file alongside CLAUDE.md before starting any work.

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

Currently `index.js` creates the `AudioContext` and passes it into `TestLatencyMLS.initialize()`. For a web component two approaches are possible:

**Option A — Component owns the AudioContext**
- `<latency-test>` creates and manages its own `AudioContext` internally.
- Simple to use: just drop the element in the page.
- Problem: browsers allow only a limited number of `AudioContext` instances. If Hi-Audio already has one, a second context wastes resources and may behave differently.

**Option B — Consumer passes an AudioContext in**
- Host app passes its existing `AudioContext` via a property: `element.audioContext = existingAc`.
- Avoids the dual-context problem; the latency test runs in the same graph as the DAW.
- Slightly more integration work for the consumer.

> **Question:** Does Hi-Audio have an existing `AudioContext` that should be shared, or is an isolated context acceptable?

---

### 3. Component Public API

Proposed attribute and event interface — please confirm or correct:

**Attributes / Properties**

| Name | Type | Default | Description |
|---|---|---|---|
| `number-of-tests` | number | `1` | How many consecutive tests to run |
| `mls-bits` | number | `15` | MLS order (sequence length = 2^n − 1) |
| `debug-canvas` | boolean | `false` | Show waveform and cross-correlation canvases |
| `max-lag-ms` | number | `600` | Cross-correlation search window in ms |

**Events dispatched by the component**

| Event | `detail` payload | Description |
|---|---|---|
| `latency-result` | `{ latency, ratio, timestamp }` | Fired after each individual test |
| `latency-complete` | `{ results[], mean, std, min, max }` | Fired when all N tests finish |
| `latency-error` | `{ message }` | Fired on getUserMedia or AudioContext failure |

> **Question:** Is this API sufficient for Hi-Audio's use case, or do you need finer-grained control (e.g. a method to imperatively start/stop the test rather than a button inside the component)?

---

### 4. Shadow DOM Mode

**Open (recommended):** Host page CSS can reach inside the component via CSS custom properties (`--latency-btn-color`, etc.). Easier to style to match a DAW's theme.

**Closed:** Full encapsulation, no external style access.

> **Question:** Should the component expose CSS custom properties for theming, or is the visual output not important (the DAW will hide or restyle it)?

---

### 5. Safari AudioWorklet Compatibility

Safari has had a history of AudioWorklet bugs (late adoption, partial `process()` timing issues). The current Safari workaround (50× gain boost) was implemented for the `MediaRecorder` path.

- In an AudioWorklet context the gain node can still be inserted before the `AudioWorkletNode`, so the workaround is portable.
- However, Safari's AudioWorklet scheduling can occasionally drop frames; the ring buffer or chunk approach must handle missing frames gracefully.

> **Question:** Is Safari support a hard requirement for the web component, or is it best-effort?

---

### 6. Worker Strategy (cross-correlation)

`worker.js` currently runs cross-correlation on the main thread's message event loop using a `Web Worker`. Two options for the migrated design:

**Option A — Keep worker.js as a separate Web Worker (no change)**
- The AudioWorklet collects PCM; when done it sends the buffer to the main thread, which forwards it to the existing worker.
- Minimal refactor, proven logic.

**Option B — Merge into the AudioWorklet processor**
- Run cross-correlation inside the AudioWorklet's dedicated thread after recording finishes.
- Avoids an extra postMessage hop; keeps all DSP off the main thread.
- AudioWorklet thread has a real-time priority and no access to `postMessage` to the worker — would require a `MessageChannel` between the two worklet scopes, which is non-trivial.

> **Recommendation:** Keep worker.js as-is (Option A). The bottleneck is the O(n × maxLag) correlation loop (~32767 × 26460 ops at 44100 Hz), which is already off the main thread.

---

### 7. Bundler / Distribution Format

**Option A — Single bundled `.js` (Parcel / Rollup)**
- Consumer does: `<script type="module" src="latency-test.js">` then `<latency-test></latency-test>`.
- The AudioWorklet processor file must either be inlined (as a Blob URL) or shipped as a separate asset alongside the bundle, because `AudioContext.audioWorklet.addModule()` requires a URL.

**Option B — Unbundled ES modules**
- Consumer imports directly: `import './latency-test/index.js'`.
- Works well for projects that already use a bundler (Vite, Webpack, Parcel).

> **Question:** How will Hi-Audio (and other target projects) be consuming this component — via a `<script>` tag, npm import, or CDN?

---

### 8. Histogram Canvas

Currently `<canvas id="latencyHistogram">` lives in `index.html` outside the class. For the web component it needs a home:

**Option A — Inside the component's shadow root**
- The histogram is part of the component UI; always visible alongside the test button.

**Option B — Outside via a slot**
- Consumer provides a `<canvas slot="histogram">` element; the component draws into it.
- Gives the host app full layout control.

> **Question:** Should the histogram be part of the component UI, or should the host app render it separately using data from the `latency-complete` event?

---

## Action Plan

Below is the proposed sequence of migration tasks. **No file should be modified until the open questions above are resolved and the user has explicitly approved each step.**

### Phase 0 — Decisions (prerequisite)
- [ ] Answer all open questions above
- [ ] Agree on final component API (attributes, events, methods)
- [ ] Decide on AudioWorklet recording strategy (SharedArrayBuffer vs MessagePort)
- [ ] Decide on AudioContext ownership model
- [ ] Decide on distribution format

### Phase 1 — Refactor `TestLatencyMLS` to instance-based class
- [ ] Convert all `static` methods and properties to instance methods
- [ ] Move `COUNTER` and `LATENCYTESTRESULTS` onto the instance
- [ ] Remove all `document.getElementById` calls from the class (pass DOM references in, or use callbacks)
- [ ] Keep `mls.js`, `helper.js`, and `worker.js` untouched at this stage

### Phase 2 — Create the Custom Element shell
- [ ] Create `src/scripts/latency-test-element.js` — the Custom Element class
- [ ] Define shadow root with internal template (button, canvases, log area, histogram)
- [ ] Wire observed attributes (`number-of-tests`, `mls-bits`, `debug-canvas`, `max-lag-ms`)
- [ ] Dispatch `latency-result`, `latency-complete`, `latency-error` events

### Phase 3 — AudioWorklet processor (replaces MediaRecorder)
- [ ] Create `src/scripts/recorder-processor.js` — the `AudioWorkletProcessor` subclass
- [ ] Implement `process()` to buffer incoming Float32 frames
- [ ] Choose and implement the data-return strategy (MessagePort chunks or SharedArrayBuffer)
- [ ] Wire the worklet into the latency test flow replacing the `MediaRecorder` block in `prepareAudioToPlayAndrecord()`
- [ ] Re-evaluate and port the Safari gain workaround

### Phase 4 — Integration & cleanup
- [ ] Update `src/index.html` to use `<latency-test>` element
- [ ] Update `src/scripts/index.js` to minimal bootstrap (or remove if the element is self-contained)
- [ ] Verify the existing `worker.js` (cross-correlation) still works correctly with Float32 data coming from the AudioWorklet path
- [ ] Test `numberOfTests > 1` loop with the new architecture

### Phase 5 — Build & distribution
- [ ] Configure Parcel (or switch to Rollup/Vite) to output a single component bundle
- [ ] Handle the AudioWorklet processor file URL (Blob inlining or separate asset)
- [ ] Verify the bundle can be dropped into a plain HTML page with no build step
- [ ] Test in Chrome, Firefox, Edge, and Safari

### Phase 6 — Documentation
- [ ] Update README.md with web component usage examples
- [ ] Document CSS custom properties for theming
- [ ] Add a minimal demo page (`demo/index.html`) separate from the dev harness

---

## Notes for LLMs

- Read `CLAUDE.md` first for the full architectural context before touching any file.
- The cross-correlation algorithm in `worker.js` is correct and validated against paper results — do not modify it without explicit instruction.
- The 18 dB reliability threshold and 600 ms maxLag are research-derived constants — do not change them without asking.
- The Safari gain workaround (50×, `dest.channelCount = 1`) is intentional and browser-version-gated — do not remove it.
- Always ask the user before editing or modifying any existing file.
