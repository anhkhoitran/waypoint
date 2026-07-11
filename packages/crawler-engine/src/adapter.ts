import type { JobSource, RawJob } from '@waypoint/shared';

/** A lightweight reference to a job found during discovery, before full extraction. */
export interface DiscoveredJob {
  externalId: string;
  url: string;
  /** Some sources (APIs/RSS) return the full job at discovery time — adapters may attach it to skip extract(). */
  raw?: RawJob;
}

/**
 * A single browser page/tab, reduced to the operations adapters need.
 * Modeled after Playwright's Page so a real implementation is a thin
 * wrapper, but crawler-engine itself never imports Playwright.
 */
export interface PageLike {
  goto(url: string): Promise<void>;
  content(): Promise<string>;
  close(): Promise<void>;
}

/** Supplies browser pages for adapters that need JS-rendered content (e.g. ITviec). */
export interface BrowserContextProvider {
  newPage(): Promise<PageLike>;
}

/** Utilities the engine hands to every adapter — adapters never fetch on their own. */
export interface AdapterContext {
  /** Rate-limited, robots-aware fetch. Throws on non-2xx. */
  fetchText(url: string): Promise<string>;
  fetchJson<T = unknown>(url: string): Promise<T>;
  log(message: string): void;
  /** Present only when the host app supplies a browser (e.g. the API app via Playwright). */
  browser?: BrowserContextProvider;
}

/**
 * One adapter per job board. Implementations must be pure over the context:
 * all network access goes through ctx so politeness policies apply uniformly.
 */
export interface SourceAdapter {
  readonly source: JobSource;
  /** Human-readable name for the source health panel. */
  readonly displayName: string;
  /** Find current job listings (first N pages / RSS window). */
  discover(ctx: AdapterContext): Promise<DiscoveredJob[]>;
  /** Fetch + parse one job into a RawJob. Not called when discover() attached `raw`. */
  extract(ctx: AdapterContext, job: DiscoveredJob): Promise<RawJob>;
}
