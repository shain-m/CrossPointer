import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, parseMessage } from '../src/index.js';

describe('protocol messages', () => {
  it('accepts a bounded trackpad movement', () => {
    expect(parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 1,
      type: 'trackpad.move',
      payload: { deltaX: 12, deltaY: -4 },
    })).toMatchObject({ type: 'trackpad.move' });
  });

  it('rejects an out-of-range laser position', () => {
    expect(() => parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 2,
      type: 'laser',
      payload: { command: 'position', x: 1.2, y: 0.4 },
    })).toThrow();
  });

  it('rejects unknown message types', () => {
    expect(() => parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 3,
      type: 'shell.execute',
      payload: {},
    })).toThrow();
  });

  it('accepts the command messages used by the local controller', () => {
    expect(parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 4,
      type: 'trackpad.button-down',
      payload: { button: 'left' },
    })).toMatchObject({ type: 'trackpad.button-down' });
    expect(parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 5,
      type: 'presentation.action',
      payload: { action: 'next' },
    })).toMatchObject({ type: 'presentation.action' });
    expect(parseMessage({
      version: PROTOCOL_VERSION,
      sequence: 6,
      type: 'laser.position',
      payload: { x: 0.5, y: 0.25 },
    })).toMatchObject({ type: 'laser.position' });
  });
});
