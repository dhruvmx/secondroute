"use client";
import { useState } from "react";
import type { State, Event } from "@/lib/types";
export default function VenueMap({
  zones,
  onZone,
  selectedZone,
  event,
}: {
  zones: State["zones"];
  batches: State["batches"];
  captures?: State["captures"];
  onZone: (id: string) => void;
  selectedZone: string;
  event?: Event;
}) {
  const [enabled, setEnabled] = useState(false);
  const zone = zones.find((z) => z.id === selectedZone);
  const sample = event?.id === "riverlight" || event?.id === "design-week";
  const lat = zone?.latitude ?? event?.latitude ?? (sample ? 12.9716 : null),
    lon = zone?.longitude ?? event?.longitude ?? (sample ? 77.5946 : null);
  const bbox =
    lat != null && lon != null
      ? [lon - 0.012, lat - 0.007, lon + 0.012, lat + 0.007].join(",")
      : "";
  return (
    <div className="geographic-map">
      <div className="map-toolbar">
        <strong>OpenStreetMap</strong>
        <span>
          {sample
            ? "Sample locations in Bengaluru"
            : event?.location || "Event map"}
        </span>
      </div>
      {lat == null || lon == null ? (
        <div className="map-placeholder">
          <strong>Add an event location</strong>
          <p>
            Enter latitude and longitude when creating an event or zone to place
            it on the map.
          </p>
        </div>
      ) : !enabled ? (
        <div className="map-placeholder">
          <strong>Explore this location</strong>
          <p>
            Load the interactive street map from OpenStreetMap. Your browser
            connects to the map provider.
          </p>
          <button className="primary" onClick={() => setEnabled(true)}>
            Load interactive map
          </button>
        </div>
      ) : (
        <iframe
          key={bbox}
          title="Interactive event map from OpenStreetMap"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <div className="map-zone-list" aria-label="Map zones">
        <button aria-pressed={!selectedZone} onClick={() => onZone("")}>
          All zones
        </button>
        {zones.map((z) => (
          <button
            key={z.id}
            aria-pressed={selectedZone === z.id}
            onClick={() => onZone(selectedZone === z.id ? "" : z.id)}
          >
            {z.name}
            {z.latitude == null ? " · location pending" : ""}
          </button>
        ))}
      </div>
      <div className="map-credit">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        {lat != null && lon != null && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Open larger map ↗
          </a>
        )}
      </div>
    </div>
  );
}
