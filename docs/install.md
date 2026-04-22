# Installation & Setup — `@hi-audio/latency-test`

> **Draft.** The package is not yet published to npm. This document describes the intended installation workflow once it is. See [CLAUDE_REVIEW.md](../CLAUDE_REVIEW.md) for migration status.

---

## Requirements

- Node.js v14 or above (for local development and bundler-based projects)
- A browser with Web Audio API, AudioWorklet, and `getUserMedia` support
- HTTPS or `localhost` (required for microphone access)

---

## npm

```bash
npm install @hi-audio/latency-test
```

Then import in your entry point:

```js
import '@hi-audio/latency-test'
```

This registers the `<latency-test>` custom element globally. After the import, use the element anywhere in your HTML or component templates.

---

## CDN (no build step)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@hi-audio/latency-test/dist/latency-test.js"></script>
```

Place this in the `<head>` of your HTML file. The element is registered automatically when the script loads.

---

## Basic usage

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@hi-audio/latency-test/dist/latency-test.js"></script>
</head>
<body>
  <latency-test></latency-test>

  <script>
    const el = document.querySelector('latency-test')

    el.addEventListener('latency-result', (e) => {
      console.log(`Latency: ${e.detail.latency} ms — Ratio: ${e.detail.ratio.toFixed(2)} dB`)
    })

    el.addEventListener('latency-error', (e) => {
      console.error('Test failed:', e.detail.message)
    })

    // Start the test programmatically, or wire to your own button:
    document.querySelector('#myButton').addEventListener('click', () => el.start())
  </script>
</body>
</html>
```

---

## Sharing an existing AudioContext

If your application already has an `AudioContext` (e.g. a DAW or audio workstation), pass it to the element before calling `start()` to avoid creating a second context:

```js
import '@hi-audio/latency-test'

const el = document.querySelector('latency-test')
el.audioContext = myExistingAudioContext

el.addEventListener('latency-result', (e) => {
  console.log(e.detail.latency, 'ms')
})

el.start()
```

---

## Running the demo locally

```bash
git clone https://github.com/idsinge/rountriplatencytest-webcomponent.git
cd rountriplatencytest-webcomponent
npm install
npm run dev
# open http://localhost:1234
```
