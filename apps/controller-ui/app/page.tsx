'use client';

import { useState } from 'react';

type Mode = 'trackpad' | 'presentation';

export default function ControllerPage() {
  const [mode, setMode] = useState<Mode>('trackpad');

  return (
    <main className="controller-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CrossPointer</p>
          <h1>{mode === 'trackpad' ? 'Trackpad' : 'Presentation'}</h1>
        </div>
        <span className="connection-status"><i /> Ready</span>
      </header>

      <nav className="mode-switcher" aria-label="Controller mode">
        <button className={mode === 'trackpad' ? 'active' : ''} onClick={() => setMode('trackpad')} type="button">
          Trackpad
        </button>
        <button className={mode === 'presentation' ? 'active' : ''} onClick={() => setMode('presentation')} type="button">
          Presentation
        </button>
      </nav>

      {mode === 'trackpad' ? (
        <section className="trackpad-card" aria-label="Trackpad surface">
          <div className="trackpad-mark"><span /> Move pointer</div>
          <p>Touch and drag anywhere in this surface</p>
        </section>
      ) : (
        <section className="presentation-card" aria-label="Presentation controls">
          <button className="presentation-action" type="button" aria-label="Previous slide">←</button>
          <div className="laser-control"><span className="laser-dot" />Laser pointer</div>
          <button className="presentation-action" type="button" aria-label="Next slide">→</button>
        </section>
      )}

      <footer className="bottom-bar">
        <span>Connected locally</span>
        <button type="button">Settings</button>
      </footer>
    </main>
  );
}
