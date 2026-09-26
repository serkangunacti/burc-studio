export function createStallWatchdog(timeoutMs: number, onStall: () => void): { progress: () => void; stop: () => void } {
  let timer = setTimeout(onStall, timeoutMs);
  return {
    progress() {
      clearTimeout(timer);
      timer = setTimeout(onStall, timeoutMs);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
