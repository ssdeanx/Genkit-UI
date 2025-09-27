import { ai } from '../config.js';
import { z } from 'genkit';
import { weatherTool } from '../tools/weatherTool.js';

export const weatherFlow = ai.defineFlow(
  {
    name: 'weatherFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (location) => {
    const weather = await weatherTool({ location });
    if (typeof weather === 'string') {
      return `I looked up the weather in ${location} for you. Here it is: ${weather}`;
    }
    const parts = [
      `${weather.location}: ${weather.temperature}${weather.unit}`,
      `(feels like ${weather.feelsLike}${weather.unit})`,
      `humidity ${weather.humidity}%`,
      `wind ${weather.windSpeed} m/s` + (weather.windGust > 0 ? ` (gusts ${weather.windGust} m/s)` : ''),
      weather.conditions,
    ];
    return `I looked up the weather in ${location}. ${parts.join(', ')}`;
  }
);
