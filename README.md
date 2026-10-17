# CrossPointer

CrossPointer is a local-first, private, account-free trackpad and presentation laser
controller. The phone controls the computer; the app does not capture or read the host
screen.

## Development

Requirements: Node.js 20+ and npm. Install and verify the monorepo with:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Milestone 1 includes:

- `packages/protocol`: versioned, runtime-validated command schemas;
- `apps/controller-ui`: a static-export Next.js controller screen;
- `apps/desktop`: the Windows Electron input and dotted laser overlay proof.

The exported controller UI is written to `apps/controller-ui/out/`. To view it locally
after building, run a static file server from that directory, for example:

```text
npx serve apps/controller-ui/out
```

Then open the displayed local URL in a browser. The desktop proof remains Windows-only
because its native input adapter uses `user32.dll` through `koffi`.

## Windows host proof harness

Run `npm run desktop:start` on the reference Windows machine. The dashboard includes
presentation key buttons, a drag test, host capability reporting, and a diagnostic log.
Use **Ctrl+Shift+H** or **Emergency Stop / Release All** to hide the laser and release
any held mouse buttons or keys. Test presentation actions with a browser slideshow and
with a native PowerPoint/PDF presentation; focus the target presentation before using
Next Slide, Previous Slide, Start, Exit, or Blank Screen.

Network transport, pairing, and QR flows are intentionally not implemented yet.