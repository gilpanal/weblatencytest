---
layout: home

hero:
  name: "@hi-audio/latency-test"
  text: "Round-trip audio latency measurement"
  tagline: "Web Component powered by Web Audio API. Headless API, multiple signal types, easy to embed in any Web Audio project."
  actions:
    - theme: brand
      text: Get Started
      link: /install
    - theme: alt
      text: API Reference
      link: /api
    - theme: alt
      text: GitHub
      link: https://github.com/idsinge/rountriplatencytest-webcomponent

features:
  - title: Multiple Signal Types
    details: MLS (Maximum Length Sequence), logarithmic chirp sweep, and Golay complementary sequence pairs — choose the signal that fits your measurement environment.
  - title: Dual Capture Backends
    details: MediaRecorder (v1 default, implemented) and AudioWorklet (v2 default, planned) — both available via the recording-mode attribute. Enables a non-breaking migration path.
  - title: Headless by Default
    details: Exposes start() / stop() methods and fires CustomEvents. No built-in UI — drop it into any host application or DAW without styling conflicts.
  - title: Framework Ready
    details: Works with Vanilla JS, React, Vue, Svelte, Angular, and Next.js. Zero dependencies at runtime.
---

> **Work in progress.** The `<latency-test>` web component is currently in development. The API and examples described here reflect the planned interface. See [CLAUDE_REVIEW.md](https://github.com/idsinge/rountriplatencytest-webcomponent/blob/main/CLAUDE_REVIEW.md) for migration status.

## Quick start

```bash
npm install @hi-audio/latency-test
```

```html
<latency-test id="lt"></latency-test>
<button onclick="document.getElementById('lt').start()">Test</button>

<script type="module">
  import '@hi-audio/latency-test'

  document.getElementById('lt').addEventListener('latency-result', (e) => {
    console.log(`${e.detail.latency} ms — ratio: ${e.detail.ratio.toFixed(2)} dB`)
  })
</script>
```

## Key concepts

- The component is **headless by default** — it exposes `start()` / `stop()` and fires events. No built-in button or result display.
- Results are delivered via the `latency-result` CustomEvent (`{ latency, ratio, timestamp }`).
- A reliability ratio above **18 dB** indicates a trustworthy measurement.
- Microphone access is requested on the first `start()` call.
- For DAW or multi-context applications, pass your existing `AudioContext` via `element.audioContext = ac` before calling `start()`.
- Use `recording-mode` to select the capture backend: `"mediarecorder"` (v1 default, implemented) or `"audioworklet"` (v2 default, planned).
- Use `signal-type` to select the measurement signal: `"mls"`, `"chirp"`, or `"golay"`.
- Use `input-gain` to apply a custom input gain (e.g. `50` to compensate for low Safari microphone levels).

## Try it live

> **Coming soon.** A live interactive demo will be available here once the component is published. It will let you test round-trip latency in your browser — with your own microphone and audio setup — before deciding whether to include the component in your project.

## Origin

This component is the web component development branch of [gilpanal/weblatencytest](https://github.com/gilpanal/weblatencytest), a proof-of-concept associated with the paper presented at [WAC 2025](https://wac-2025.ircam.fr/).
