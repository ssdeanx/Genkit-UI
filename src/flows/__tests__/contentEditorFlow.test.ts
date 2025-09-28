import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentEditorFlow } from '../contentEditorFlow.js';
import type { ContentEditorInput } from '../../schemas/contentEditorSchema.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as CallableFunction;
      // Allow passing through context for branch coverage
      return (input: unknown, ctx?: { context?: unknown }) => impl(input, { context: ctx?.context });
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('contentEditorFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps string output to { edited }', async () => {
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: 'ignored', output: 'Edited text' })) as unknown as ReturnType<typeof ai.prompt>);
    const res = await contentEditorFlow({ content: 't', tone: 'neutral' } as ContentEditorInput);
    expect(res).toEqual({ edited: 'Edited text' });
  });

  it('throws UserFacingError when output is null/undefined', async () => {
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: 'ignored', output: null })) as unknown as ReturnType<typeof ai.prompt>);
    await expect(contentEditorFlow({ content: 'x' } as ContentEditorInput)).rejects.toThrowError('Invalid model output for contentEditorFlow');
  });

  it('parses object output via schema', async () => {
    const output = { edited: 'All good' };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);
    const res = await contentEditorFlow({ content: 't' } as ContentEditorInput);
    expect(res.edited).toBe('All good');
  });

  it('throws UserFacingError on schema validation failure', async () => {
    const bad = { wrong: 'shape' } as unknown;
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(bad), output: bad })) as unknown as ReturnType<typeof ai.prompt>);
    await expect(contentEditorFlow({ content: 't' } as ContentEditorInput)).rejects.toThrowError('Schema validation failed for contentEditorFlow output');
  });

  it('passes provided context to prompt invocation', async () => {
    const inner = vi.fn(async (_input: unknown, opts?: { context?: unknown }) => ({ text: 'ok', output: 'CTX' }));
    // Return a function we can inspect
    vi.mocked(ai.prompt).mockReturnValue(inner as unknown as ReturnType<typeof ai.prompt>);

    const ctx = { conversationId: 'abc' };
    const res = await contentEditorFlow({ content: 'x' } as ContentEditorInput, { context: ctx } as unknown as Parameters<typeof contentEditorFlow>[1]);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith({ content: 'x' }, { context: ctx });
    expect(res).toEqual({ edited: 'CTX' });
  });
});
