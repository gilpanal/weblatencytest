<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/angular/angular-original.svg" width="52" height="52" alt="Angular">
<span style="font-size:2rem;font-weight:700;line-height:1">Angular Integration</span>
</div>

> **Draft.** The component is not yet published. See [install.md](../install.md) for setup instructions once it is.

---

## Setup

```bash
npm install @hi-audio/latency-test
```

Import the package once in `main.ts`:

```ts
import '@hi-audio/latency-test'
```

Add `CUSTOM_ELEMENTS_SCHEMA` to every Angular module or standalone component that uses `<latency-test>`, otherwise Angular will throw a template error on the unknown element.

---

## Standalone component (Angular 15+)

```ts
import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  Input
} from '@angular/core'

@Component({
  selector: 'app-latency-tester',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <latency-test #lt [attr.number-of-tests]="numberOfTests"></latency-test>
    <button (click)="start()">Test Latency</button>
    <button (click)="stop()">Stop</button>
    <p *ngIf="result">{{ result.latency }} ms — ratio: {{ result.ratio | number:'1.2-2' }} dB</p>
    <p *ngIf="error" style="color:red">Error: {{ error }}</p>
  `
})
export class LatencyTesterComponent implements AfterViewInit, OnDestroy {
  @Input() numberOfTests = 1
  @ViewChild('lt') ltRef!: ElementRef<HTMLElement>

  result: { latency: number; ratio: number; timestamp: number } | null = null
  error: string | null = null

  private onResult = (e: Event) => {
    this.result = (e as CustomEvent).detail
  }

  private onError = (e: Event) => {
    this.error = (e as CustomEvent).detail.message
  }

  ngAfterViewInit() {
    const el = this.ltRef.nativeElement
    el.addEventListener('latency-result', this.onResult)
    el.addEventListener('latency-error', this.onError)
  }

  ngOnDestroy() {
    const el = this.ltRef.nativeElement
    el.removeEventListener('latency-result', this.onResult)
    el.removeEventListener('latency-error', this.onError)
  }

  start() { (this.ltRef.nativeElement as any).start() }
  stop() { (this.ltRef.nativeElement as any).stop() }
}
```

---

## Multiple tests with aggregate results

```ts
@Component({
  selector: 'app-multi-latency',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <latency-test #lt [attr.number-of-tests]="numberOfTests"></latency-test>
    <button (click)="runTests()">Run {{ numberOfTests }} Tests</button>
    <ul>
      <li *ngFor="let r of runs">{{ r.latency }} ms (ratio: {{ r.ratio | number:'1.2-2' }} dB)</li>
    </ul>
    <p *ngIf="stats">
      Mean: {{ stats.mean | number:'1.2-2' }} ms |
      Std: {{ stats.std | number:'1.2-2' }} |
      Min: {{ stats.min | number:'1.2-2' }} |
      Max: {{ stats.max | number:'1.2-2' }}
    </p>
  `
})
export class MultiLatencyComponent implements AfterViewInit, OnDestroy {
  @Input() numberOfTests = 5
  @ViewChild('lt') ltRef!: ElementRef<HTMLElement>

  runs: any[] = []
  stats: any = null

  private onResult = (e: Event) => { this.runs = [...this.runs, (e as CustomEvent).detail] }
  private onComplete = (e: Event) => { this.stats = (e as CustomEvent).detail }
  private onError = (e: Event) => { console.error((e as CustomEvent).detail.message) }

  ngAfterViewInit() {
    const el = this.ltRef.nativeElement
    el.addEventListener('latency-result', this.onResult)
    el.addEventListener('latency-complete', this.onComplete)
    el.addEventListener('latency-error', this.onError)
  }

  ngOnDestroy() {
    const el = this.ltRef.nativeElement
    el.removeEventListener('latency-result', this.onResult)
    el.removeEventListener('latency-complete', this.onComplete)
    el.removeEventListener('latency-error', this.onError)
  }

  runTests() {
    this.runs = []
    this.stats = null
    ;(this.ltRef.nativeElement as any).start()
  }
}
```

---

## Sharing an existing AudioContext

```ts
ngAfterViewInit() {
  const el = this.ltRef.nativeElement as any
  if (this.audioContext) {
    el.audioContext = this.audioContext
  }
}
```

---

## NgModule-based projects (Angular < 15)

Add `CUSTOM_ELEMENTS_SCHEMA` to the `schemas` array of your `NgModule`:

```ts
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'

@NgModule({
  declarations: [LatencyTesterComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

---

## TypeScript

Types are bundled with the package. Use the exported type with `@ViewChild` for fully typed programmatic access:

```ts
import type { LatencyTestElement } from '@hi-audio/latency-test'
import { ViewChild, ElementRef, AfterViewInit } from '@angular/core'

@ViewChild('lt') ltRef!: ElementRef<LatencyTestElement>

ngAfterViewInit() {
  this.ltRef.nativeElement.start()       // ✅ typed
  this.ltRef.nativeElement.audioContext  // ✅ typed
}
```

> `CUSTOM_ELEMENTS_SCHEMA` disables Angular's template type checker for custom elements. TypeScript types apply to programmatic `@ViewChild` access only.
