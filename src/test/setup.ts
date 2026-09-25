import { AsyncLocalStorage } from 'node:async_hooks';

// next/server, Next çalışma zamanının kurduğu global AsyncLocalStorage'ı bekler; yoksa import anında hata verir.
const globals = globalThis as { AsyncLocalStorage?: typeof AsyncLocalStorage };
globals.AsyncLocalStorage ??= AsyncLocalStorage;
