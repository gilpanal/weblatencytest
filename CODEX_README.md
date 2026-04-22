# CODEX_README.md

## README direction proposal

The root `README.md` should now behave more like a developer entry point than a research report.

At the current stage of the repository, the README should answer these questions quickly:

- What is this project?
- What is its current status?
- How is it meant to be used?
- Where is the real documentation?
- How do I run or develop it locally?

The README should no longer center large experimental result tables or extended scientific discussion. Those are still valuable, but they now feel out of scope for the repo homepage if the primary audience is developers evaluating or integrating the future web component.

## Recommended README goals

1. Explain the repository in one short paragraph.
2. State clearly that the package/component is still in progress if it is not yet published.
3. Show the intended developer-facing usage quickly.
4. Point readers to the VitePress docs as the canonical integration reference.
5. Keep local development instructions easy to find.
6. Preserve the research origin in a short linked section rather than making it the main body of the README.

## Suggested structure

### 1. Title + short description

Example direction:

`weblatencytest` is an in-progress Web Component for measuring browser round-trip audio latency in Web Audio applications.

Keep this concise and practical.

### 2. Status

Add a short explicit status block near the top:

- draft / in progress
- package not yet published, if true
- current demo/prototype still exists in the repo

This reduces confusion, especially since some docs already describe the target API.

### 3. What the component is for

A short bullet list is enough:

- measuring round-trip browser audio latency
- intended for integration into Web Audio / DAW-like applications
- headless-first API with methods and events

### 4. Planned usage at a glance

Keep a very small example, even if still marked as draft.

For example:

```html
<latency-test id="lt"></latency-test>
<button onclick="document.getElementById('lt').start()">Test</button>

<script type="module">
  import '@hi-audio/latency-test'

  document.getElementById('lt').addEventListener('latency-result', (e) => {
    console.log(e.detail.latency, e.detail.ratio)
  })
</script>
```

If the package is not yet published, label this clearly as the intended API.

### 5. Documentation

Add a short section pointing to:

- the VitePress docs site
- API reference
- framework examples
- live demo, once available

This should become the main route for detailed integration guidance.

### 6. Local development

Keep this short and practical:

```bash
npm install
npm run dev
```

Optionally add:

```bash
npm run docs:dev
```

if you want contributors to discover the docs workflow quickly.

### 7. Repository scope

Short explanation:

- current repo includes prototype code, package planning, and docs-site work
- root README is intentionally short
- detailed package docs live in `docs/`

### 8. Research origin

Keep this, but compress it heavily.

Suggested approach:

- one short paragraph explaining that the project originates from WAC 2025 research on browser round-trip audio latency
- link to the original proof-of-concept repo
- link to the paper / citation

This preserves context without turning the README into a paper companion.

### 9. Roadmap or current limitations

A short section is useful:

- current implementation still uses `MediaRecorder`
- `AudioWorklet` migration is planned
- package publication is pending

This is enough. Avoid large discussion sections here.

## What should be removed or heavily reduced

These sections feel too large for the current README purpose:

- `Results and discussion`
- long browser-comparison tables
- long DAW-comparison tables
- extended interpretation of experimental outcomes
- detailed footnotes about historical measurements

These are better moved to one of:

- the paper
- a dedicated research/background page
- a separate archival/reference document

## What should remain in short form

These are still worth keeping, but compressed:

- project origin
- citation link
- acknowledgment that the methodology comes from published research
- mention of the `18 dB` reliability ratio in one line if it is part of the practical API story

## Tone recommendation

The README should read like:

- a developer-facing project homepage
- concise
- status-aware
- practical

It should not read like:

- a paper appendix
- a research report
- a benchmark archive

## Recommended balance

Good balance for the README:

- 70% developer onboarding
- 20% project status / roadmap
- 10% research origin and citation

That split feels more appropriate for the current repo direction.

## Final recommendation

Yes: `Results and discussion` is now out of scope for the root README.

The README should become a brief developer-oriented entry point, while scientific outcomes and deeper methodological discussion should move to linked references or dedicated documentation pages.
