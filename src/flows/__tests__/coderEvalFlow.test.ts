import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coderEvalFlow } from '../coderEvalFlow.js';
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

describe('coderEvalFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts filenames from coder output', async () => {
    const output = { files: [{ filename: 'src/index.ts' }, { filename: 'README.md' }] };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const res = await coderEvalFlow({ specification: 'do x' });
    expect(res.filenames).toEqual(['src/index.ts', 'README.md']);
  });
});
