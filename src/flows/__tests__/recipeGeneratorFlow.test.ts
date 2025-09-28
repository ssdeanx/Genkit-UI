import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recipeGeneratorFlow } from '../recipeGeneratorFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
    generate: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('recipeGeneratorFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns generated recipe structure', async () => {
    const output = {
      title: 'Pasta', description: 'Tasty', prepTime: '10m', cookTime: '20m', servings: 2,
      ingredients: ['a'], instructions: ['b'], tips: ['c']
    };
  vi.mocked(ai.generate).mockResolvedValue({ output } as unknown as Awaited<ReturnType<typeof ai.generate>>);

    const res = await recipeGeneratorFlow({ ingredient: 'pasta' } as { ingredient: string });
    expect(res.title).toBe('Pasta');
    expect(res.ingredients.length).toBe(1);
  });

  it('throws when output is missing', async () => {
    vi.mocked(ai.generate).mockResolvedValue({ output: undefined } as unknown as Awaited<ReturnType<typeof ai.generate>>);
    await expect(recipeGeneratorFlow({ ingredient: 'rice' } as { ingredient: string })).rejects.toThrowError('Failed to generate recipe');
  });
});
