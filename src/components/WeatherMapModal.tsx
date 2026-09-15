import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Crosshair, Clock } from "lucide-react";
import { THEMES, ThemeKey } from "../theme";
import { t, LangCode } from "../utils/i18n";

interface WeatherMapModalProps {
  lat: number;
  lon: number;
  locationName: string;
  th: typeof THEMES[ThemeKey];
  lang: LangCode;
  onClose: () => void;
}

type MapLayerType = "tmp2m" | "precip" | "pressure" | "wind";

const LAYERS: { type: MapLayerType; path: string; labelKey: string }[] = [
  { type: "tmp2m", path: "tmp2m", labelKey: "mapLayerTemp" },
  { type: "precip", path: "precip", labelKey: "mapLayerPrecip" },
  { type: "pressure", path: "pressure", labelKey: "mapLayerPressure" },
  { type: "wind", path: "wind", labelKey: "mapLayerWind" },
];

// UTC saat diliminden "yyyymmdd" + "hh" üretir (weatherapi tile path formatı).
function utcFrame(hourOffset: number): { date: string; hour: string } {
  const d = new Date(Date.now() + hourOffset * 3600 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return { date: `${yyyy}${mm}${dd}`, hour: hh };
}

export default function WeatherMapModal({ lat, lon, locationName, th, lang, onClose }: WeatherMapModalProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const overlay = useRef<L.TileLayer | null>(null);
  const pin = useRef<L.Marker | null>(null);

  const [layer, setLayer] = useState<MapLayerType>("tmp2m");
  const [hourOffset, setHourOffset] = useState(0); // 0 = şu anki UTC saati; weatherapi ~5 günlük pencere üretir
  const [viewLat, setViewLat] = useState(lat);
  const [viewLon, setViewLon] = useState(lon);
  const [viewZoom, setViewZoom] = useState(5);

  // Harita bir kez kur + konum pini + hareket/zoom okuyucu.
  useEffect(() => {
    if (!mapEl.current || leafletMap.current) return;

    const map = L.map(mapEl.current, {
      center: [lat, lon],
      zoom: 5,
      minZoom: 0,
      maxZoom: 6, // weatherapi tile'ları en fazla zoom 6'da üretiliyor
      attributionControl: true,
    });
    map.attributionControl.setPrefix("");
    map.setMaxBounds([[-85.05112878, -180], [85.05112878, 180]]);
    const darkBase = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }
    ).addTo(map);
    leafletMap.current = map;

    const frame = utcFrame(0);
    overlay.current = L.tileLayer(
      `https://weathermaps.weatherapi.com/${LAYERS[0].path}/tiles/${frame.date}${frame.hour}/{z}/{x}/{y}.png`,
      { minZoom: 0, maxZoom: 6, opacity: 0.85, noWrap: true, crossOrigin: true }
    ).addTo(map);

    // Konum pini — puls eden CSS ikonu (index.css'te .mhd-map-pin).
    const icon = L.divIcon({
      className: "",
      html: '<div class="mhd-map-pin"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    pin.current = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);

    const syncView = () => {
      const c = map.getCenter();
      setViewLat(c.lat);
      setViewLon(c.lng);
      setViewZoom(map.getZoom());
    };
    map.on("moveend zoomend", syncView);
    syncView();

    return () => {
      map.remove();
      leafletMap.current = null;
      overlay.current = null;
      pin.current = null;
    };
  }, [lat, lon]);

  const goToLocation = () => {
    const map = leafletMap.current;
    if (!map) return;
    map.flyTo([lat, lon], Math.max(map.getZoom(), 5), { duration: 0.6 });
  };

  // Tile URL'ini güncelle (Leaflet tile layer URL'si değişince layer'ı
  // yeniden eklemek en temiz yoldur — önce eskiyi kaldır, yenisini ekle).
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (overlay.current) map.removeLayer(overlay.current);

    const frame = utcFrame(hourOffset);
    const path = LAYERS.find((l) => l.type === layer)?.path ?? "tmp2m";
    const url = `https://weathermaps.weatherapi.com/${path}/tiles/${frame.date}${frame.hour}/{z}/{x}/{y}.png`;
    overlay.current = L.tileLayer(url, { minZoom: 0, maxZoom: 6, opacity: 0.85, noWrap: true, crossOrigin: true }).addTo(map);
  }, [layer, hourOffset]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-3xl border overflow-hidden backdrop-blur-xl ${th.settingsCard}`}
        dir={lang === "ar" || lang === "ur" ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className={`font-semibold text-base flex items-center gap-2 ${th.textPrimary}`}>
            <MapIcon size={18} className={th.accent} />
            {t("mapTitle", lang)}
            <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border px-2 py-0.5 ${th.header} ${th.textSecondary}`}>
              <MapPin size={11} className={th.accent} />
              <span className="max-w-[180px] truncate">{locationName}</span>
            </span>
          </h3>
          <button onClick={onClose} className={th.textMuted}>
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b">
          {LAYERS.map((l) => (
            <button
              key={l.type}
              onClick={() => setLayer(l.type)}
              className={`px-2 py-2 rounded-xl border text-xs font-semibold transition-all text-center ${layer === l.type ? `${th.accent} border-current ${th.header}` : `border-transparent ${th.textSecondary}`}`}
            >
              {t(l.labelKey, lang)}
            </button>
          ))}
        </div>

        <div className="relative w-full h-[56vh]">
          <div ref={mapEl} className="absolute inset-0 z-0" />

          {/* Canlı konum okuyucu — nerede olduğun hep belli */}
          <div className="absolute top-3 left-3 z-[500] px-3 py-1.5 rounded-xl border bg-black/60 backdrop-blur-xl flex items-center gap-2">
            <MapPin size={13} className={th.accent} />
            <span className={`text-[11px] font-mono tracking-tight ${th.textPrimary}`}>
              {Math.abs(viewLat).toFixed(2)}°{viewLat >= 0 ? "N" : "S"} · {Math.abs(viewLon).toFixed(2)}°{viewLon >= 0 ? "E" : "W"} · Z{viewZoom}
            </span>
          </div>

          {/* Konuma dön */}
          <button
            onClick={goToLocation}
            title={locationName}
            className="absolute top-3 right-3 z-[500] w-10 h-10 flex items-center justify-center rounded-xl border bg-black/60 backdrop-blur-xl active:scale-95 transition-transform cursor-pointer"
          >
            <Crosshair size={18} className={th.accent} />
          </button>

          <div className="absolute bottom-3 inset-x-3 z-[500] flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border bg-black/60 backdrop-blur-xl">
            <button
              onClick={() => setHourOffset((h) => Math.max(h - 1, -48))}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border ${th.header} ${th.accent}`}
              aria-label="previous hour"
            >
              <ChevronLeft size={20} />
            </button>
            <span className={`flex items-center gap-1.5 text-sm font-bold tracking-widest font-mono ${th.textPrimary}`}>
              <Clock size={14} className={th.accent} />
              {utcFrame(hourOffset).date.slice(6)}/{utcFrame(hourOffset).date.slice(4, 6)} · {utcFrame(hourOffset).hour}:00
            </span>
            <button
              onClick={() => setHourOffset((h) => Math.min(h + 1, 120))}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border ${th.header} ${th.accent}`}
              aria-label="next hour"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}