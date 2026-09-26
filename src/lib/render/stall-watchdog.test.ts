import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStallWatchdog } from './stall-watchdog';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createStallWatchdog', () => {
  it('ilerleme durursa süre sonunda bir kez uyarır', () => {
    const onStall = vi.fn();
    createStallWatchdog(60_000, onStall);
    vi.advanceTimersByTime(59_999);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('her ilerleme süreyi baştan başlatır; durdurulunca uyarmaz', () => {
    const onStall = vi.fn();
    const watchdog = createStallWatchdog(60_000, onStall);
    vi.advanceTimersByTime(50_000);
    watchdog.progress();
    vi.advanceTimersByTime(50_000);
    expect(onStall).not.toHaveBeenCalled();
    watchdog.stop();
    vi.advanceTimersByTime(120_000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
