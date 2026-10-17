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

export const messageSchema = z.discriminatedUnion('type', [
  trackpadMove,
  trackpadClick,
  trackpadScroll,
  laser,
]);

export type ProtocolMessage = z.infer<typeof messageSchema>;
export type TrackpadMove = z.infer<typeof trackpadMove>;
export type TrackpadClick = z.infer<typeof trackpadClick>;
export type TrackpadScroll = z.infer<typeof trackpadScroll>;
export type LaserCommand = z.infer<typeof laser>;

export function parseMessage(input: unknown): ProtocolMessage {
  return messageSchema.parse(input);
}
