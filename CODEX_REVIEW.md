# CODEX_REVIEW.md

## Purpose

This document captures the current repository assessment from Codex, plus the main migration actions and open questions for converting this proof-of-concept app into a reusable Web Component with AudioWorklet-based recording.

## Critical Rule For LLMs

Always ask the user for confirmation before editing or modifying any existing file.

This applies to all future LLM work in this repository. Reading, analysis, and proposing changes are allowed without approval. File creation or modification is not.

## Repository Summary

The repository now has three parallel concerns:

- a current Parcel-based proof-of-concept app for latency measurement
- a planned reusable web component package
- a companion VitePress documentation site for integration guidance across frameworks

Main modules:

- `src/scripts/index.js`
  Bootstraps the app, requests microphone access, creates the `AudioContext`, and initializes the latency test.

- `src/scripts/test.js`
  Core orchestration module. Handles MLS playback, recording, decoding, worker messaging, and inline result rendering.

- `src/scripts/worker.js`
  Performs cross-correlation and peak/mean-energy analysis off the main thread.

- `src/scripts/mls.js`
  Generates the MLS sequence.

- `src/index.html`
  Minimal shell with a single hardcoded anchor ID used directly by the JavaScript modules.

- `docs/`
  VitePress documentation site describing installation, API, and integration examples for the planned web component package.

- `package.json`
  Now reflects the intended npm package identity `@hi-audio/latency-test`, while still serving current demo-app development.

Repo simplification delta observed in the current state:

- `src/style.css` was removed.
- `src/scripts/helper.js` was removed.
- Wake-lock UI was removed.
- Log output container was removed.
- Debug canvases were removed.
- Histogram and repeated-test UI flow were removed.

Repo scope expansion observed in the current state:

- developer documentation site added under `docs/`
- GitHub Pages deployment pipeline added for docs
- npm package naming direction is now explicit in `package.json`
- repository intent is now partly product/documentation-facing, not only prototype-code-facing

## Main Technical Comments

### 1. `test.js` is the main refactor target

The current architecture is centered around a disguised singleton:

- `TestLatencyMLS` is written as a class but uses static methods and static state throughout.
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

- one hardcoded element ID
- direct writes to `document.getElementById(...)`
- results written directly into button `innerHTML`

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

### 7. The simplification was directionally correct

The repository is now materially closer to a component-friendly core:

- fewer page-specific UI concerns
- fewer files to untangle
- no canvas rendering dependency
- no multi-test state or histogram logic mixed into the measurement path

This is a good cleanup step. The remaining conversion problem is narrower now: isolate the measurement engine, replace the recording path, and wrap it in a component boundary.

### 8. `README.md` is now stale relative to the codebase

This comment is no longer true in the same way as before.

The current README is materially better aligned with the simplified app and the broader repo purpose. It now describes:

- the simplified demo flow more accurately
- the repository as the web-component development branch
- the current proof-of-concept nature of the code

Remaining documentation risk:

- the root README and the VitePress docs describe both current behavior and planned package behavior, so they must keep clearly separating implemented state from planned API.

### 9. VitePress is a good fit for this repository

The VitePress choice is sound for this project because the documentation needs are:

- API-heavy
- example-heavy
- framework-integration-heavy
- mostly markdown content
- easy GitHub Pages deployment

For this use case, VitePress is a better fit than a heavier documentation stack. The current config is appropriately simple and aligns with GitHub Pages hosting.

### 10. The repo narrative is more coherent now

The repository story is now substantially clearer:

- `package.json` names the future package
- `CLAUDE.md` describes docs and packaging direction
- `CLAUDE_REVIEW.md` describes migration and publishing decisions
- `docs/` provides the developer-facing integration site

This is a real improvement. The repo now reads like a project that is transitioning from research prototype to reusable developer-facing package.

### 11. The main current mismatch is implementation vs published docs

The main remaining mismatch is no longer the README. It is that the documentation site describes the planned component/package API more than the currently implemented code.

That is acceptable if handled explicitly, and the current docs already start doing that with `Draft` labels and planned-version language. That distinction should remain strict until the component actually exists.

