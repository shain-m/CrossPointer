'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ControllerTransport,
  type ConnectionState,
  type DisplayInfo,
  type DisplayLayout,
} from './transport';

type Mode = 'trackpad' | 'presentation';
type Point = { x: number; y: number };
type DisplayTarget = number | 'auto';
type PresentationProfile = 'powerpoint' | 'google-slides' | 'pdf-viewer';
type LaserMode = 'relative' | 'absolute';

function GearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Zm8.1 3.7c0-.5-.1-1-.2-1.5l1.5-1.1-1.8-3.1-1.8.8c-.8-.7-1.7-1.2-2.7-1.5L14.8 3h-3.6l-.3 2.1c-1 .3-1.9.8-2.7 1.5l-1.8-.8-1.8 3.1 1.5 1.1c-.1.5-.2 1-.2 1.5s.1 1 .2 1.5l-1.5 1.1 1.8 3.1 1.8-.8c.8.7 1.7 1.2 2.7 1.5l.3 2.1h3.6l.3-2.1c1-.3 1.9-.8 2.7-1.5l1.8.8 1.8-3.1-1.5-1.1c.1-.5.2-1 .2-1.5Z"/></svg>;
}

function ModeIcon({ presentation }: { presentation: boolean }) {
  return presentation
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 8h4v3H7zM13 8h4v3h-4zM7 13h4v2H7zM13 13h4v2h-4z"/></svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' | 'down' }) {
  const path = direction === 'left' ? 'm14 5-7 7 7 7' : direction === 'right' ? 'm10 5 7 7-7 7' : 'm5 9 7 7 7-7';
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path}/></svg>;
}

function LaserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 11h6l-1 9 8-12h-6l1-8Z"/></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z"/></svg>;
}

const connectionLabels: Record<ConnectionState, string> = {
  Connecting: 'Waiting for Approval',
  'Pending Approval': 'Waiting for Approval',
  Connected: 'Connected',
  Disconnected: 'Disconnected',
};

function GridCanvas({
  className,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: {
  className: string;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerEnd: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, Point>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(container.clientWidth * ratio);
      canvas.height = Math.round(container.clientHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
    };

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      context.clearRect(0, 0, bounds.width, bounds.height);
      const spacingX = 34;
      const spacingY = 28;
      for (let row = -1; row < bounds.height / spacingY + 1; row += 1) {
        const offset = row % 2 === 0 ? 0 : spacingX / 2;
        for (let column = -1; column < bounds.width / spacingX + 1; column += 1) {
          const x = column * spacingX + offset;
          const y = row * spacingY;
          let glow = 0;
          points.current.forEach((point) => {
            const distance = Math.hypot(x - point.x, y - point.y);
            glow = Math.max(glow, Math.max(0, 1 - distance / 110));
          });
          context.beginPath();
          context.arc(x, y, 1.3 + glow * 2.5, 0, Math.PI * 2);
          context.fillStyle = glow > 0
            ? `rgba(56, 189, 248, ${0.2 + glow * 0.8})`
            : 'rgba(113, 113, 122, 0.3)';
          context.shadowBlur = glow * 16;
          context.shadowColor = '#00a6ff';
          context.fill();
        }
      }
      context.shadowBlur = 0;
      frame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    const observer = containerRef.current ? new ResizeObserver(resize) : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);
    frame = window.requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const updatePoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    points.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div ref={containerRef} className="canvas-viewport">
      <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePoint(event);
        onPointerDown(event);
      }}
      onPointerMove={(event) => {
        updatePoint(event);
        onPointerMove(event);
      }}
      onPointerUp={(event) => {
        points.current.delete(event.pointerId);
        onPointerEnd(event);
      }}
      onPointerCancel={(event) => {
        points.current.delete(event.pointerId);
        onPointerEnd(event);
      }}
      aria-label="Interactive dotted control surface"
      />
    </div>
  );
}

