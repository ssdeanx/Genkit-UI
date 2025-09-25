import { describe, it, expect, vi } from 'vitest';
import { weatherFlow } from './weatherFlow.js';
import { weatherTool } from '../tools/weatherTool.js';

vi.mock('../tools/weatherTool.js', () => ({
  weatherTool: vi.fn(),
}));

describe('weatherFlow', () => {
  it('should return a human-readable weather report', async () => {
    const location = 'London';
    const weatherReport = 'The weather in London is 72 degrees and sunny.';
    vi.mocked(weatherTool).mockResolvedValue(weatherReport);

    const result = await weatherFlow(location);

    expect(result).toBe(`I looked up the weather in London for you. Here it is: ${weatherReport}`);
  });
});
