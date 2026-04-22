<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width="52" height="52" alt="React">
<span style="font-size:2rem;font-weight:700;line-height:1">React Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

---

## Setup

```bash
npm install @hi-audio/latency-test
```

Import once at your app entry point (e.g. `main.jsx` or `index.js`) to register the custom element globally:

```js
import '@hi-audio/latency-test'
```

---

## Basic component wrapper

React treats unknown HTML elements as custom elements. Use a `ref` to call imperative methods and attach event listeners.

```jsx
import { useRef, useEffect, useState } from 'react'

export function LatencyTester() {
  const ltRef = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const el = ltRef.current
    if (!el) return

    const onResult = (e) => setResult(e.detail)
    const onError = (e) => setError(e.detail.message)

    el.addEventListener('latency-result', onResult)
    el.addEventListener('latency-error', onError)

    return () => {
      el.removeEventListener('latency-result', onResult)
      el.removeEventListener('latency-error', onError)
    }
  }, [])

  return (
    <div>
      <latency-test ref={ltRef} number-of-tests="1" />
      <button onClick={() => ltRef.current?.start()}>Test Latency</button>
      <button onClick={() => ltRef.current?.stop()}>Stop</button>
      {result && (
        <p>
          {result.latency} ms — ratio: {result.ratio.toFixed(2)} dB
        </p>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  )
}
```

---

## Multiple tests with aggregate results

```jsx
import { useRef, useEffect, useState } from 'react'

export function MultiLatencyTester({ numberOfTests = 5 }) {
  const ltRef = useRef(null)
  const [runs, setRuns] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const el = ltRef.current
    if (!el) return

    const onResult = (e) => setRuns((prev) => [...prev, e.detail])
    const onComplete = (e) => setStats(e.detail)
    const onError = (e) => console.error(e.detail.message)

    el.addEventListener('latency-result', onResult)
    el.addEventListener('latency-complete', onComplete)
    el.addEventListener('latency-error', onError)

    return () => {
      el.removeEventListener('latency-result', onResult)
      el.removeEventListener('latency-complete', onComplete)
      el.removeEventListener('latency-error', onError)
    }
  }, [])

  return (
    <div>
      <latency-test ref={ltRef} number-of-tests={numberOfTests} />
      <button onClick={() => { setRuns([]); setStats(null); ltRef.current?.start() }}>
        Run {numberOfTests} Tests
      </button>
      <ul>
        {runs.map((r, i) => (
          <li key={i}>{r.latency} ms (ratio: {r.ratio.toFixed(2)} dB)</li>
        ))}
      </ul>
      {stats && (
        <p>
          Mean: {stats.mean.toFixed(2)} ms | Std: {stats.std.toFixed(2)} |
          Min: {stats.min.toFixed(2)} | Max: {stats.max.toFixed(2)}
        </p>
      )}
    </div>
  )
}
```

---

## Sharing an existing AudioContext

```jsx
import { useRef, useEffect } from 'react'

export function LatencyTesterWithContext({ audioContext }) {
  const ltRef = useRef(null)

  useEffect(() => {
    const el = ltRef.current
    if (!el || !audioContext) return
    el.audioContext = audioContext
  }, [audioContext])

  return <latency-test ref={ltRef} />
}
```

---

## TypeScript

Types are bundled with the package. Programmatic access via `ref` is always fully typed:

```ts
const el = ltRef.current // → LatencyTestElement
el?.start()        // ✅ typed
el?.audioContext   // ✅ typed
```

**React 19+** — once the package is installed, `<latency-test>` in JSX picks up types from `HTMLElementTagNameMap` automatically. No manual declarations needed. Verify end-to-end once the package is published.

**React < 19** — add a JSX namespace declaration to avoid template type errors:

```ts
// src/custom-elements.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'latency-test': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'number-of-tests'?: number
      'mls-bits'?: number
      'max-lag-ms'?: number
      'recording-mode'?: 'mediarecorder' | 'audioworklet'
      'signal-type'?: 'mls' | 'chirp' | 'golay'
      'input-gain'?: number
    }
  }
}
```
