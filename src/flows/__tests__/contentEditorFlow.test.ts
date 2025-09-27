import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentEditorFlow } from '../contentEditorFlow.js';
import type { ContentEditorInput } from '../../schemas/contentEditorSchema.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as CallableFunction;
      return (input: unknown) => impl(input, { context: undefined });
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
});
