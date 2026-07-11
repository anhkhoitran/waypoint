import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { BrowserContextProvider, PageLike } from '@waypoint/crawler-engine';
import { chromium, type Browser } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Real Playwright-backed implementation of BrowserContextProvider. Lives in
 * the API app (not crawler-engine) so the engine package stays
 * Playwright-free. One Chromium instance is shared and lazily launched;
 * each newPage() call gets its own page, closed by the caller.
 */
@Injectable()
export class PlaywrightBrowserProvider implements BrowserContextProvider, OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightBrowserProvider.name);
  private browserPromise?: Promise<Browser>;

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true });
    }
    return this.browserPromise;
  }

  async newPage(): Promise<PageLike> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({ userAgent: USER_AGENT });

    return {
      goto: async (url: string) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        // ITviec (and sites like it) render job content client-side after
        // domcontentloaded — wait for evidence of it, but don't fail the
        // whole call if it never shows up; let the adapter's own
        // zero-results/no-title checks surface that as a failed run.
        try {
          await page.waitForSelector('[data-search--job-selection-job-slug-value], h1', {
            timeout: 15_000,
          });
        } catch {
          this.logger.warn(`no job content detected within timeout for ${url}`);
        }
      },
      content: () => page.content(),
      close: () => page.close(),
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
    }
  }
}