## Architecture Notes For Migration

Recommended target shape:

- A custom element such as `<latency-test>`
- Internal UI optional; headless-first remains a strong direction
- Instance-based state instead of static globals
- Configurable attributes/properties
- Event-based integration with host apps

Suggested public API direction:

- attributes:
  - `mls-bits`
  - `max-lag-ms`
  - optionally `number-of-tests` if multi-run behavior returns
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
- Replace hardcoded global DOM lookups with injected element references or an internal render layer.
- Isolate measurement logic from inline button rendering.

### Phase 2. Introduce a Web Component shell

Goal:
Wrap the current feature set into a reusable custom element before changing the recording engine.

Actions:

- Create a custom element class.
- Render button and result status inside the shadow root.
- Map configuration to attributes/properties rather than URL params.
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

### Phase 6. Documentation and packaging alignment

Goal:
Keep the docs, package story, and implementation state aligned while the component is still being built.

Actions:

- Keep the VitePress docs explicit about what is implemented versus planned.
- Decide whether the docs site should document only the target package API or also current prototype status.
- Separate demo-app build concerns from future npm package build concerns.
- Promote the docs site as the main integration guide once GitHub Pages is live.

## Immediate Recommended Actions

1. Refactor `test.js` into an instance-based controller without changing the algorithm.
2. Introduce a custom element wrapper around that controller.
3. Keep the worker-based correlation logic intact during the first refactor.
4. Migrate recording from `MediaRecorder` to `AudioWorklet` only after the component boundary is stable.
5. Validate Safari behavior separately once the new capture path exists.
6. Keep the VitePress docs clearly labeled as draft/planned where they describe behavior not yet implemented.
7. Create a separate component build/publish pipeline instead of overloading the current demo-app Parcel build.
8. Use the docs site as the future authoritative integration guide, with the root README kept shorter and repo-oriented.

## Open Questions

1. Should the future component create its own `AudioContext`, or should host applications be able to inject an existing one?
2. Should the future component own `getUserMedia`, or should it optionally accept an already-created input stream?
3. Do you want Shadow DOM isolation by default, or do you prefer light DOM for easier styling and host integration?
4. Is your first priority measurement accuracy, API simplicity, or minimal migration risk?
5. Should the component include its own visible UI, or should it also support a headless/programmatic mode for host applications?
6. Should repeated runs return as a component feature later, or do you want to keep the product strictly single-run and let host applications orchestrate repetition?
7. Should the current worker-based correlation stage remain as a separate worker during the first AudioWorklet migration, or do you want correlation threading reconsidered immediately?
8. Should the component expose lifecycle/state events beyond the result events, for example `ready`, `recording-start`, `recording-stop`, or `processing`?
9. Should the component support both self-managed permissions and host-managed permissions, or do you want one strict integration model?
10. Do you want the component to preserve the current self-rendered button/result UI, or should the main target be a host-driven API with only optional built-in UI?
11. Should the docs site document only the target API, or should it also include an explicit implementation-status view showing what is already built versus planned?
12. Do you expect consumers to use the package mainly via npm import, or is CDN/script-tag usage also a first-class target?
13. Should the GitHub Pages site be documentation-only, or should it eventually host a live demo playground for the component as well?

## Resolved Decisions

The following points were clarified in discussion and should be treated as current working decisions unless changed later:

1. The VitePress docs are for the **target web component API**, not for the current intermediate implementation state.
2. The docs are intentionally a **draft reference** during the migration. They should describe the intended component/package, not the current proof-of-concept code behavior.
3. Consumers should be able to choose their preferred integration style. Both **npm import** and **CDN/script-tag** usage are first-class goals.
4. The GitHub Pages site should eventually include a **live showcase/demo** of the web component in action, not just static documentation.
5. The future live demo should show **multiple usage patterns**, with different code snippets and the corresponding working element rendered nearby (below, side by side, or similar).
6. `audioContext` ownership follows a **read-write property model**: the host may provide one, or the component creates one lazily on first `start()`. The component never closes the active `AudioContext`.
7. The component uses **open Shadow DOM with an empty shadow root by default**. No built-in visible UI is required in v1.
8. v1 should emit lifecycle + result events: `latency-start`, `latency-recording`, `latency-processing`, `latency-result`, `latency-error`, and `latency-complete`.
9. `inputStream` ownership mirrors the `audioContext` model: host-provided streams are never stopped by the component; self-created streams are acquired lazily on `start()` and stopped when the test ends.
10. Safari-specific automatic browser detection should be removed from the component. Gain compensation becomes a host-controlled/general `input-gain` behavior instead of an internal Safari-only workaround.

