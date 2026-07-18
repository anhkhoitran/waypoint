import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOllamaUp, summarizeWithFallback } from '../ollama.js';

const SOURCE = 'We need a Frontend Engineer with 3+ years of React experience.';

function mockChatResponse(content: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ message: { content: JSON.stringify(content) } }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('summarizeWithFallback (mocked HTTP)', () => {
  it('maps a valid Ollama response through validation and tags it with the model name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          summary: 'A frontend role focused on React development.',
          responsibilities: ['Build UI components'],
          requirements: ['3+ years of React experience'],
          niceToHave: [],
          benefits: [],
          roleFunction: 'frontend',
          yearsExperienceMin: 3,
        }),
      ),
    );

    const result = await summarizeWithFallback(SOURCE, 'Frontend Engineer');

    expect(result).not.toBeNull();
    expect(result!.roleFunction).toBe('frontend');
    expect(result!.yearsExperienceMin).toBe(3);
    expect(result!.model).toMatch(/gemma4|qwen/); // whatever OLLAMA_SUMMARY_MODEL resolves to
  });

  it('returns null when the response fails anti-hallucination validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          summary: '', // empty summary fails validation
          responsibilities: [],
          requirements: [],
          niceToHave: [],
          benefits: [],
          roleFunction: 'frontend',
          yearsExperienceMin: null,
        }),
      ),
    );

    const result = await summarizeWithFallback(SOURCE, 'Frontend Engineer');
    expect(result).toBeNull();
  });

  it('returns null on a non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockChatResponse({}, false)));
    const result = await summarizeWithFallback(SOURCE, 'Frontend Engineer');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (Ollama unreachable)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const result = await summarizeWithFallback(SOURCE, 'Frontend Engineer');
    expect(result).toBeNull();
  });

  it('returns null on unparseable JSON content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { content: 'not valid json {{{' } }),
      } as unknown as Response),
    );
    const result = await summarizeWithFallback(SOURCE, 'Frontend Engineer');
    expect(result).toBeNull();
  });
});

describe('isOllamaUp', () => {
  it('returns true when the health endpoint responds OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    expect(await isOllamaUp()).toBe(true);
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await isOllamaUp()).toBe(false);
  });
});
