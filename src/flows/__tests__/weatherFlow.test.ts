import { describe, it, expect, vi } from 'vitest';
import { weatherFlow } from '../weatherFlow.js';
import { weatherTool } from '../../tools/weatherTool.js';

vi.mock('../../tools/weatherTool.js', () => ({
  weatherTool: vi.fn(),
}));

describe('weatherFlow', () => {
  it('should return a human-readable weather report', async () => {
    const location = 'London';
    const mockWeather = {
      temperature: 72,
      feelsLike: 72,
      humidity: 10,
      windSpeed: 1,
      windGust: 0,
      conditions: 'Sunny',
      location: 'London',
      unit: '°F',
    };
    vi.mocked(weatherTool).mockResolvedValue(mockWeather as unknown as Awaited<ReturnType<typeof weatherTool>>);

    const result = await weatherFlow(location);

    expect(result).toBe('I looked up the weather in London. London: 72°F, (feels like 72°F), humidity 10%, wind 1 m/s, Sunny');
  });
});
