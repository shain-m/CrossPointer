# Contributing to CrossPointer

CrossPointer is a local-first Windows host and phone controller. Contributions should preserve the product contract in [AGENTS.md](./AGENTS.md): no accounts, cloud dependency, analytics, or internet requirement in the local-control path.

## Setup

Use Node.js 20 or newer and the npm version bundled with it. From a clean clone:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The controller UI is static-exported to `apps/controller-ui/out/`. The existing desktop proof requires Windows because its native input adapter uses `user32.dll`; the shared protocol and controller UI can be checked on Windows, macOS, or Linux. Native mobile and platform packaging toolchains are not part of Milestone 1.

Keep changes focused, include tests for protocol behavior, and describe the platforms checked in pull requests. Do not commit secrets, `.env` files, pairing credentials, signing certificates, generated output, or user data.

## Architecture boundaries

Add new messages to `packages/protocol` with a Zod schema and tests. Keep operating-system input and overlay behavior behind typed desktop adapters. Network transports, pairing, and QR flows are intentionally out of scope for this milestone.
