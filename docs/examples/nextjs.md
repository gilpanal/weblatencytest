<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg" width="52" height="52" alt="Next.js">
<span style="font-size:2rem;font-weight:700;line-height:1">Next.js Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

---

## Important: SSR constraint

`<latency-test>` uses `navigator.mediaDevices`, `AudioContext`, and `AudioWorklet` — browser-only APIs. These do not exist in the Node.js environment where Next.js runs server-side rendering. **The component must be loaded client-side only.**

---

## Setup

```bash
npm install @hi-audio/latency-test
```

---

## App Router (Next.js 13+)

Use a Client Component with a `useEffect` lazy import. The `'use client'` directive ensures the component only renders in the browser; the lazy import inside `useEffect` guarantees the module (which references browser-only APIs) is never evaluated on the server.

```tsx
// components/LatencyTester.tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import type { LatencyTestElement, LatencyResultDetail, LatencyErrorDetail } from '@hi-audio/latency-test'

// Registers the custom element client-side only
function useLatencyTest() {
  useEffect(() => {
    import('@hi-audio/latency-test')
  }, [])
}

export function LatencyTester() {
  useLatencyTest()

  const ltRef = useRef<LatencyTestElement | null>(null)
  const [result, setResult] = useState<LatencyResultDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = ltRef.current
    if (!el) return

    const onResult = (e: CustomEvent<LatencyResultDetail>) => setResult(e.detail)
    const onError = (e: CustomEvent<LatencyErrorDetail>) => setError(e.detail.message)

    el.addEventListener('latency-result', onResult)
    el.addEventListener('latency-error', onError)

    return () => {
      el.removeEventListener('latency-result', onResult)
      el.removeEventListener('latency-error', onError)
    }
  }, [])

  return (
    <div>
      <latency-test ref={ltRef} />
      <button onClick={() => ltRef.current?.start()}>Test Latency</button>
      {result && <p>{result.latency} ms — ratio: {result.ratio.toFixed(2)} dB</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  )
}
```

> Requires the `custom-elements.d.ts` JSX declaration from the TypeScript section below (React < 19). React 19+ needs no extra declaration.

Use in a Server Component page by importing the Client Component:

```tsx
// app/page.tsx
import { LatencyTester } from '@/components/LatencyTester'

export default function Page() {
  return (
    <main>
      <h1>Audio Latency Test</h1>
      <LatencyTester />
    </main>
  )
}
```

---

## Pages Router (Next.js 12 and earlier)

Use `next/dynamic` with `ssr: false`:

```tsx
// pages/index.tsx
import dynamic from 'next/dynamic'

const LatencyTester = dynamic(
  () => import('../components/LatencyTester').then((m) => m.LatencyTester),
  { ssr: false }
)

export default function Home() {
  return (
    <main>
      <h1>Audio Latency Test</h1>
      <LatencyTester />
    </main>
  )
}
```

---

## TypeScript

Types are bundled with the package. Programmatic access via `useRef` is always fully typed:

```ts
const el = ltRef.current // → LatencyTestElement
el?.start()        // ✅ typed
el?.audioContext   // ✅ typed
```

**React 19+** — once the package is installed, `<latency-test>` in JSX picks up types from `HTMLElementTagNameMap` automatically. No manual declarations needed. Verify end-to-end once the package is published.

**React < 19** (most current Next.js projects) — add a JSX namespace declaration:

```ts
// types/custom-elements.d.ts
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
