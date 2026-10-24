"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  MapPinPlus,
  Compass,
  Plus,
  Minus,
  RotateCcw,
  Trash2,
} from "lucide-react";

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

export interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  defaultCenter?: { lat: number; lon: number };
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  defaultCenter = { lat: 12.9716, lon: 77.5946 },
}: LocationPickerProps) {
  const hasValidCoords =
    latitude !== "" &&
    longitude !== "" &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  const parsedLat = hasValidCoords ? Number(latitude) : defaultCenter.lat;
  const parsedLon = hasValidCoords ? Number(longitude) : defaultCenter.lon;

  const [center, setCenter] = useState<{ lat: number; lon: number }>({
    lat: parsedLat,
    lon: parsedLon,
  });
  const [zoom, setZoom] = useState(15);
  const [dimensions, setDimensions] = useState({ width: 500, height: 230 });
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);

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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest(".map-overlay-controls") ||
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
      const roundedLat = coords.lat.toFixed(6);
      const roundedLon = coords.lon.toFixed(6);
      onChange(roundedLat, roundedLon);
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
      onChange(coords.lat.toFixed(6), coords.lon.toFixed(6));
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

  const handleDropPinAtCenter = () => {
    if (!hasValidCoords) {
      const newLat = center.lat.toFixed(6);
      const newLon = center.lon.toFixed(6);
      onChange(newLat, newLon);
    } else {
      setCenter({ lat: Number(latitude), lon: Number(longitude) });
    }
  };

  const handleCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCenter({ lat, lon });
        setZoom(16);
        onChange(lat.toFixed(6), lon.toFixed(6));
      },
      () => {
        setGeoLocating(false);
      },
      { timeout: 10000 },
    );
  };

  const handleClearPin = () => {
    onChange("", "");
  };

  const resetView = useCallback(() => {
    if (hasValidCoords) {
      setCenter({ lat: Number(latitude), lon: Number(longitude) });
    } else {
      setCenter({ lat: defaultCenter.lat, lon: defaultCenter.lon });
    }
    setZoom(15);
  }, [hasValidCoords, latitude, longitude, defaultCenter.lat, defaultCenter.lon]);

  const pinScreenPix = hasValidCoords
    ? latLonToPixel(Number(latitude), Number(longitude), zoom)
    : null;
  const pinScreenX = pinScreenPix ? pinScreenPix.x - minX : 0;
  const pinScreenY = pinScreenPix ? pinScreenPix.y - minY : 0;

  return (
    <div className="location-picker-container">
      <div className="location-picker-header">
        <div className="location-picker-title">
          <MapPin size={15} />
          <span>Location coordinates</span>
        </div>
        <div className="location-picker-actions">
          <button
            type="button"
            className={`map-pin-btn ${hasValidCoords ? "active" : ""}`}
            onClick={handleDropPinAtCenter}
            title="Click to drop a pin at the map center or focus existing pin"
          >
            <MapPinPlus size={14} />
            <span>{hasValidCoords ? "Pin dropped" : "Pin drop location"}</span>
          </button>
          {typeof navigator !== "undefined" && navigator.geolocation && (
            <button
              type="button"
              className="map-pin-btn"
              onClick={handleCurrentLocation}
              disabled={geoLocating}
              title="Use your device location"
            >
              <Compass size={14} />
              <span>{geoLocating ? "Locating..." : "Current location"}</span>
            </button>
          )}
          {hasValidCoords && (
            <button
              type="button"
              className="map-pin-btn danger-text"
              onClick={handleClearPin}
              title="Clear dropped pin"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="map-interactive-viewport location-picker-viewport"
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
            aria-label="Reset map view"
            title="Reset view"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div className="map-instruction-toast">
          {hasValidCoords
            ? "Drag pin or click map to adjust venue location"
            : "Click map or Pin Drop Location to place marker"}
        </div>

        {hasValidCoords && (
          <div
            className={`map-dropped-pin ${isDraggingPin ? "is-dragging" : ""}`}
            style={{
              left: `${pinScreenX}px`,
              top: `${pinScreenY}px`,
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
          </div>
        )}
      </div>

      <p className="form-hint">
        Coordinates place this event on OpenStreetMap. You can drag the pin, click the map, or edit numbers directly.
      </p>

      <div className="form-row">
        <label>
          Latitude
          <input
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude}
            onChange={(e) => onChange(e.target.value, longitude)}
            placeholder="12.971600"
          />
        </label>
        <label>
          Longitude
          <input
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude}
            onChange={(e) => onChange(latitude, e.target.value)}
            placeholder="77.594600"
          />
        </label>
      </div>
    </div>
  );
}
