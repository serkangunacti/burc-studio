import { interpolate, spring } from 'remotion';

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function enter(frame: number, fps: number, delay: number, distance = 40): { opacity: number; transform: string } {
  const progress = frame < delay ? 0 : spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: progress, transform: `translateY(${Math.round((1 - progress) * distance)}px)` };
}

export function drawProgress(frame: number, start: number, end: number): number {
  return interpolate(frame, [start, end], [1, 0], CLAMP);
}
