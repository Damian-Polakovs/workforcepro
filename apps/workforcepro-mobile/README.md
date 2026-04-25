pnpm install
pnpm dev

If you start this app by itself, also run the backend from the monorepo root:

```bash
pnpm dev:backend
```

Camera face scans require Face++ verification. Set the Face++ keys in the root
`.env`:

```bash
WORKFORCE_FACE_PROVIDER=FACEPP
WORKFORCE_FACEPP_API_KEY=...
WORKFORCE_FACEPP_API_SECRET=...
```
