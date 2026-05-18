"use client";

import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/weather/LocationPicker";
import type { WeatherDay } from "@/lib/weather/openMeteo";

export function WeatherStrip({ location = "Yateley" }: { location?: string | null }) {
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [currentLoc, setCurrentLoc] = useState(location || "Yateley");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("war_weather_location");
    if (saved) setCurrentLoc(saved);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/weather?location=${encodeURIComponent(currentLoc)}`)
      .then((response) => response.json())
      .then((result) => {
        if (active && result?.ok) setForecast(result.forecast ?? []);
      })
      .catch(() => {
        if (active) setForecast([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentLoc]);

  function handleLocationChange(nextLocation: string) {
    setCurrentLoc(nextLocation);
    localStorage.setItem("war_weather_location", nextLocation);
    void fetch("/api/business/weather-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: nextLocation })
    });
  }

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto">
        {[0, 1, 2, 3, 4].map((item) => (
          <div className="h-24 min-w-20 animate-pulse rounded-xl border border-[var(--border)] bg-black/20" key={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto">
      {forecast.slice(0, 7).map((day, index) => (
        <div
          className="rounded-xl border text-center"
          key={day.date}
          style={{
            minWidth: index === 0 ? 88 : 72,
            padding: index === 0 ? "10px 12px" : "8px 10px",
            background: index === 0 ? "var(--elevated)" : "var(--surface)",
            borderColor: !day.workable ? "rgba(239,68,68,0.35)" : index === 0 ? "var(--gold-border)" : "var(--border)"
          }}
        >
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em]" style={{ color: index === 0 ? "var(--gold)" : "var(--text-faint)" }}>
            {index === 0 ? "Today" : formatWeekday(day.date)}
          </p>
          <p className="mt-1 text-xl leading-none">{day.icon}</p>
          <p className="mt-1 text-xs">
            <span className="font-semibold text-white">{Math.round(day.maxTemp)}°</span>
            <span className="ml-1 text-[var(--text-faint)]">{Math.round(day.minTemp)}°</span>
          </p>
          {!day.workable ? <p className="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-[#ef4444]">No work</p> : null}
        </div>
      ))}
      <button className="min-w-24 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]" onClick={() => setShowPicker(true)} type="button">
        Location<br />
        <span className="text-[var(--gold-l)]">{currentLoc}</span>
      </button>
      {showPicker ? <LocationPicker current={currentLoc} onClose={() => setShowPicker(false)} onSelect={handleLocationChange} /> : null}
    </div>
  );
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(date));
}
