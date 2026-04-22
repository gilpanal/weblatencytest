# CODEX_REVIEW.md

## Purpose

This document captures the current repository assessment from Codex, plus the main migration actions and open questions for converting this proof-of-concept app into a reusable Web Component with AudioWorklet-based recording.

## Critical Rule For LLMs

Always ask the user for confirmation before editing or modifying any existing file.

This applies to all future LLM work in this repository. Reading, analysis, and proposing changes are allowed without approval. File creation or modification is not.

## Repository Summary

The project is a small Parcel-based vanilla JavaScript application for measuring round-trip audio latency in the browser using an MLS signal and cross-correlation.

Main modules:

- `src/scripts/index.js`
  Bootstraps the app, requests microphone access, creates the `AudioContext`, configures wake lock, reads `numberOfTests` from the URL, and initializes the latency test.

- `src/scripts/test.js`
  Core orchestration module. Handles MLS playback, recording, decoding, worker messaging, result rendering, and repeated test loops.

- `src/scripts/worker.js`
  Performs cross-correlation and peak/mean-energy analysis off the main thread.

- `src/scripts/mls.js`
  Generates the MLS sequence.

- `src/scripts/helper.js`
  Draws waveform, correlation, and histogram canvases.

- `src/index.html`
  Minimal shell with hardcoded IDs used directly by the JavaScript modules.

## Main Technical Comments

### 1. `test.js` is the main refactor target

The current architecture is centered around a disguised singleton:

- `TestLatencyMLS` is written as a class but uses static methods and static state throughout.
- `COUNTER` and `LATENCYTESTRESULTS` live at module scope.
- DOM access is global and hardcoded.

This works for a demo page, but it blocks multiple independent instances and does not fit a reusable custom element design.

### 2. The current recording path is not ideal for precise latency measurement

The current flow is:

`MediaRecorder` -> `Blob` -> `arrayBuffer()` -> `decodeAudioData()` -> `AudioBuffer`

That path is convenient, but not ideal for precision-sensitive measurement because it introduces a format/container round-trip and relies on browser encoder/decoder behavior. Migrating to `AudioWorklet` for raw PCM capture is the correct direction.

### 3. The Web Worker is still useful after the AudioWorklet migration

The simplest migration path is:

- use `AudioWorklet` only for sample-accurate capture
- send collected PCM frames back to the main thread
- continue using the existing worker for correlation and peak detection

This keeps threading concerns separated and reduces migration risk. Correlation can be moved later only if there is a clear performance reason.

### 4. The current UI and DOM assumptions are tightly coupled to one page

Important current assumptions:

- hardcoded element IDs
- direct writes to `document.getElementById(...)`
- canvases injected into the global document
- URL query param used as configuration

A web component should replace those with:

- shadow-root scoped DOM
- attributes and/or JS properties for configuration
- custom events for reporting results

### 5. Permission and initialization flow should be reconsidered

`index.js` requests microphone access immediately on page load. That is acceptable for a standalone demo but not always desirable for embeddable use in host apps.

For the web component version, a cleaner model is:

- render idle UI first
- request permission only on explicit user interaction
- optionally allow host apps to provide an existing `AudioContext` and/or input stream

### 6. Safari behavior is a known migration risk

The current Safari workaround amplifies input using a gain node before recording. Once recording moves into an `AudioWorklet`, this needs to be reevaluated carefully.

This is not just a code migration detail. It may affect measurement validity and cross-browser consistency.

## Architecture Notes For Migration

Recommended target shape:

- A custom element such as `<latency-test>`
- Internal UI rendered inside Shadow DOM
- Instance-based state instead of static globals
- Configurable attributes/properties
- Event-based integration with host apps

Suggested public API direction:

- attributes:
  - `number-of-tests`
  - `debug-canvas`
  - `mls-bits`
- methods:
  - `start()`
  - `stop()`
  - possibly `initialize()` if explicit setup is needed
- events:
  - `latency-result`
  - `latency-complete`
  - `latency-error`

## Proposed Migration Plan

### Phase 1. Separate core logic from page-specific wiring

Goal:
Make the code instance-based and remove direct dependency on global page structure.

Actions:

- Refactor `TestLatencyMLS` from static singleton style to an instance-based controller.
- Move `COUNTER` and `LATENCYTESTRESULTS` into instance state.
- Replace hardcoded global DOM lookups with injected element references or an internal render layer.
- Isolate wake-lock handling from measurement logic.

### Phase 2. Introduce a Web Component shell

Goal:
Wrap the current feature set into a reusable custom element before changing the recording engine.

Actions:

- Create a custom element class.
- Render button, status text, optional canvases, and histogram inside the shadow root.
- Map URL-based configuration to attributes/properties.
- Emit custom events instead of assuming a specific page-level output area.

### Phase 3. Replace `MediaRecorder` with `AudioWorklet`

Goal:
Capture raw PCM directly from the audio graph.

Actions:

- Add an `AudioWorkletProcessor` dedicated to recording/capturing input samples.
- Buffer PCM frames in a controlled format.
- Send recorded samples back to the main thread.
- Reconstruct a single `Float32Array` or channel buffers for analysis.
- Keep the existing worker correlation path initially.

### Phase 4. Revisit browser-specific behavior

Goal:
Preserve reliability after the recording architecture changes.

Actions:

- Reassess Safari gain compensation.
- Validate mono/stereo assumptions.
- Confirm that the new capture path keeps the same or better latency estimation quality across browsers.

### Phase 5. Stabilize the integration API

Goal:
Make the component practical for external Web Audio projects.

Actions:

- Decide whether host apps can pass their own `AudioContext`.
- Decide whether host apps can pass an external media stream.
- Define which results are emitted as events and which are exposed as properties/method return values.
- Clarify the minimum required styling hooks.

## Immediate Recommended Actions

1. Refactor `test.js` into an instance-based controller without changing the algorithm.
2. Introduce a custom element wrapper around that controller.
3. Keep the worker-based correlation logic intact during the first refactor.
4. Migrate recording from `MediaRecorder` to `AudioWorklet` only after the component boundary is stable.
5. Validate Safari behavior separately once the new capture path exists.

## Open Questions

1. Should the future component create its own `AudioContext`, or should host applications be able to inject an existing one?
2. Should the future component own `getUserMedia`, or should it optionally accept an already-created input stream?
3. Do you want Shadow DOM isolation by default, or do you prefer light DOM for easier styling and host integration?
4. Is your first priority measurement accuracy, API simplicity, or minimal migration risk?
5. Should the component include its own visible UI, or should it also support a headless/programmatic mode for host applications?
6. Should the current debug canvases and histogram remain part of the component API, or should they become optional/demo-only features?
7. Should repeated runs remain internally managed via a component attribute such as `number-of-tests`, or should host applications orchestrate repeated runs themselves?
8. Should the current worker-based correlation stage remain as a separate worker during the first AudioWorklet migration, or do you want correlation threading reconsidered immediately?
9. Should the component expose lifecycle/state events beyond the result events, for example `ready`, `recording-start`, `recording-stop`, or `processing`?
10. Should the component support both self-managed permissions and host-managed permissions, or do you want one strict integration model?

## Ongoing Review Notes

This file should be treated as the running Codex review log for this repository.

When new pertinent migration comments, risks, assumptions, or design questions come up in future sessions, they should be appended here so they are not lost between conversations.

## Additional Notes

- The repository contains `CLAUDE.md`, not `CLUADE.md`.
- Ignore `.parcel-cache`, `dist`, and `node_modules` during repository study, as requested.
- There is no test suite currently, so migration validation will need to rely on manual browser testing unless tests are added later.
