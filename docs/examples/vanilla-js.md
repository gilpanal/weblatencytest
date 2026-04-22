<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" width="52" height="52" alt="JavaScript">
<span style="font-size:2rem;font-weight:700;line-height:1">Vanilla JS Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

No framework required. Import the package and use the element directly in HTML.

---

## Single test

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@hi-audio/latency-test/dist/latency-test.js"></script>
</head>
<body>
  <button id="btn">Test Latency</button>
  <p id="result"></p>

  <latency-test id="lt"></latency-test>

  <script>
    const lt = document.getElementById('lt')
    const btn = document.getElementById('btn')
    const result = document.getElementById('result')

    lt.addEventListener('latency-result', (e) => {
      const { latency, ratio } = e.detail
      result.textContent = `${latency} ms — ratio: ${ratio.toFixed(2)} dB`
    })

    lt.addEventListener('latency-error', (e) => {
      result.textContent = `Error: ${e.detail.message}`
    })

    btn.addEventListener('click', () => lt.start())
  </script>
</body>
</html>
```

---

## Multiple consecutive tests with statistics

```html
<latency-test id="lt" number-of-tests="10"></latency-test>

<script>
  const lt = document.getElementById('lt')

  lt.addEventListener('latency-result', (e) => {
    console.log(`Run result: ${e.detail.latency} ms`)
  })

  lt.addEventListener('latency-complete', (e) => {
    const { mean, std, min, max } = e.detail
    console.log(`Mean: ${mean.toFixed(2)} ms | Std: ${std.toFixed(2)} | Min: ${min.toFixed(2)} | Max: ${max.toFixed(2)}`)
  })

  lt.start()
</script>
```

---

## Sharing an existing AudioContext

```js
import '@hi-audio/latency-test'

const ac = new AudioContext()
const lt = document.querySelector('latency-test')
lt.audioContext = ac

lt.addEventListener('latency-result', (e) => {
  console.log(e.detail.latency, 'ms')
})

lt.start()
```

---

## Stopping an in-progress test

```js
const lt = document.querySelector('latency-test')

document.getElementById('stopBtn').addEventListener('click', () => {
  lt.stop()
})
```

---

## TypeScript

Types are bundled with the package. No manual declarations needed — `querySelector` returns the correct type automatically:

```ts
import '@hi-audio/latency-test'

const el = document.querySelector('latency-test') // → LatencyTestElement
el?.start()        // ✅ typed
el?.audioContext   // ✅ typed
el?.addEventListener('latency-result', (e) => {
  console.log(e.detail.latency) // ✅ typed
})
```
