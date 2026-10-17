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

The current implementation includes:

- `packages/protocol`: versioned, runtime-validated command schemas;
- `apps/controller-ui`: a static-export Next.js controller screen;
- `apps/desktop`: the Windows Electron input, dotted laser overlay, local HTTP/WebSocket
  server, QR pairing, approval gate, and in-memory session revocation.

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

## Local Wi-Fi controller flow

1. Build the exported controller and shared protocol with `npm run build`.
2. Start the Windows host with `npm run desktop:start`. The dashboard binds to the
   host's non-internal LAN IPv4 address and shows a QR code plus a manual URL.
3. Connect the phone and host to the same Wi-Fi network. Avoid guest networks with
   client isolation, which prevents devices from reaching one another.
4. Scan the QR code with the phone camera, or open the displayed URL in the phone
   browser. The controller opens a local WebSocket and shows `Pending Approval`.
5. On the desktop dashboard, approve **New Controller Device connected**. The phone
   changes to `Connected`; use the Trackpad or Presentation mode to send commands.
6. Use **Revoke / Disconnect device** on the dashboard to invalidate the active
   connection. A disconnect also releases held mouse buttons and hides the laser.

The pairing URL is a short-lived LAN bearer secret and approval is always required.
Authorized sessions are held in memory and are revoked when disconnected or expired.
This milestone does not claim transport encryption; do not expose the local server
outside a trusted local network.