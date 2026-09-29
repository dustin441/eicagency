import type { Browser } from 'puppeteer-core';

export const RENDER_TIMEOUT_MS = 45_000;
export class RenderTimeoutError extends Error {
 constructor() { super('Creative render exceeded its overall deadline.'); this.name = 'RenderTimeoutError'; }
}

// One deadline includes extraction, launch, rendering AND graceful shutdown.
// Every awaited stage checks cancellation before starting, so late extraction cannot launch Chrome.
export class RenderDeadline {
 readonly controller = new AbortController();
 readonly signal = this.controller.signal;
 private browser?: Browser;
 private timer!: ReturnType<typeof setTimeout>;
 private expired: Promise<never>;
 constructor(timeoutMs = RENDER_TIMEOUT_MS) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > RENDER_TIMEOUT_MS) throw new Error('Invalid render deadline');
  this.expired = new Promise((_, reject) => {
   this.timer = setTimeout(() => {
    const error = new RenderTimeoutError();
    this.controller.abort(error);
    this.terminate();
    reject(error);
   }, timeoutMs);
  });
  // An expiry between stages must never become an unhandled rejection.
  void this.expired.catch(() => {});
 }
 attach(browser: Browser) {
  this.browser = browser;
  if (this.signal.aborted) { this.terminate(); this.signal.throwIfAborted(); }
 }
 async run<T>(operation: () => Promise<T>): Promise<T> {
  this.signal.throwIfAborted();
  return Promise.race([operation(), this.expired]);
 }
 private terminate() {
  // Local launches have an owned child process. Do not leave hung CDP work running.
  try { this.browser?.process()?.kill('SIGKILL'); } catch { /* already exited */ }
  void this.browser?.disconnect().catch(() => {});
 }
 async close() {
  try {
   if (this.browser) await this.run(() => this.browser!.close());
  } catch (error) {
   this.terminate();
   throw error;
  } finally { clearTimeout(this.timer); }
 }
}
