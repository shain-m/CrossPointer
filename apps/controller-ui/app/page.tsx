'use client';

import { useEffect, useRef, useState } from 'react';
import { ControllerTransport, type ConnectionState } from './transport';

type Mode = 'trackpad' | 'presentation';

export default function ControllerPage() {
  const [mode, setMode] = useState<Mode>('trackpad');
  const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
  const [laserEnabled, setLaserEnabled] = useState(false);
  const transport = useRef<ControllerTransport | undefined>(undefined);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const nextTransport = new ControllerTransport();
    transport.current = nextTransport;
    const unsubscribe = nextTransport.subscribe(setConnectionState);
    nextTransport.connect();
    return () => {
      unsubscribe();
      nextTransport.disconnect();
    };
  }, []);

  const send = (message: Parameters<ControllerTransport['send']>[0]) => {
    transport.current?.send(message);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPoint.current = { x: event.clientX, y: event.clientY };
    send({ type: 'trackpad.button-down', payload: { button: 'left' } });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!lastPoint.current) return;
    const deltaX = Math.round(event.clientX - lastPoint.current.x);
    const deltaY = Math.round(event.clientY - lastPoint.current.y);
    if (deltaX || deltaY) send({ type: 'trackpad.move', payload: { deltaX, deltaY } });
    lastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    lastPoint.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    send({ type: 'trackpad.button-up', payload: { button: 'left' } });
  };

  return (
    <main className="controller-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CrossPointer</p>
          <h1>{mode === 'trackpad' ? 'Trackpad' : 'Presentation'}</h1>
        </div>
        <span className={`connection-status ${connectionState.toLowerCase().replaceAll(' ', '-')}`}><i /> {connectionState}</span>
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
        <section
          className="trackpad-card"
          aria-label="Trackpad surface"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(event) => send({
            type: 'trackpad.scroll',
            payload: { deltaX: Math.round(event.deltaX), deltaY: Math.round(event.deltaY) },
          })}
        >
          <div className="trackpad-mark"><span /> Move pointer</div>
          <p>Touch and drag anywhere in this surface</p>
        </section>
      ) : (
        <section className="presentation-card" aria-label="Presentation controls" onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          send({
            type: 'laser.position',
            payload: {
              x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
              y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
            },
          });
        }}>
          <button className="presentation-action" onClick={() => send({ type: 'presentation.action', payload: { action: 'previous' } })} type="button" aria-label="Previous slide">←</button>
          <div className="laser-control">
            <button className={`laser-dot ${laserEnabled ? 'enabled' : ''}`} onClick={() => {
              const enabled = !laserEnabled;
              setLaserEnabled(enabled);
              send({ type: 'laser.toggle', payload: { enabled } });
            }} type="button" aria-label={laserEnabled ? 'Disable laser pointer' : 'Enable laser pointer'} />
            <span>Laser pointer</span>
          </div>
          <button className="presentation-action" onClick={() => send({ type: 'presentation.action', payload: { action: 'next' } })} type="button" aria-label="Next slide">→</button>
        </section>
      )}

      <footer className="bottom-bar">
        <span>{connectionState === 'Connected' ? 'Connected locally' : 'Waiting for host approval'}</span>
        <div className="presentation-shortcuts">
          <button onClick={() => send({ type: 'presentation.action', payload: { action: 'start' } })} type="button">F5</button>
          <button onClick={() => send({ type: 'presentation.action', payload: { action: 'exit' } })} type="button">Esc</button>
        </div>
      </footer>
    </main>
  );
}
