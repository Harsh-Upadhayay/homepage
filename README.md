# homepage

Standalone Next.js homepage for the homelab.

## Local development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run lint
npm run build
```

## Container image

Pushes to `main` publish a multi-arch image to `ghcr.io/harsh-upadhayay/homepage:latest`.

The homelab deployment consumes that image through `homelab/homepage/compose.yml`.
