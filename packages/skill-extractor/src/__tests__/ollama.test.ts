import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWithFallback, isOllamaUp } from '../ollama.js';

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

describe('extractWithFallback (mocked HTTP)', () => {
  it('maps a valid Ollama response to skills + seniority + salaryText', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          skills: [
            { name: 'react', confidence: 0.95 },
            { name: 'postgresql', confidence: 0.8 },
          ],
          seniority: 'senior',
          salaryText: '$60k – $85k',
        }),
      ),
    );

    const result = await extractWithFallback('some job description', 'Senior Engineer');

    expect(result.extractor).toBe('ollama');
    expect(result.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: 'react', confidence: 0.95 }),
        expect.objectContaining({ skill: 'postgresql', confidence: 0.8 }),
      ]),
    );
    expect(result.seniority).toBe('senior');
    expect(result.salaryText).toBe('$60k – $85k');
  });

  it('normalizes aliased skill names returned by the model to their canonical form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          skills: [{ name: 'K8s', confidence: 0.9 }],
          seniority: null,
          salaryText: null,
        }),
      ),
    );

    const result = await extractWithFallback('some text', '');
    expect(result.skills).toEqual([expect.objectContaining({ skill: 'kubernetes' })]);
  });

  it('dedupes repeated/aliased mentions of the same skill, keeping the highest confidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          skills: [
            { name: 'aws', confidence: 0.6 },
            { name: 'aws', confidence: 0.95 },
          ],
          seniority: null,
          salaryText: null,
        }),
      ),
    );

    const result = await extractWithFallback('some text', '');
    expect(result.skills).toEqual([expect.objectContaining({ skill: 'aws', confidence: 0.95 })]);
  });

  it('drops skill names the model invents that are not in the taxonomy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({
          skills: [
            { name: 'react', confidence: 0.9 },
            { name: 'quantum-computing-ninja', confidence: 0.9 },
          ],
          seniority: null,
          salaryText: null,
        }),
      ),
    );

    const result = await extractWithFallback('some text', '');
    expect(result.skills).toEqual([expect.objectContaining({ skill: 'react' })]);
  });

  it('backfills seniority/salary from rules when Ollama omits them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockChatResponse({ skills: [], seniority: null, salaryText: null }),
      ),
    );

    const result = await extractWithFallback('Pay is $1,800/month', 'Senior Engineer');
    expect(result.extractor).toBe('ollama');
    expect(result.seniority).toBe('senior');
    expect(result.salaryText).toBe('$1,800/month');
  });

  it('falls back to rules when the HTTP call fails (connection error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await extractWithFallback('experience with React and Node', 'Senior Engineer');
    expect(result.extractor).toBe('rules');
    expect(result.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: 'react' }),
        expect.objectContaining({ skill: 'node' }),
      ]),
    );
    expect(result.seniority).toBe('senior');
  });

  it('falls back to rules when the request times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }),
    );

    const resultPromise = extractWithFallback('experience with React', '');
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await resultPromise;

    expect(result.extractor).toBe('rules');
    vi.useRealTimers();
  });

  it('falls back to rules when the model returns unparseable JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { content: 'this is not valid json {' } }),
      } as unknown as Response),
    );

    const result = await extractWithFallback('experience with React', '');
    expect(result.extractor).toBe('rules');
  });

  it('falls back to rules when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockChatResponse({}, false)));

    const result = await extractWithFallback('experience with React', '');
    expect(result.extractor).toBe('rules');
  });
});

describe('isOllamaUp', () => {
  it('returns true when the health endpoint responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
    expect(await isOllamaUp()).toBe(true);
  });

  it('returns false when the health endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await isOllamaUp()).toBe(false);
  });

  it('returns false when the health endpoint responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    expect(await isOllamaUp()).toBe(false);
  });
});