## Ongoing Review Notes

This file should be treated as the running Codex review log for this repository.

When new pertinent migration comments, risks, assumptions, or design questions come up in future sessions, they should be appended here so they are not lost between conversations.

## Current Delta Review

The repository is simpler than when this file was first created, and that changes the review in meaningful ways:

- the removal of `helper.js` lowered the UI refactor surface substantially
- the removal of wake-lock and log-message handling reduced page-specific responsibilities
- the removal of the multi-test loop means there is less state to untangle before introducing a component
- the remaining core problem is now concentrated in `test.js`, not spread across several UI helper layers

This makes the first migration step clearer:

- extract a pure measurement controller from `test.js`
- make result delivery event-based or callback-based
- wrap that controller in a custom element
- replace `MediaRecorder` afterward

Additional current delta:

- the repository is no longer only about code migration; it now includes public-facing developer documentation and package-distribution planning
- this increases the importance of maintaining alignment between implementation state, docs claims, and package metadata
- `CLAUDE_REVIEW.md` is now ahead of `CODEX_REVIEW.md` in several architecture decisions, so convergence work should now mostly flow from `CLAUDE_REVIEW.md` into this file until both can be merged cleanly

Practical consequence of the latest decisions:

- the docs site should not spend energy describing transient current-code behavior
- draft/planned labeling remains important, but the scope is now clearly target-oriented
- packaging and build planning should preserve both npm and CDN distribution paths
- the future docs site should reserve a place for an interactive component showcase
- the component contract is becoming concrete enough that future reviews should focus less on abstract options and more on consistency across docs, code, and packaging

## Comments On Updated Docs

### `CLAUDE.md`

Opinion:

- It is materially better than before and much closer to the actual repository state.
- The updated file map and deleted-file notes are useful and reduce the risk of an LLM reasoning from stale structure.
- The known-issues section now reflects the real simplification and is more actionable for the migration.

Remaining comment:

- It is now doing a good job of covering docs-site and npm-package direction too.
- The headless-first and versioned-backend framing is useful.
- The package-publishing notes are appropriate, but they should continue to be treated as planning until a real component build output exists.

### `CLAUDE_REVIEW.md`

Opinion:

- It is stronger than the previous version because it focuses on concrete architectural decisions rather than just restating the current code.
- The AudioWorklet strategy section is useful, especially the explicit `SharedArrayBuffer` versus `MessagePort` tradeoff.
- The recommendation to keep `worker.js` separate during the first migration is sound.
- The newer decisions section makes the file easier to use and improves the migration narrative.

Remaining comments:

- It is now a strong migration/design document rather than just a note file.
- The AudioWorklet strategy, packaging, and publishing sections are useful.
- It still needs careful discipline to distinguish target API from implemented API, but overall it is in good shape.
- Some open questions now overlap with already-resolved decisions. In particular, distribution/consumption direction has effectively been decided at the product level, so remaining questions should move from "which one?" to "how do we package for both cleanly?"
- It now resolves several topics that this file previously left open, including AudioContext ownership, Shadow DOM mode, lifecycle events, stream ownership, and Safari gain handling.
- The main remaining inconsistencies I noticed are:
  - some distribution wording still sounds open even though npm + CDN is already settled as product direction
  - the iframe-based demo embedding note should be understood as same-origin documentation presentation, not a third-party sandbox strategy
  - the LLM notes still mention the old Safari-specific workaround as if it remains canonical, while the main plan now replaces it with host-controlled `input-gain`

### VitePress docs

Opinion:

