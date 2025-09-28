import { describe, it, expect, vi, beforeEach } from 'vitest';
import { indexDocumentsFlow } from '../indexDocumentsFlow.js';
import { ai } from '../../config.js';

vi.mock('fs/promises', () => ({ readFile: vi.fn(async () => Buffer.from('pdf-bytes')) }));
vi.mock('pdf-parse', () => ({ default: vi.fn(async () => ({ text: 'PDF extracted text' })) }));

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
    run: vi.fn().mockImplementation((_name: string, fn: () => unknown) => fn()),
    index: vi.fn(async () => undefined),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'test-index' };
});

describe('indexDocumentsFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('indexes provided text and returns success', async () => {
    const res = await indexDocumentsFlow({ text: 'Some text to index', sourceId: 's1' });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBeGreaterThanOrEqual(0);
  });

  it('returns error when no text is provided and no filePath', async () => {
    const res = await indexDocumentsFlow({});
    expect(res.success).toBe(false);
    expect(res.error).toBe('No text to index');
  });

  it('reads PDF when filePath provided and indexes', async () => {
    const res = await indexDocumentsFlow({ filePath: 'dummy.pdf', metadata: { a: 1 } });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBeGreaterThanOrEqual(0);
  });

  it('handles chunk result undefined (toStringArray returns empty)', async () => {
    vi.mocked(ai.run).mockImplementationOnce((..._args: unknown[]) => Promise.resolve(undefined) as unknown as ReturnType<typeof ai.run>);
    const res = await indexDocumentsFlow({ text: 'short' });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBe(0);
  });

  it('handles chunk result as non-array string (toStringArray wraps it)', async () => {
    vi.mocked(ai.run).mockImplementationOnce((..._args: unknown[]) => Promise.resolve('single-chunk') as unknown as ReturnType<typeof ai.run>);
    const res = await indexDocumentsFlow({ text: 'short' });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBe(1);
  });

  it('catches errors and returns error message', async () => {
    vi.mocked(ai.index).mockRejectedValueOnce(new Error('index failed'));
    const res = await indexDocumentsFlow({ text: 'Some data' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('index failed');
  });

  it('catches non-Error rejections and stringifies them', async () => {
    vi.mocked(ai.index).mockRejectedValueOnce('fail-string' as unknown as Error);
    const res = await indexDocumentsFlow({ text: 'More data' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('fail-string');
  });

  it('filters non-string chunks when array provided', async () => {
    vi.mocked(ai.run).mockImplementationOnce((..._args: unknown[]) => Promise.resolve(['a', 1, null, 'b']) as unknown as ReturnType<typeof ai.run>);
    const res = await indexDocumentsFlow({ text: 'data' });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBe(2);
  });

  it('handles chunk result null (toStringArray returns empty)', async () => {
    vi.mocked(ai.run).mockImplementationOnce((..._args: unknown[]) => Promise.resolve(null) as unknown as ReturnType<typeof ai.run>);
    const res = await indexDocumentsFlow({ text: 'short' });
    expect(res.success).toBe(true);
    expect(res.documentsIndexed).toBe(0);
  });

  it('reads PDF with non-string text coerced to empty and returns error when no text', async () => {
    const pdfParse = await import('pdf-parse');
    (pdfParse.default as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ text: 123 } as unknown as Awaited<typeof pdfParse.default>);
    const res = await indexDocumentsFlow({ filePath: 'dummy.pdf' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('No text to index');
  });
});
