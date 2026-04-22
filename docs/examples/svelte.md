<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/svelte/svelte-original.svg" width="52" height="52" alt="Svelte">
<span style="font-size:2rem;font-weight:700;line-height:1">Svelte / SvelteKit Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

---

## Setup

```bash
npm install @hi-audio/latency-test
```

Svelte works natively with custom elements — no special configuration needed. Import the package in the component that uses it.

---

## Basic usage

```svelte
<script>
  import '@hi-audio/latency-test'
  import { onMount, onDestroy } from 'svelte'

  let lt
  let result = null
  let error = null

  function onResult(e) { result = e.detail }
  function onError(e) { error = e.detail.message }

  onMount(() => {
    lt.addEventListener('latency-result', onResult)
    lt.addEventListener('latency-error', onError)
  })

  onDestroy(() => {
    lt.removeEventListener('latency-result', onResult)
    lt.removeEventListener('latency-error', onError)
  })
</script>

<latency-test bind:this={lt} />
<button on:click={() => lt.start()}>Test Latency</button>
<button on:click={() => lt.stop()}>Stop</button>

{#if result}
  <p>{result.latency} ms — ratio: {result.ratio.toFixed(2)} dB</p>
{/if}

{#if error}
  <p style="color: red">Error: {error}</p>
{/if}
```

---

## Multiple tests with aggregate results

```svelte
<script>
  import '@hi-audio/latency-test'
  import { onMount, onDestroy } from 'svelte'

  export let numberOfTests = 5

  let lt
  let runs = []
  let stats = null

  function onResult(e) { runs = [...runs, e.detail] }
  function onComplete(e) { stats = e.detail }
  function onError(e) { console.error(e.detail.message) }

  function runTests() {
    runs = []
    stats = null
    lt.start()
  }

  onMount(() => {
    lt.addEventListener('latency-result', onResult)
    lt.addEventListener('latency-complete', onComplete)
    lt.addEventListener('latency-error', onError)
  })

  onDestroy(() => {
    lt.removeEventListener('latency-result', onResult)
    lt.removeEventListener('latency-complete', onComplete)
    lt.removeEventListener('latency-error', onError)
  })
</script>

<latency-test bind:this={lt} number-of-tests={numberOfTests} />
<button on:click={runTests}>Run {numberOfTests} Tests</button>

<ul>
  {#each runs as r, i}
    <li>{r.latency} ms (ratio: {r.ratio.toFixed(2)} dB)</li>
  {/each}
</ul>

{#if stats}
  <p>
    Mean: {stats.mean.toFixed(2)} ms | Std: {stats.std.toFixed(2)} |
    Min: {stats.min.toFixed(2)} | Max: {stats.max.toFixed(2)}
  </p>
{/if}
```

---

## Sharing an existing AudioContext

```svelte
<script>
  import '@hi-audio/latency-test'
  import { onMount } from 'svelte'

  export let audioContext

  let lt

  onMount(() => {
    if (audioContext) lt.audioContext = audioContext
  })

  $: if (lt && audioContext) lt.audioContext = audioContext
</script>

<latency-test bind:this={lt} />
```

---

## SvelteKit note

SvelteKit runs components on the server during SSR. Custom elements that access `navigator` or `AudioContext` must be guarded:

```svelte
<script>
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'

  let lt

  onMount(async () => {
    if (browser) {
      await import('@hi-audio/latency-test')
    }
  })
</script>

{#if browser}
  <latency-test bind:this={lt} />
  <button on:click={() => lt?.start()}>Test Latency</button>
{/if}
```

---

## TypeScript

Types are bundled with the package. Declare the element type for `bind:this`:

```ts
import type { LatencyTestElement } from '@hi-audio/latency-test'

let lt: LatencyTestElement

// then in the template:
// <latency-test bind:this={lt} />

lt?.start()       // ✅ typed
lt?.audioContext  // ✅ typed
```
