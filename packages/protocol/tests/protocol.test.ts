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
});
