import { ai } from '../config.js';
import { z } from 'genkit';

const weatherInputSchema = z.object({
  location: z.string().min(1).describe('City name or location'),
  unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit (default celsius)'),
});

const weatherOutputSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  windGust: z.number(),
  conditions: z.string(),
  location: z.string(),
  unit: z.string(), // "°C" or "°F"
});

interface GeocodingResponse {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
  }>;
}

interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = ai.defineTool(
  {
    name: 'weatherTool',
    description: 'Get current weather for a location using OpenMeteo (no API key required).',
    inputSchema: weatherInputSchema,
    outputSchema: weatherOutputSchema,
  },
  async ({ location, unit }) => {
    const useUnit: 'celsius' | 'fahrenheit' = unit ?? 'celsius';
    const data = await getWeather(location, useUnit);
    return { ...data, unit: useUnit === 'celsius' ? '°C' : '°F' };
  }
);

async function getWeather(location: string, unit: 'celsius' | 'fahrenheit') {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  if (!geocodingResponse.ok) {
    throw new Error(`Geocoding failed: ${geocodingResponse.status} ${geocodingResponse.statusText}`);
  }
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;
  if (!geocodingData.results || geocodingData.results.length === 0) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0]!;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code&temperature_unit=${unit}`;
  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as WeatherResponse;
  const { current } = data;
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    windGust: current.wind_gusts_10m,
    conditions: getWeatherCondition(current.weather_code),
    location: name,
  };
}

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return conditions[code] ?? 'Unknown';
}
