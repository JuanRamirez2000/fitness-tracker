import { z } from "zod";
import type { LocalDate } from "@/lib/dates/calendar";

/**
 * The week's forecast for the outdoor ride: Open-Meteo (free, no key, no account). One request
 * per page load at most, cached for three hours by Next's fetch cache, and never more than a
 * rounded area (lib/workouts/store.ts, fetchTrainingArea) leaves the server. A failed or slow
 * forecast just means no weather: the planner works the same without it.
 */

export interface DayWeather {
  date: LocalDate;
  highF: number;
  lowF: number;
  rainChance: number;
  rainIn: number;
  windMph: number;
  /** Why it's a bad day to ride outside, or null when it's fine. */
  problem: string | null;
}

/** Past any of these, an outdoor ride moves inside to the Kickr. */
export const RAIN_CHANCE_MAX = 50;
export const RAIN_IN_MAX = 0.1;
export const WIND_MPH_MAX = 20;
export const HOT_F = 95;
export const COLD_F = 40;

const responseSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number().nullable()),
  }),
});

/** What's wrong with a day for riding outside, in a few words, or null. Pure. */
export function rideProblem(d: Omit<DayWeather, "problem" | "date">): string | null {
  if (d.rainChance >= RAIN_CHANCE_MAX) return `${d.rainChance}% chance of rain`;
  if (d.rainIn >= RAIN_IN_MAX) return `${d.rainIn} in of rain`;
  if (d.windMph >= WIND_MPH_MAX) return `wind to ${d.windMph} mph`;
  if (d.highF >= HOT_F) return `a high of ${d.highF}°F`;
  if (d.highF <= COLD_F) return `a high of only ${d.highF}°F`;
  return null;
}

export function parseForecast(json: unknown): DayWeather[] {
  const { daily } = responseSchema.parse(json);
  return daily.time.flatMap((date, i) => {
    const high = daily.temperature_2m_max[i];
    if (high === null) return [];
    const day = {
      highF: Math.round(high),
      lowF: Math.round(daily.temperature_2m_min[i] ?? high),
      rainChance: Math.round(daily.precipitation_probability_max[i] ?? 0),
      rainIn: Math.round((daily.precipitation_sum[i] ?? 0) * 100) / 100,
      windMph: Math.round(daily.wind_speed_10m_max[i] ?? 0),
    };
    return [{ date, ...day, problem: rideProblem(day) }];
  });
}

const TIMEOUT_MS = 3000;
const CACHE_S = 3 * 60 * 60;

export async function fetchForecast(area: { lat: number; lon: number } | null, timezone: string): Promise<DayWeather[]> {
  if (!area) return [];
  const params = new URLSearchParams({
    latitude: String(area.lat),
    longitude: String(area.lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone,
    forecast_days: "14",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_S },
    } as RequestInit);
    if (!res.ok) return [];
    return parseForecast(await res.json());
  } catch {
    return [];
  }
}