export default function ControllerPage() {
  const [mode, setMode] = useState<Mode>('trackpad');
  const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
  const [hostLabel, setHostLabel] = useState('Local host');
  const [laserEnabled, setLaserEnabled] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sensitivity, setSensitivity] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayLayout, setDisplayLayout] = useState<DisplayLayout | null>(null);
  const [displayTarget, setDisplayTarget] = useState<DisplayTarget>('auto');
  const [presentationProfile, setPresentationProfile] = useState<PresentationProfile>('powerpoint');
  const [laserSize, setLaserSize] = useState(85);
  const [laserDotSpacing, setLaserDotSpacing] = useState(9);
  const [laserMode, setLaserMode] = useState<LaserMode>('relative');
  const transport = useRef<ControllerTransport>();
  const activePointers = useRef(new Map<number, Point>());
  const pendingMove = useRef<Point>({ x: 0, y: 0 });
  const moveFrame = useRef<number | null>(null);
  const pendingScroll = useRef<Point>({ x: 0, y: 0 });
  const scrollFrame = useRef<number | null>(null);
  const laserLastPoint = useRef<Point | null>(null);
  const laserPosition = useRef<Point | null>(null);
  const laserFrame = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const send = (message: Parameters<ControllerTransport['send']>[0]) => {
    transport.current?.send(message);
  };

  const flushMove = () => {
    moveFrame.current = null;
    const deltaX = Math.round(pendingMove.current.x);
    const deltaY = Math.round(pendingMove.current.y);
    pendingMove.current = { x: pendingMove.current.x - deltaX, y: pendingMove.current.y - deltaY };
    if (deltaX || deltaY) send({ type: 'trackpad.move', payload: { deltaX, deltaY } });
  };

  const queueMove = (rawDx: number, rawDy: number) => {
    const deltaX = rawDx * sensitivity;
    const deltaY = rawDy * sensitivity;
    pendingMove.current.x += deltaX;
    pendingMove.current.y += deltaY;
    if (moveFrame.current === null) moveFrame.current = requestAnimationFrame(flushMove);
  };

  const flushScroll = () => {
    scrollFrame.current = null;
    const deltaX = Math.max(-1200, Math.min(1200, Math.round(pendingScroll.current.x)));
    const deltaY = Math.max(-1200, Math.min(1200, Math.round(pendingScroll.current.y)));
    pendingScroll.current = { x: 0, y: 0 };
    if (deltaX || deltaY) send({ type: 'trackpad.scroll', payload: { deltaX, deltaY } });
  };

  const queueScroll = (rawDx: number, rawDy: number) => {
    pendingScroll.current.x += rawDx;
    pendingScroll.current.y += rawDy;
    if (scrollFrame.current === null) scrollFrame.current = requestAnimationFrame(flushScroll);
  };

  const getTargetBounds = () => {
    if (!displayLayout || displayTarget === 'auto') return displayLayout?.virtualBounds || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return displayLayout.displays.find((display) => display.id === displayTarget)?.bounds || displayLayout.virtualBounds;
  };

  const flushLaser = () => {
    laserFrame.current = null;
    const bounds = getTargetBounds();
    const position = laserPosition.current || { x: bounds.width / 2, y: bounds.height / 2 };
    send({
      type: 'laser.position',
      payload: {
        x: Math.max(0, Math.min(1, position.x / bounds.width)),
        y: Math.max(0, Math.min(1, position.y / bounds.height)),
        displayId: displayTarget,
      },
    });
  };

  const queueLaser = (rawDx: number, rawDy: number) => {
    const bounds = getTargetBounds();
    const deltaX = rawDx * sensitivity;
    const deltaY = rawDy * sensitivity;
    const current = laserPosition.current || { x: bounds.width / 2, y: bounds.height / 2 };
    laserPosition.current = {
      x: Math.max(0, Math.min(bounds.width, current.x + deltaX)),
      y: Math.max(0, Math.min(bounds.height, current.y + deltaY)),
    };
    if (laserFrame.current === null) laserFrame.current = requestAnimationFrame(flushLaser);
  };

  useEffect(() => {
    const nextTransport = new ControllerTransport();
    transport.current = nextTransport;
    const unsubscribe = nextTransport.subscribe(setConnectionState);
    const unsubscribeDisplays = nextTransport.subscribeDisplays(setDisplayLayout);
    const params = new URLSearchParams(window.location.search);
    setHostLabel(params.get('host') || window.location.hostname || 'Local host');
    nextTransport.connect();
    const reconnect = () => {
      if (document.visibilityState === 'visible') nextTransport.reconnectNow();
    };
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);

    const cancelInput = () => {
      activePointers.current.clear();
      laserLastPoint.current = null;
      if (draggingRef.current) {
        send({ type: 'trackpad.button-up', payload: { button: 'left' } });
        draggingRef.current = false;
        setDragging(false);
      }
    };
    window.addEventListener('blur', cancelInput);
    return () => {
      window.removeEventListener('blur', cancelInput);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
      if (moveFrame.current !== null) cancelAnimationFrame(moveFrame.current);
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      if (laserFrame.current !== null) cancelAnimationFrame(laserFrame.current);
      unsubscribe();
      unsubscribeDisplays();
      nextTransport.disconnect();
    };
  }, []);

  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      if (connectionState !== 'Connected' || document.visibilityState !== 'visible') return;
      const wakeLockApi = (navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (!wakeLockApi) return;
      try {
        wakeLock = await wakeLockApi.request('screen');
      } catch (error) {
        console.warn(`Unable to acquire screen wake lock: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    const releaseWakeLock = () => {
      if (wakeLock) {
        void wakeLock.release();
        wakeLock = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
      else releaseWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    void requestWakeLock();
    if (connectionState !== 'Connected') releaseWakeLock();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseWakeLock();
    };
  }, [connectionState]);

  useEffect(() => {
    if (connectionState === 'Disconnected') {
      activePointers.current.clear();
      laserLastPoint.current = null;
      setLaserEnabled(false);
      setDragging(false);
    }
  }, [connectionState]);

  const handleTrackpadDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const handleTrackpadMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const previous = activePointers.current.get(event.pointerId);
    if (!previous) return;
    const rawDx = event.clientX - previous.x;
    const rawDy = event.clientY - previous.y;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.current.size === 1) queueMove(rawDx, rawDy);
    else queueScroll(rawDx, rawDy);
  };

  const handleTrackpadEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    activePointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleLaserDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (laserMode === 'absolute') {
      const rect = event.currentTarget.getBoundingClientRect();
      const bounds = getTargetBounds();
      laserPosition.current = {
        x: ((event.clientX - rect.left) / rect.width) * bounds.width,
        y: ((event.clientY - rect.top) / rect.height) * bounds.height,
      };
      flushLaser();
    }
    laserLastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handleLaserMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!laserLastPoint.current) return;
    if (laserMode === 'absolute') {
      const rect = event.currentTarget.getBoundingClientRect();
      const bounds = getTargetBounds();
      laserPosition.current = {
        x: ((event.clientX - rect.left) / rect.width) * bounds.width,
        y: ((event.clientY - rect.top) / rect.height) * bounds.height,
      };
      if (laserFrame.current === null) laserFrame.current = requestAnimationFrame(flushLaser);
    } else {
      queueLaser(event.clientX - laserLastPoint.current.x, event.clientY - laserLastPoint.current.y);
    }
    laserLastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handleLaserEnd = () => {
    laserLastPoint.current = null;
  };

  const displays: DisplayInfo[] = displayLayout?.displays || [];
  const statusClass = connectionState.toLowerCase().replaceAll(' ', '-');

  return (
    <main className="controller-shell">
      <header className="topbar">
        <button className="icon-button" type="button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><GearIcon /></button>
        <div className="connection-pill"><span className={`status-dot ${statusClass}`} />{connectionLabels[connectionState]}<span className="wifi-icon">⌁</span></div>
        <button className="icon-button mode-icon" type="button" aria-label="Switch mode" onClick={() => setMode(mode === 'trackpad' ? 'presentation' : 'trackpad')}><ModeIcon presentation={mode === 'trackpad'} /></button>
      </header>

      {mode === 'trackpad' ? (
        <>
          <section className="canvas-shell trackpad-shell">
            <GridCanvas className="dot-canvas" onPointerDown={handleTrackpadDown} onPointerMove={handleTrackpadMove} onPointerEnd={handleTrackpadEnd} />
            <span className="surface-hint">Touch to move · two fingers to scroll</span>
            <span className="scroll-rail">SCROLL</span>
          </section>
          <div className="trackpad-actions">
            <button className="track-button" onClick={() => send({ type: 'trackpad.click', payload: { button: 'left' } })} type="button">Left Click</button>
            <button className={`track-button drag-button ${dragging ? 'active' : ''}`} onClick={() => {
              const next = !dragging;
              setDragging(next);
              draggingRef.current = next;
              send({ type: next ? 'trackpad.button-down' : 'trackpad.button-up', payload: { button: 'left' } });
            }} type="button">{dragging ? 'Release Drag' : 'Drag Lock'}</button>
            <button className="track-button" onClick={() => send({ type: 'trackpad.click', payload: { button: 'right' } })} type="button">Right Click</button>
          </div>
        </>
      ) : (
        <section className="presentation-panel">
          <div className="canvas-shell laser-shell">
            <GridCanvas className="dot-canvas" onPointerDown={handleLaserDown} onPointerMove={handleLaserMove} onPointerEnd={handleLaserEnd} />
            <span className="surface-hint">Touch and glide to aim</span>
          </div>
          <div className="presenter-heading">Presenter Controls <ChevronIcon direction="down" /></div>
          <div className="presenter-dock">
            <button className="slide-round previous" onClick={() => send({ type: 'presentation.action', payload: { action: 'previous', profileId: presentationProfile } })} type="button" aria-label="Previous slide"><ChevronIcon direction="left" /></button>
            <div className="center-cluster">
              <button className={`cluster-button laser-button ${laserEnabled ? 'enabled' : ''}`} onClick={() => {
                const enabled = !laserEnabled;
                setLaserEnabled(enabled);
                send({ type: 'laser.toggle', payload: { enabled } });
              }} type="button" aria-label={laserEnabled ? 'Turn laser off' : 'Turn laser on'}><LaserIcon /></button>
              <div className="utility-cluster">
                <button className="cluster-button utility-button" onClick={() => send({ type: 'presentation.action', payload: { action: 'blank', profileId: presentationProfile } })} type="button" aria-label="Blank screen"><MoonIcon /></button>
                <button className="cluster-button utility-button" onClick={() => send({ type: 'presentation.action', payload: { action: 'start', profileId: presentationProfile } })} type="button" aria-label="Start slideshow"><PlayIcon /></button>
              </div>
            </div>
            <button className="slide-round next" onClick={() => send({ type: 'presentation.action', payload: { action: 'next', profileId: presentationProfile } })} type="button" aria-label="Next slide"><ChevronIcon direction="right" /></button>
          </div>
        </section>
      )}

      <aside className={`settings-drawer ${settingsOpen ? 'open' : ''}`}>
        <div className="drawer-heading"><strong>Controller settings</strong><button onClick={() => setSettingsOpen(false)} type="button">×</button></div>
        <div className="connection-details"><span>Host</span><strong>{hostLabel}</strong><span>Link</span><strong>{connectionLabels[connectionState]}</strong></div>
        <label>Pointer sensitivity <output>{sensitivity.toFixed(1)}×</output><input type="range" min="0.5" max="4" step="0.1" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /></label>
        <label>Presentation app
          <select value={presentationProfile} onChange={(event) => {
            const nextProfile = event.target.value as PresentationProfile;
            setPresentationProfile(nextProfile);
            send({ type: 'presentation.profile', payload: { profileId: nextProfile } });
          }}>
            <option value="powerpoint">PowerPoint</option>
            <option value="google-slides">Google Slides</option>
            <option value="pdf-viewer">PDF Viewer</option>
          </select>
        </label>
        <label>Laser size <output>{laserSize}px</output><input type="range" min="40" max="130" step="1" value={laserSize} onChange={(event) => {
          const nextSize = Number(event.target.value);
          setLaserSize(nextSize);
          send({ type: 'laser:config', payload: { enabled: laserEnabled, size: nextSize, dotSpacing: laserDotSpacing, popSpeed: 1.2, mode: laserMode } });
        }} /></label>
        <label>Laser dot spacing <output>{laserDotSpacing}px</output><input type="range" min="6" max="16" step="1" value={laserDotSpacing} onChange={(event) => {
          const nextSpacing = Number(event.target.value);
          setLaserDotSpacing(nextSpacing);
          send({ type: 'laser:config', payload: { enabled: laserEnabled, size: laserSize, dotSpacing: nextSpacing, popSpeed: 1.2, mode: laserMode } });
        }} /></label>
        <label>Laser mode
          <select value={laserMode} onChange={(event) => {
            const nextMode = event.target.value as LaserMode;
            setLaserMode(nextMode);
            send({ type: 'laser:config', payload: { enabled: laserEnabled, size: laserSize, dotSpacing: laserDotSpacing, popSpeed: 1.2, mode: nextMode } });
          }}>
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
          </select>
        </label>
        <label>Laser display
          <select value={displayTarget} onChange={(event) => {
            const value = event.target.value;
            const nextTarget: DisplayTarget = value === 'auto' ? 'auto' : Number(value);
            setDisplayTarget(nextTarget);
            laserPosition.current = null;
            send({ type: 'host:set-target-display', payload: { displayId: nextTarget } });
            send({
              type: 'laser.position',
              payload: { x: 0.5, y: 0.5, displayId: nextTarget },
            });
          }}>
            <option value="auto">All Displays (Follow Cursor)</option>
            {displays.map((display) => <option key={display.id} value={display.id}>{display.label}{display.isPrimary ? ' · Internal' : ' · External / Projector'}</option>)}
          </select>
        </label>
      </aside>
    </main>
  );
}
