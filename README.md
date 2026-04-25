# WorkForcePro

From the monorepo root, start the backend and Expo frontend at the same time:

```bash
pnpm dev
```

Start only the Android development client Metro server:

```bash
pnpm dev:client
```

This expects the backend to already be running in another terminal:

```bash
pnpm dev:backend
```

If the phone cannot find the server on your local network, start Expo through a tunnel:

```bash
pnpm dev:tunnel
```

For Android development-client QR timeouts, use `pnpm dev:tunnel`. The default
`pnpm dev` expects the phone and laptop to be on the same WiFi and Windows
Firewall to allow Node.js.

Create an Android development client build from the monorepo root:

```bash
pnpm eas:android:dev
```

Run raw EAS commands from `apps/workforcepro-mobile`, not from the monorepo root.
