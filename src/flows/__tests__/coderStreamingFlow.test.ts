import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coderStreamingFlow } from '../coderStreamingFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      // Flow runner sends sendChunk in ctx
      return (input: unknown, ctx?: { sendChunk?: (s: string) => void }) => impl(input, { sendChunk: ctx?.sendChunk ?? (() => {}) });
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('coderStreamingFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('streams chunks and extracts filenames', async () => {
    const chunks = ['part1', { text: 'part2' }, 123];
    const filesOutput = { files: [{ filename: 'x.ts' }] };

    const fakeStream = (async function* () { for (const c of chunks) { yield c as never; } })();
    const fakeResponse = Promise.resolve({ output: filesOutput });

    const fakePrompt = { stream: vi.fn().mockResolvedValue({ stream: fakeStream, response: fakeResponse }) };
    vi.mocked(ai.prompt).mockReturnValue(fakePrompt as unknown as ReturnType<typeof ai.prompt>);

    const received: string[] = [];
    const res = await coderStreamingFlow({ specification: 's' }, { sendChunk: (s: string) => received.push(s) } as unknown as Parameters<typeof coderStreamingFlow>[1]);

    expect(received).toEqual(['part1', 'part2', '123']);
    expect(res.filenames).toEqual(['x.ts']);
  });

  it('handles object chunk without text and invalid files schema', async () => {
    const chunks = [{ notText: true }];
    const filesOutput = { files: [{ nofilename: 'oops' }] } as unknown;

    const fakeStream = (async function* () { for (const c of chunks) { yield c as never; } })();
    const fakeResponse = Promise.resolve({ output: filesOutput });

    const fakePrompt = { stream: vi.fn().mockResolvedValue({ stream: fakeStream, response: fakeResponse }) };
    vi.mocked(ai.prompt).mockReturnValue(fakePrompt as unknown as ReturnType<typeof ai.prompt>);

    const received: string[] = [];
    const res = await coderStreamingFlow({ specification: 's' }, { sendChunk: (s: string) => received.push(s) } as unknown as Parameters<typeof coderStreamingFlow>[1]);

    // object without text property becomes stringified
    expect(received).toEqual(['[object Object]']);
    // invalid files schema defaults to []
    expect(res.filenames).toEqual([]);
  });
});
