<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vuejs/vuejs-original.svg" width="52" height="52" alt="Vue">
<span style="font-size:2rem;font-weight:700;line-height:1">Vue 3 Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

---

## Setup

```bash
npm install @hi-audio/latency-test
```

Import once in `main.js` / `main.ts` to register the custom element globally:

```js
import '@hi-audio/latency-test'
```

Tell Vue to treat `latency-test` as a custom element so it does not try to resolve it as a Vue component. In `vite.config.js`:

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'latency-test'
        }
      }
    })
  ]
})
```

---

## Basic usage (Composition API)

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const ltRef = ref(null)
const result = ref(null)
const error = ref(null)

function onResult(e) {
  result.value = e.detail
}

function onError(e) {
  error.value = e.detail.message
}

onMounted(() => {
  ltRef.value.addEventListener('latency-result', onResult)
  ltRef.value.addEventListener('latency-error', onError)
})

onBeforeUnmount(() => {
  ltRef.value.removeEventListener('latency-result', onResult)
  ltRef.value.removeEventListener('latency-error', onError)
})
</script>

<template>
  <div>
    <latency-test ref="ltRef" />
    <button @click="ltRef.start()">Test Latency</button>
    <button @click="ltRef.stop()">Stop</button>
    <p v-if="result">
      {{ result.latency }} ms — ratio: {{ result.ratio.toFixed(2) }} dB
    </p>
    <p v-if="error" style="color: red">Error: {{ error }}</p>
  </div>
</template>
```

---

## Multiple tests with aggregate results

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ numberOfTests: { type: Number, default: 5 } })

const ltRef = ref(null)
const runs = ref([])
const stats = ref(null)

function onResult(e) { runs.value.push(e.detail) }
function onComplete(e) { stats.value = e.detail }
function onError(e) { console.error(e.detail.message) }

function runTests() {
  runs.value = []
  stats.value = null
  ltRef.value.start()
}

onMounted(() => {
  ltRef.value.addEventListener('latency-result', onResult)
  ltRef.value.addEventListener('latency-complete', onComplete)
  ltRef.value.addEventListener('latency-error', onError)
})

onBeforeUnmount(() => {
  ltRef.value.removeEventListener('latency-result', onResult)
  ltRef.value.removeEventListener('latency-complete', onComplete)
  ltRef.value.removeEventListener('latency-error', onError)
})
</script>

<template>
  <div>
    <latency-test ref="ltRef" :number-of-tests="numberOfTests" />
    <button @click="runTests">Run {{ numberOfTests }} Tests</button>
    <ul>
      <li v-for="(r, i) in runs" :key="i">
        {{ r.latency }} ms (ratio: {{ r.ratio.toFixed(2) }} dB)
      </li>
    </ul>
    <p v-if="stats">
      Mean: {{ stats.mean.toFixed(2) }} ms | Std: {{ stats.std.toFixed(2) }} |
      Min: {{ stats.min.toFixed(2) }} | Max: {{ stats.max.toFixed(2) }}
    </p>
  </div>
</template>
```

---

## Sharing an existing AudioContext

```vue
<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({ audioContext: Object })
const ltRef = ref(null)

watch(() => props.audioContext, (ac) => {
  if (ltRef.value && ac) ltRef.value.audioContext = ac
})

onMounted(() => {
  if (props.audioContext) ltRef.value.audioContext = props.audioContext
})
</script>

<template>
  <latency-test ref="ltRef" />
</template>
```

---

## TypeScript

Types are bundled with the package. Import the element type for typed refs:

```ts
import type { LatencyTestElement } from '@hi-audio/latency-test'

const ltRef = ref<LatencyTestElement | null>(null)
ltRef.value?.start()       // ✅ typed
ltRef.value?.audioContext  // ✅ typed
```

To prevent Vue from warning about an unknown element, mark it as a custom element in `vite.config.ts`:

```ts
plugins: [
  vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === 'latency-test'
      }
    }
  })
]
```
