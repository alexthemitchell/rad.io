# rad.io - Software-Defined Radio Visualizer

See `docs/ROADMAP.md` for roadmap and planned features.

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm ci
npm start
```

### Script Contract

- `npm start`: start local dev server.
- `npm run build`: type-check and build production bundle.
- `npm run build:prod`: alias for `npm run build`.
- `npm test`: run unit tests.
- `npm run test:watch`: run tests in watch mode.
- `npm run test:e2e`: run Playwright E2E smoke tests (CI-safe, no physical hardware required).
- `npm run test:e2e:real`: run Playwright tests tagged `@real-device` (set `RAD_REAL_DEVICE=1` to execute device-gated checks).
- `npm run lint`: run ESLint.
- `npm run lint:fix`: auto-fix ESLint issues.
- `npm run lint:css`: run Stylelint on CSS.
- `npm run lint:css:fix`: auto-fix Stylelint issues.
- `npm run format`: run Prettier on tracked config/docs files.
- `npm run format:check`: verify Prettier formatting.
- `npm run type-check`: run TypeScript in strict check mode.
- `npm run validate`: run lint + format check + type-check + tests.
- `npm run clean`: remove `dist` and `coverage` artifacts.
