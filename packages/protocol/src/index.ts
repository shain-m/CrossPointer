import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

const envelope = z.object({
  version: z.literal(PROTOCOL_VERSION),
  sequence: z.number().int().nonnegative(),
});

const trackpadMove = envelope.extend({
  type: z.literal('trackpad.move'),
  payload: z.object({
    deltaX: z.number().int().min(-32767).max(32767),
    deltaY: z.number().int().min(-32767).max(32767),
  }),
});

const trackpadClick = envelope.extend({
  type: z.literal('trackpad.click'),
  payload: z.object({
    button: z.enum(['left', 'right', 'middle']),
  }),
});

const trackpadButton = envelope.extend({
  type: z.enum(['trackpad.button-down', 'trackpad.button-up']),
  payload: z.object({
    button: z.enum(['left', 'right', 'middle']),
  }),
});

const trackpadScroll = envelope.extend({
  type: z.literal('trackpad.scroll'),
  payload: z.object({
    deltaX: z.number().int().min(-1200).max(1200),
    deltaY: z.number().int().min(-1200).max(1200),
  }),
});

const laser = envelope.extend({
  type: z.literal('laser'),
  payload: z.discriminatedUnion('command', [
    z.object({ command: z.literal('enable'), enabled: z.boolean() }),
    z.object({
      command: z.literal('position'),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }),
    z.object({
      command: z.literal('settings'),
      size: z.number().min(40).max(130),
      dotSpacing: z.number().min(6).max(16),
      popSpeed: z.number().min(0).max(3),
    }),
  ]),
});

const presentationAction = envelope.extend({
  type: z.literal('presentation.action'),
  payload: z.object({
    action: z.enum(['next', 'previous', 'start', 'exit', 'blank']),
  }),
});

const laserToggle = envelope.extend({
  type: z.literal('laser.toggle'),
  payload: z.object({ enabled: z.boolean() }),
});

const laserPosition = envelope.extend({
  type: z.literal('laser.position'),
  payload: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    displayId: z.union([z.number().int().positive(), z.literal('auto')]).optional(),
  }),
});

const targetDisplay = envelope.extend({
  type: z.literal('host:set-target-display'),
  payload: z.object({
    displayId: z.union([z.number().int().positive(), z.literal('auto')]),
  }),
});

const laserConfig = envelope.extend({
  type: z.literal('laser.config'),
  payload: z.object({
    enabled: z.boolean(),
    size: z.number().min(40).max(130),
    dotSpacing: z.number().min(6).max(16),
    popSpeed: z.number().min(0).max(3),
  }),
});

export const messageSchema = z.discriminatedUnion('type', [
  trackpadMove,
  trackpadClick,
  trackpadButton,
  trackpadScroll,
  presentationAction,
  laserToggle,
  laserPosition,
  targetDisplay,
  laserConfig,
  laser,
]);

export type ProtocolMessage = z.infer<typeof messageSchema>;
export type TrackpadMove = z.infer<typeof trackpadMove>;
export type TrackpadClick = z.infer<typeof trackpadClick>;
export type TrackpadScroll = z.infer<typeof trackpadScroll>;
export type PresentationAction = z.infer<typeof presentationAction>;
export type LaserCommand = z.infer<typeof laser>;

export function parseMessage(input: unknown): ProtocolMessage {
  return messageSchema.parse(input);
}
