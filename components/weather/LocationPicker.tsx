"use client";

import { useState } from "react";

const AREA_LOCATIONS = [
  "Yateley",
  "Fleet",
  "Farnborough",
  "Camberley",
  "Farnham",
  "Aldershot",
  "Hook",
  "Basingstoke",
  "Guildford",
  "Woking",
  "Ascot",
  "Sandhurst",
  "Windsor",
  "Reading",
  "Bracknell",
  "Newbury",
  "Wokingham",
  "Crowthorne",
  "Bagshot",
  "Virginia Water"
];

export function LocationPicker({ current, onSelect, onClose }: { current: string; onSelect: (location: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = AREA_LOCATIONS.filter((location) => location.toLowerCase().includes(search.toLowerCase()));
  const customLocation = search.trim();

  function choose(location: string) {
    onSelect(location);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Weather Location</p>
            <h2 className="mt-2 font-display text-3xl text-white">Choose forecast area</h2>
          </div>
          <button className="button-ghost !px-3 !py-2" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <input className="field mt-4" onChange={(event) => setSearch(event.target.value)} placeholder="Search town or enter postcode..." value={search} />
        <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto">
          {customLocation && !filtered.some((item) => item.toLowerCase() === customLocation.toLowerCase()) ? (
            <button className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-3 text-left text-sm text-[var(--gold-l)]" onClick={() => choose(customLocation)} type="button">
              Use "{customLocation}"
            </button>
          ) : null}
          {filtered.map((location) => (
            <button
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3 text-left text-sm text-[var(--text)] transition hover:border-[var(--gold)]/50"
              key={location}
              onClick={() => choose(location)}
              type="button"
            >
              {location}
              {current === location ? <span className="text-[var(--gold)]">Selected</span> : null}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">Powered by Open-Meteo. Forecasts are cached by the browser and refreshed when the location changes.</p>
      </div>
    </div>
  );
}
