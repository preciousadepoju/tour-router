"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface MapStop {
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
}

interface Props {
  stops: MapStop[];
  muted?: boolean;
  active?: number | null;
  onSelect?: (index: number) => void;
}

/** Numbered tour route on dark-filtered OpenStreetMap tiles. No map API key needed. */
export default function RouteMap({ stops, muted, active, onSelect }: Props) {
  const line = useMemo(() => stops.map((s) => [s.lat, s.lng] as [number, number]), [stops]);

  return (
    <MapContainer
      center={line[0] ?? [20, 0]}
      zoom={3}
      scrollWheelZoom={false}
      worldCopyJump
      className="map-dark h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={18}
      />
      <FitBounds points={line} />
      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#000", weight: 6, opacity: 0.5 }} />
          <Polyline
            positions={line}
            pathOptions={{ color: muted ? "#c9c1b2" : "#ff5b2e", weight: 2.5, dashArray: "6 8", lineCap: "round" }}
          />
        </>
      )}
      {stops.map((s, i) => (
        <Marker
          key={`${s.title}-${i}`}
          position={[s.lat, s.lng]}
          icon={pin(i + 1, muted, active === i)}
          eventHandlers={{ click: () => onSelect?.(i) }}
          keyboard
          title={`${i + 1}. ${s.title}`}
        >
          <Tooltip direction="top" offset={[0, -16]} opacity={1}>
            <strong>
              {i + 1}. {s.title}
            </strong>
            {s.subtitle && <div>{s.subtitle}</div>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function pin(n: number, muted?: boolean, active?: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="stop-pin${muted ? " muted" : ""}" style="${active ? "transform:scale(1.25)" : ""}">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 6);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 7 });
  }, [map, points]);
  return null;
}
