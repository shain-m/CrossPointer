# AGENTS.md

## Product contract
- This is CrossPointer: an open-source, local-first cross-device trackpad and presentation laser.
- The phone controls the operating system; the app does not capture or read the host screen.
- No account, cloud dependency, analytics, or internet requirement in the local-control path.

## Architecture
- Shared UI: Next.js, React, TypeScript, static export.
- Desktop host: Electron main process with narrow preload/IPC boundaries.
- Android/iOS: Capacitor wrappers around the shared UI.
- Keep OS mouse/overlay functionality behind typed host adapters.
- Keep transports behind an interface; LAN is the first transport.

## Coding rules
- Implement only the requested task; avoid unrelated refactors.
- Prefer small, typed functions and explicit state machines.
- Validate all incoming network messages and IPC requests at runtime.
- Do not claim tests passed if they were not executed.