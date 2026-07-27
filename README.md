# Blockprint

Blockprint is a browser-based Minecraft Bedrock blueprint designer. It supports
layered plans, a state-aware block catalog, material counts, and round-trip
`.mcstructure` import and export.

## Development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm test
npm run lint
npm run audit:textures
```

The texture audit compares the local Bedrock texture catalog with Microsoft's
official block/state listing and writes its findings to `MISSING_TEXTURES.md`.

## GitHub Pages

The app uses Next.js static export. Pushes to `main` are built and deployed by
`.github/workflows/deploy-pages.yml`.

Production build:

```bash
npm run build:pages
```