- VitePress is a good choice for this repository.
- The current site structure is appropriate: install, API, and framework examples are exactly the right top-level sections.
- The docs are valuable already, even before implementation is complete, because they help converge on API shape and integration expectations.

Remaining comments:

- Pages that describe planned APIs should continue to carry visible draft/planned status.
- Once GitHub Pages is live, the docs site should probably become the canonical integration reference, while the root README stays shorter and more repository-focused.
- A future showcase/demo page inside the docs site is worth planning early, because it will influence how the package is bundled and how the demo assets are served.
- `docs/index.md` reads well and the "Try it live" section is a good addition.
- The docs homepage still benefits from very explicit draft/target-state signaling, because the quick-start examples can otherwise read like the package already exists today.

## Latest Feedback Notes

Recent review feedback that should not be lost:

- `CLAUDE_REVIEW.md` is materially better now because the decisions section reduces ambiguity and improves continuity across sessions.
- The remaining cleanup need in `CLAUDE_REVIEW.md` is consistency: resolved decisions should stop reappearing as if they are still unresolved.
- `docs/index.md` is coherent and well structured, but the homepage should manage expectations clearly because it presents install/use snippets for a package that is still planned.
- The docs site should keep a strict distinction between target-state reference documentation and current implementation status.
- Support for both npm and CDN is already a settled product direction; future planning should focus on the concrete build/distribution strategy needed to satisfy both.
- `CLAUDE_REVIEW.md` is now the stronger candidate for the eventual unified `ACTION_PLAN_REFERENCE`, with this file serving as the supplementary review log until convergence is complete.
- The newer TypeScript/package-documentation direction was initially incomplete, but the major correctness gaps identified in review have now been addressed in `CLAUDE_REVIEW.md`.

## Latest Open Questions

These questions remain useful to answer later:

1. Should the docs homepage carry an explicit draft banner near the hero, or is draft/planned labeling only on deeper pages sufficient?

## Latest Feedback Notes

Additional clarification from discussion:

- The live demo should not be a single minimal example only.
- It should function as a small showcase gallery of integration patterns, pairing code snippets with visible working component instances.

## TypeScript Review Notes

The earlier TypeScript review findings have now been substantially addressed:

1. The declaration-file packaging mismatch is now resolved in the plan.
   - `src/index.d.ts` is the authored file
   - the build plan now explicitly copies it to `dist/index.d.ts`
   - this aligns the package metadata with the published artifact path

2. Typed custom events are now part of the planned declaration file.
   - `LatencyTestEventMap` is defined
   - `addEventListener` / `removeEventListener` overloads are included
   - this makes the TypeScript story for `e.detail` materially more credible

3. The Next.js example was corrected to match the explanation and the declaration strategy.
   - no dead `dynamic` import
   - no `@ts-ignore`
   - no `as any`
   - typed refs and exported detail types are used directly

4. React 19+ wording is now more careful.
   - the docs now frame the experience as something to verify end-to-end once the package is actually published and installed

5. A pre-release verification gate is now part of the action plan.
   - each framework example must be verified against the real installed package before draft labels are removed
   - this is the right safeguard against documentation drifting ahead of reality

Remaining note:

- It is still worth reusing the exported detail types consistently across all framework examples, not only React and Next.js, but this is now a minor polish point rather than a correctness blocker

## TypeScript Follow-up Suggestions

- Reuse the exported detail types consistently across all framework examples where practical.
- Keep the per-framework installed-package verification checklist as a release gate before removing draft/wip notices.
- When `CODEX_REVIEW.md` is eventually retired, these resolved TypeScript notes no longer need to be preserved separately because `CLAUDE_REVIEW.md` now covers them adequately.

## Additional Notes

- The repository contains `CLAUDE.md`, not `CLUADE.md`.
- Ignore `.parcel-cache`, `dist`, and `node_modules` during repository study, as requested.
- There is no test suite currently, so migration validation will need to rely on manual browser testing unless tests are added later.
- `package.json` now reflects the intended published package name, but it is not yet a publish-ready package manifest.
- Supporting both npm and CDN consumers means the eventual distribution strategy should be validated against both a bundler-based app flow and a direct browser `<script type="module">` flow.
