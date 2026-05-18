export type WeatherDay = {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  precipitation: number;
  label: string;
  icon: string;
  workable: boolean;
};

export const WMO_CODES: Record<number, { label: string; icon: string; workable: boolean }> = {
  0: { label: "Clear sky", icon: "☀️", workable: true },
  1: { label: "Mainly clear", icon: "🌤", workable: true },
  2: { label: "Partly cloudy", icon: "⛅", workable: true },
  3: { label: "Overcast", icon: "☁️", workable: true },
  45: { label: "Fog", icon: "🌫", workable: false },
  51: { label: "Light drizzle", icon: "🌦", workable: false },
  53: { label: "Drizzle", icon: "🌧", workable: false },
  61: { label: "Light rain", icon: "🌧", workable: false },
  63: { label: "Moderate rain", icon: "🌧", workable: false },
  65: { label: "Heavy rain", icon: "⛈", workable: false },
  71: { label: "Light snow", icon: "🌨", workable: false },
  80: { label: "Rain showers", icon: "🌦", workable: false },
  95: { label: "Thunderstorm", icon: "⛈", workable: false }
};

export async function fetchWeatherForecast(location: string): Promise<WeatherDay[]> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
  if (!geoRes.ok) throw new Error("Weather location lookup failed.");
  const geoData = await geoRes.json();
  if (!geoData.results?.[0]) throw new Error(`Location not found: ${location}`);

  const { latitude, longitude } = geoData.results[0];
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=Europe%2FLondon&forecast_days=7`
  );
  if (!weatherRes.ok) throw new Error("Weather forecast failed.");
  const weatherData = await weatherRes.json();

  return weatherData.daily.time.map((date: string, index: number) => {
    const weatherCode = weatherData.daily.weathercode[index] as number;
    const cfg = WMO_CODES[weatherCode] ?? { label: "Unknown", icon: "?", workable: true };
    const precipitation = Number(weatherData.daily.precipitation_sum[index] ?? 0);
    return {
      date,
      maxTemp: Number(weatherData.daily.temperature_2m_max[index] ?? 0),
      minTemp: Number(weatherData.daily.temperature_2m_min[index] ?? 0),
      weatherCode,
      precipitation,
      ...cfg,
      workable: cfg.workable && precipitation < 1
    };
  });
}
