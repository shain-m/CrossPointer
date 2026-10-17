# CrossPointer

Turn your phone into a wireless trackpad and presentation laser pointer for your computer. Local-first, private, and account-free.

## Milestone 0 Windows proof

This repository currently contains only the Windows Electron feasibility spike. It opens
a dashboard and a separate transparent, click-through laser overlay. The dashboard can
send relative cursor movement, clicks, and scroll through the Windows `SendInput` API
using a direct `koffi` binding, without spawning PowerShell for each event.

Requirements: Windows, Node.js 20+, and npm. Run:

```text
npm install
npm start
```

Use a safe target while testing the input buttons. Click **Show laser**, then use
**Move laser marker**. The overlay is intentionally a proof only: it has no network
transport, pairing, cleanup state machine, or production packaging.