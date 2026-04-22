# CLAUDE.md — weblatencytest

## CRITICAL RULE FOR LLMs

**Always ask the user for confirmation before editing or modifying any existing file.** You may freely read files and propose changes, but do not apply them without explicit approval. This is a research codebase with deliberate design choices that may not be obvious.

---

## Project Overview

**weblatencytest** is a proof-of-concept web application that measures browser round-trip audio latency using an MLS (Maximum Length Sequence) signal and cross-correlation. It is a research tool associated with a WAC 2025 paper (see README.md for citation).

**Future goal (in progress):** Convert this app into a reusable Web Component that can be embedded in other Web Audio projects. Recording will be migrated from `MediaRecorder` to `AudioWorklet`.

---

## Tech Stack

- Vanilla JavaScript (ES modules, no framework)
- Web Audio API (`AudioContext`, `AudioBuffer`, `BufferSource`)
- `MediaRecorder` API (current recording mechanism — to be replaced with AudioWorklet)
- Web Workers (off-main-thread cross-correlation computation)
- Parcel v2 (bundler, dev + build)
- No TypeScript, no test suite

**Dev commands:**
```
npm run dev    # parcel dev server at http://localhost:1234
npm run build  # production build
npm run deploy # gh-pages deploy
```

---

## File Map

Ignore `.parcel-cache/`, `dist/`, and `node_modules/` — they are build artifacts.

```
src/
  index.html              — App shell: button anchor, log div, wake-lock popup, histogram canvas
  style.css               — Minimal styles (only for wake-lock popup and buttons)
  scripts/
    index.js              — Entry point: getUserMedia, AudioContext creation, wakelock, calls TestLatencyMLS.initialize()
    test.js               — Core class TestLatencyMLS (all-static singleton pattern)
    mls.js                — MLS signal generation (LFSR algorithm, tap tables for bits 2–16)
    helper.js             — Canvas drawing utilities (waveform, cross-correlation, histogram)
    worker.js             — Web Worker: cross-correlation and peak detection (off main thread)
doc/
  latency_test_results.png
  histogram_latencies_edge.png
  ERC_logo.png
```

---

## Architecture & Data Flow

```
index.js
  └─ getUserMedia() → stream
  └─ new AudioContext()
  └─ TestLatencyMLS.initialize(ac, stream, btnId, debugCanvas, numberOfTests)
        └─ creates Web Worker (worker.js)
        └─ generateMLS(15) → 32767-sample binary sequence
        └─ generateAudio() → AudioBuffer (+1.0 / -1.0 samples)
        └─ getCorrectStreamForSafari() — applies 50x gain on Safari > 16
        └─ displayStart() — renders "TEST LATENCY" button

  [User clicks button]
  └─ prepareAudioToPlayAndrecord()
        └─ creates silence buffer (keeps AudioContext alive: cwilso trick)
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
        └─ stores result in LATENCYTESTRESULTS[]
        └─ testLoop() — repeats if numberOfTests > 1, else draws histogram
```

---

## Key Algorithmic Details

| Parameter | Value | Notes |
|---|---|---|
| MLS order (nbits) | 15 | Sequence length = 2^15 − 1 = 32767 samples |
| maxLag | 0.600 × sampleRate | 600 ms search window for the correlation peak |
| Reliability threshold | 18 dB | `10 × log10(peakPow / meanEnergy)` |
| Safari gain boost | 50× | Applied when Safari > v16 and echoCancellation is disabled |
| AudioContext latencyHint | 0 | Requests minimum latency |
| Mic constraints | echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 | Essential for accurate measurement |

---

## DOM Elements (hardcoded IDs — important for web component refactor)

| ID | Location | Purpose |
|---|---|---|
| `testlatencymlsbtn` | index.html | Anchor element replaced with "TEST LATENCY" button |
| `log-message` | index.html | Text output for errors and summary stats |
| `popup` | index.html | Wake-lock consent overlay |
| `wakeButton` | index.html | Button inside wake-lock popup |
| `latencyHistogram` | index.html | `<canvas>` for histogram after multiple tests |
| `leftChannelCanvas` | injected by test.js | Waveform of recorded signal (ch 0) |
| `rightChannelCanvas` | injected by test.js | Waveform of recorded signal (ch 1, hidden if mono) |
| `autocorrelationCanvas1` | injected by test.js | Cross-correlation plot (ch 0) |
| `autocorrelationCanvas2` | injected by test.js | Cross-correlation plot (ch 1, hidden if mono) |

The four canvas elements inside `#audio-area` are injected dynamically by `TestLatencyMLS.initialize()` when `debugCanvas = true`.

---

## Known Design Issues (relevant to web component conversion)

1. **All-static class** — `TestLatencyMLS` uses only static methods and properties, making it a disguised singleton. Multiple instances are not possible. Must be refactored to a proper instance-based class or Custom Element lifecycle.

2. **Module-level globals** — `COUNTER` and `LATENCYTESTRESULTS` are declared at module scope in `test.js`, not on the class. These need to move to instance state.

3. **Hardcoded DOM IDs** — The component reaches outside itself to manipulate fixed IDs. For a web component with Shadow DOM, all internal DOM must live inside the shadow root.

4. **MediaRecorder for recording** — Currently uses `MediaRecorder` on the raw `getUserMedia` stream. The plan is to replace this with an `AudioWorklet` for sample-accurate capture, which will also eliminate the `Blob → decodeAudioData` round-trip.

5. **Safari workaround** — The gain-boosting logic (`getCorrectStreamForSafari`) manipulates the stream before it reaches `MediaRecorder`. In an AudioWorklet architecture this will need to be re-evaluated.

6. **`numberOfTests` via URL param** — Currently read from `window.location.search` in `index.js`. In a web component this should become an HTML attribute.

---

## Web Component + AudioWorklet Migration Goals

- Wrap the latency test into a `<latency-test>` Custom Element
- All internal DOM inside a Shadow DOM
- Attributes: `number-of-tests`, `debug-canvas`, `mls-bits`
- Events dispatched: `latency-result`, `latency-complete`
- Replace `MediaRecorder` with an `AudioWorklet` processor for recording
- The AudioWorklet processor will collect raw Float32 PCM frames and transfer them back to the main thread via `SharedArrayBuffer` or `MessagePort`
- Keep `worker.js` (cross-correlation) as-is or merge into the AudioWorklet depending on threading constraints

---

## Browser Compatibility Notes

- Chrome/Chromium/Edge: Standard behavior, higher latency variability
- Firefox: Most stable results (std dev often 0), higher absolute latency on Windows
- Safari: Requires 50× gain boost when `echoCancellation: false` and version > 16; wired earpods force stereo input (only left channel used)
- All browsers: require HTTPS (or localhost) for `getUserMedia`

---

## Running Locally

```bash
npm install
npm run dev
# open http://localhost:1234
# append ?numberOfTests=5 to run 5 consecutive tests
```
