"use client";

import * as React from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvent } from "react-leaflet";
import { divIcon } from "leaflet";

import "leaflet/dist/leaflet.css";

/**
 * Leaflet's default marker loads three PNGs through the bundler and breaks;
 * a DivIcon keeps the pin dependency-free and on-theme.
 */
const PIN = divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="
    display:block;width:22px;height:22px;border-radius:9999px;
    background:rgba(255,122,26,0.25);
    border:2px solid #FF7A1A;
    box-shadow:0 0 0 6px rgba(255,122,26,0.12);
  "></span>`,
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvent("click", (event) => {
    onPick(event.latlng.lat, event.latlng.lng);
  });
  return null;
}

/** Recentres the map when the location changes from the search box. */
function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 6), { animate: true });
  }, [lat, lon, map]);
  return null;
}

export interface MapPickerProps {
  lat: number;
  lon: number;
  onPick: (lat: number, lon: number) => void;
}

export default function MapPicker({ lat, lon, onPick }: MapPickerProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={5}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-xl sm:h-72"
      aria-label="Map — click to choose a location"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lon]} icon={PIN} />
      <ClickHandler onPick={onPick} />
      <Recenter lat={lat} lon={lon} />
    </MapContainer>
  );
}
