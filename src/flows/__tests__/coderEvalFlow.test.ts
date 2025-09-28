import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coderEvalFlow } from '../coderEvalFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('coderEvalFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts filenames from output.files', async () => {
    const output = { files: [{ filename: 'a.ts' }, { filename: 'b.ts' }] };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);
    const res = await coderEvalFlow({ specification: 'spec' });
    expect(res.filenames).toEqual(['a.ts', 'b.ts']);
  });

  it('returns empty filenames when files invalid', async () => {
    const output = { files: 'nope' } as unknown;
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);
    const res = await coderEvalFlow({ specification: 'spec' });
    expect(res.filenames).toEqual([]);
  });
});
