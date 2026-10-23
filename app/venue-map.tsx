"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Trash2,
  ExternalLink,
  MapPinPlus,
  Compass,
} from "lucide-react";
import type { State, Event } from "@/lib/types";

const TILE_SIZE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;

function latLonToPixel(lat: number, lon: number, zoom: number) {
  const n = 1 << zoom;
  const x = ((lon + 180) / 360) * n * TILE_SIZE;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n *
    TILE_SIZE;
  return { x, y };
}

function pixelToLatLon(x: number, y: number, zoom: number) {
  const n = 1 << zoom;
  const lon = (x / (n * TILE_SIZE)) * 360 - 180;
  const yClamped = Math.max(0, Math.min(n * TILE_SIZE, y));
  const latRad = Math.atan(
    Math.sinh(Math.PI * (1 - (2 * yClamped) / (n * TILE_SIZE))),
  );
  const lat = (latRad * 180) / Math.PI;
  return {
    lat: Math.max(-85.0511, Math.min(85.0511, lat)),
    lon: Math.max(-180, Math.min(180, lon)),
  };
}

export default function VenueMap({
  zones,
  onZone,
  selectedZone,
  event,
  onSaveLocation,
  onLocationSelect,
}: {
  zones: State["zones"];
  batches: State["batches"];
  captures?: State["captures"];
  onZone: (id: string) => void;
  selectedZone: string;
  event?: Event;
  onSaveLocation?: (coords: {
    latitude: number;
    longitude: number;
    zoneId?: string;
  }) => Promise<unknown> | unknown;
  onLocationSelect?: (coords: { latitude: number; longitude: number }) => void;
}) {
  const zone = zones.find((z) => z.id === selectedZone);
  const sample = event?.id === "riverlight" || event?.id === "design-week";
  const defaultLat =
    zone?.latitude ?? event?.latitude ?? (sample ? 12.9716 : 12.9716);
  const defaultLon =
    zone?.longitude ?? event?.longitude ?? (sample ? 77.5946 : 77.5946);

  const [center, setCenter] = useState<{ lat: number; lon: number }>({
    lat: defaultLat,
    lon: defaultLon,
  });

  const [prevTarget, setPrevTarget] = useState({
    id: selectedZone || event?.id || "",
    lat: defaultLat,
    lon: defaultLon,
  });

  if (
    prevTarget.id !== (selectedZone || event?.id || "") ||
    prevTarget.lat !== defaultLat ||
    prevTarget.lon !== defaultLon
  ) {
    setPrevTarget({
      id: selectedZone || event?.id || "",
      lat: defaultLat,
      lon: defaultLon,
    });
    setCenter({ lat: defaultLat, lon: defaultLon });
  }

  const [zoom, setZoom] = useState(16);
  const [dimensions, setDimensions] = useState({ width: 700, height: 350 });
  const [droppedPin, setDroppedPin] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isDroppingMode, setIsDroppingMode] = useState(false);
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [viewMode, setViewMode] = useState<"interactive" | "embed">(
    "interactive",
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    centerPix: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const isDraggingPinRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const centerPix = latLonToPixel(center.lat, center.lon, zoom);
  const minX = centerPix.x - dimensions.width / 2;
  const minY = centerPix.y - dimensions.height / 2;
  const maxX = centerPix.x + dimensions.width / 2;
  const maxY = centerPix.y + dimensions.height / 2;

  const numTiles = 1 << zoom;
  const startTileX = Math.floor(minX / TILE_SIZE);
  const endTileX = Math.floor(maxX / TILE_SIZE);
  const startTileY = Math.max(0, Math.floor(minY / TILE_SIZE));
  const endTileY = Math.min(numTiles - 1, Math.floor(maxY / TILE_SIZE));

  const tiles = [];
  if (viewMode === "interactive") {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        const wrappedX = ((tx % numTiles) + numTiles) % numTiles;
        tiles.push({
          key: `${zoom}-${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left: tx * TILE_SIZE - minX,
          top: ty * TILE_SIZE - minY,
        });
      }
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest(".map-pin-popup") ||
      target.closest(".map-dropped-pin")
    ) {
      return;
    }

    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      centerPix,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      panStartRef.current.moved = true;
    }
    if (panStartRef.current.moved) {
      const newPixX = panStartRef.current.centerPix.x - dx;
      const newPixY = panStartRef.current.centerPix.y - dy;
      setCenter(pixelToLatLon(newPixX, newPixY, zoom));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const wasMoved = panStartRef.current?.moved;
    isPanningRef.current = false;
    panStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (!wasMoved) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const clickPixX = minX + clickX;
      const clickPixY = minY + clickY;
      const coords = pixelToLatLon(clickPixX, clickPixY, zoom);
      const rounded = {
        lat: Number(coords.lat.toFixed(6)),
        lon: Number(coords.lon.toFixed(6)),
      };
      setDroppedPin(rounded);
      setIsDroppingMode(true);
      onLocationSelect?.({ latitude: rounded.lat, longitude: rounded.lon });
    }
  };

  const handlePinPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingPinRef.current = true;
    setIsDraggingPin(true);

    const onWindowMove = (ev: PointerEvent) => {
      if (!isDraggingPinRef.current || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const currX = ev.clientX - r.left;
      const currY = ev.clientY - r.top;
      const currPixX = minX + currX;
      const currPixY = minY + currY;
      const coords = pixelToLatLon(currPixX, currPixY, zoom);
      const rounded = {
        lat: Number(coords.lat.toFixed(6)),
        lon: Number(coords.lon.toFixed(6)),
      };
      setDroppedPin(rounded);
      onLocationSelect?.({ latitude: rounded.lat, longitude: rounded.lon });
    };

    const onWindowUp = () => {
      isDraggingPinRef.current = false;
      setIsDraggingPin(false);
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(MAX_ZOOM, z + 1));
    } else if (e.deltaY > 0) {
      setZoom((z) => Math.max(MIN_ZOOM, z - 1));
    }
  };

  const handleDropPinButtonClick = () => {
    if (!droppedPin) {
      const pinCoords = {
        lat: Number(center.lat.toFixed(6)),
        lon: Number(center.lon.toFixed(6)),
      };
      setDroppedPin(pinCoords);
      setIsDroppingMode(true);
      onLocationSelect?.({ latitude: pinCoords.lat, longitude: pinCoords.lon });
    } else {
      setCenter({ lat: droppedPin.lat, lon: droppedPin.lon });
      setIsDroppingMode(true);
    }
  };

  const handleSaveCoordinates = async (zoneId?: string) => {
    if (!droppedPin || !onSaveLocation) return;
    setSaveState("saving");
    try {
      const res = await onSaveLocation({
        latitude: droppedPin.lat,
        longitude: droppedPin.lon,
        zoneId,
      });
      if (res !== null) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2500);
      } else {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 2500);
      }
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  const resetView = useCallback(() => {
    setCenter({ lat: defaultLat, lon: defaultLon });
    setZoom(16);
  }, [defaultLat, defaultLon]);

  const activeLat = zone?.latitude ?? event?.latitude ?? (sample ? 12.9716 : null);
  const activeLon = zone?.longitude ?? event?.longitude ?? (sample ? 77.5946 : null);
  const bbox =
    activeLat != null && activeLon != null
      ? [
          activeLon - 0.012,
          activeLat - 0.007,
          activeLon + 0.012,
          activeLat + 0.007,
        ].join(",")
      : "";

  const droppedScreenPix = droppedPin
    ? latLonToPixel(droppedPin.lat, droppedPin.lon, zoom)
    : null;
  const droppedScreenX = droppedScreenPix ? droppedScreenPix.x - minX : 0;
  const droppedScreenY = droppedScreenPix ? droppedScreenPix.y - minY : 0;

  const eventScreenPix =
    event?.latitude != null && event?.longitude != null
      ? latLonToPixel(event.latitude, event.longitude, zoom)
      : null;
  const eventScreenX = eventScreenPix ? eventScreenPix.x - minX : 0;
  const eventScreenY = eventScreenPix ? eventScreenPix.y - minY : 0;

  return (
    <div className="geographic-map">
      <div className="map-toolbar">
        <div className="map-toolbar-brand">
          <strong>OpenStreetMap</strong>
          <span>
            {sample
              ? "Sample locations in Bengaluru"
              : event?.name || event?.location || "Event map"}
          </span>
        </div>
        <div className="map-toolbar-actions">
          <button
            type="button"
            className={`map-pin-btn ${isDroppingMode || droppedPin ? "active" : ""}`}
            onClick={handleDropPinButtonClick}
            title="Click to drop a pin at center or reposition"
          >
            <MapPinPlus size={14} />
            <span>{droppedPin ? "Pin dropped" : "Drop pin"}</span>
          </button>
          <div className="map-view-toggle">
            <button
              type="button"
              className={viewMode === "interactive" ? "chosen" : ""}
              onClick={() => setViewMode("interactive")}
            >
              Interactive
            </button>
            <button
              type="button"
              className={viewMode === "embed" ? "chosen" : ""}
              onClick={() => setViewMode("embed")}
            >
              OSM embed
            </button>
          </div>
        </div>
      </div>

      {viewMode === "embed" ? (
        activeLat == null || activeLon == null ? (
          <div className="map-placeholder">
            <strong>Add an event location</strong>
            <p>
              Switch back to Interactive mode to drop a pin directly on the map.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => setViewMode("interactive")}
            >
              Open interactive map
            </button>
          </div>
        ) : (
          <iframe
            key={bbox}
            title="Interactive event map from OpenStreetMap"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${activeLat}%2C${activeLon}`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )
      ) : (
        <div
          ref={containerRef}
          className={`map-interactive-viewport ${isDroppingMode ? "is-dropping-mode" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          <div className="map-tiles-canvas">
            {tiles.map((t) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={t.key}
                className="map-tile-img"
                src={t.url}
                alt=""
                style={{
                  left: `${t.left}px`,
                  top: `${t.top}px`,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "0";
                }}
              />
            ))}
          </div>

          <div className="map-overlay-controls">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus size={15} />
            </button>
            <span className="map-zoom-tag">{zoom}z</span>
            <button
              type="button"
              onClick={resetView}
              aria-label="Reset map center"
              title="Reset center"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {isDroppingMode && (
            <div className="map-instruction-toast">
              Click anywhere on map or drag the pin to set location
            </div>
          )}

          {eventScreenPix && (
            <div
              className="map-event-marker"
              style={{
                left: `${eventScreenX}px`,
                top: `${eventScreenY}px`,
              }}
              title={`Event venue: ${event?.name || "Current event"}`}
            >
              <Compass size={13} />
              <span>{event?.name || "Event Venue"}</span>
            </div>
          )}

          {zones.map((z) => {
            if (z.latitude == null || z.longitude == null) return null;
            const zPix = latLonToPixel(z.latitude, z.longitude, zoom);
            const zScreenX = zPix.x - minX;
            const zScreenY = zPix.y - minY;
            const isSelected = selectedZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                className={`map-zone-marker ${isSelected ? "selected" : ""}`}
                style={{
                  left: `${zScreenX}px`,
                  top: `${zScreenY}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onZone(isSelected ? "" : z.id);
                }}
                title={`Zone: ${z.name}`}
              >
                <MapPin size={11} />
                <span>{z.name}</span>
              </button>
            );
          })}

          {droppedPin && (
            <div
              className={`map-dropped-pin ${isDraggingPin ? "is-dragging" : ""}`}
              style={{
                left: `${droppedScreenX}px`,
                top: `${droppedScreenY}px`,
              }}
              onPointerDown={handlePinPointerDown}
            >
              <div className="map-pin-pulse" />
              <div
                className="map-pin-icon-wrap"
                title="Drag to reposition pin"
              >
                <svg
                  width="30"
                  height="38"
                  viewBox="0 0 30 38"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 0C6.716 0 0 6.716 0 15C0 26.25 15 38 15 38C15 38 30 26.25 30 15C30 6.716 23.284 0 15 0Z"
                    fill="#db713e"
                  />
                  <circle cx="15" cy="14" r="6" fill="#fffefa" />
                  <circle cx="15" cy="14" r="3.2" fill="#294d38" />
                </svg>
              </div>

              <div
                className="map-pin-popup"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="map-pin-popup-head">
                  <strong>Dropped Pin</strong>
                  <button
                    type="button"
                    className="map-pin-close"
                    onClick={() => {
                      setDroppedPin(null);
                      setIsDroppingMode(false);
                    }}
                    title="Remove dropped pin"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="map-pin-coords">
                  {droppedPin.lat.toFixed(6)}, {droppedPin.lon.toFixed(6)}
                </div>

                {onSaveLocation && (
                  <div className="map-pin-actions">
                    {event && (
                      <button
                        type="button"
                        className="map-pin-action-btn primary"
                        disabled={saveState === "saving"}
                        onClick={() => handleSaveCoordinates()}
                      >
                        <Check size={12} />
                        Save for event
                      </button>
                    )}
                    {zone && (
                      <button
                        type="button"
                        className="map-pin-action-btn secondary"
                        disabled={saveState === "saving"}
                        onClick={() => handleSaveCoordinates(zone.id)}
                      >
                        <Check size={12} />
                        Save for {zone.name}
                      </button>
                    )}
                  </div>
                )}

                {saveState === "saving" && (
                  <span className="map-pin-status-note">Saving...</span>
                )}
                {saveState === "saved" && (
                  <span className="map-pin-status-note">
                    <Check size={11} /> Saved successfully
                  </span>
                )}
                {saveState === "error" && (
                  <span className="map-pin-status-note text-error">
                    Save failed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
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
        <div className="map-credit-links">
          {droppedPin && (
            <span className="dropped-preview">
              Dropped: {droppedPin.lat.toFixed(5)}, {droppedPin.lon.toFixed(5)}
            </span>
          )}
          {activeLat != null && activeLon != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${activeLat}&mlon=${activeLon}#map=16/${activeLat}/${activeLon}`}
              target="_blank"
              rel="noreferrer"
            >
              Open larger map <ExternalLink size={11} className="inline-icon" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
