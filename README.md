# DrivingSupport

DrivingSupport is a browser-based driving-practice simulator. Learners rehearse driving-related body movements with ordinary PC or smartphone cameras, supported by keyboard fallback where camera foot tracking is unsuitable.

It is supplementary preparation, repetition, review, and procedural practice. It does not replace real driving instruction or on-road practice.

## Current technical baseline

- Next.js, React, TypeScript, Three.js, and Zustand.
- MediaPipe face, hand, and pose landmark processing in the browser.
- Guided lessons, checkpoints, scoring, feedback, retry, and free mode.
- Firebase authentication/history when configured, with guest-mode degradation when it is not.
- Japanese/English language selection.

See the public product and engineering source of truth:

- [`docs/product/VISION.md`](docs/product/VISION.md)
- [`docs/product/PRD.md`](docs/product/PRD.md)
- [`docs/product/MVP_SCOPE.md`](docs/product/MVP_SCOPE.md)
- [`docs/product/MVP_GAP_ANALYSIS.md`](docs/product/MVP_GAP_ANALYSIS.md)
- [`docs/product/PRODUCT_STRATEGY.md`](docs/product/PRODUCT_STRATEGY.md)
- [`docs/process/GITHUB_WORKFLOW.md`](docs/process/GITHUB_WORKFLOW.md)
- [`AGENTS.md`](AGENTS.md)

## Getting started

Use Node 24 or newer, as declared in `package.json`.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run type-check
npm run build
npm run smoke
```

CI runs lint/type-check and build/smoke checks across supported operating systems.

## Camera and privacy

Camera processing is central to the product. New work should follow the preferred flow of camera → browser-side processing → derived landmarks/state → driving logic → score. Do not add raw-video storage without an explicit reviewed requirement. Documentation must describe actual runtime behavior and must not claim local-only processing unless verified.

Confidential commercial plans, pricing, named pilot information, recruitment, and private research belong in the private operations project/repository, not this public repository.
