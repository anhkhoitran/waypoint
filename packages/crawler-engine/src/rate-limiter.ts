/**
 * Per-domain politeness: at most one request per `minIntervalMs` per hostname,
 * with a global concurrency cap. Deliberately simple — this is a personal tool,
 * not a distributed crawler.
 */
export class RateLimiter {
  private lastRequestAt = new Map<string, number>();
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(
    private readonly minIntervalMs = 2000,
    private readonly maxConcurrent = 2,
  ) {}

  async acquire(url: string): Promise<void> {
    const host = new URL(url).hostname;
    await this.acquireSlot();
    const last = this.lastRequestAt.get(host) ?? 0;
    const waitMs = Math.max(0, last + this.minIntervalMs - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestAt.set(host, Date.now());
  }

  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  private acquireSlot(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }
}
