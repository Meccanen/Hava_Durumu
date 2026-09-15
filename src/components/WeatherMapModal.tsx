import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, ChevronLeft, ChevronRight, Map as MapIcon } from "lucide-react";
import { THEMES, ThemeKey } from "../theme";
import { t, LangCode } from "../utils/i18n";

interface WeatherMapModalProps {
  lat: number;
  lon: number;
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

export default function WeatherMapModal({ lat, lon, th, lang, onClose }: WeatherMapModalProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const overlay = useRef<L.TileLayer | null>(null);

  const [layer, setLayer] = useState<MapLayerType>("tmp2m");
  const [hourOffset, setHourOffset] = useState(0); // 0 = şu anki UTC saati

  // Tile URL'ini güncelle (Leaflet tile layer URL'si değişince layer'ı
  // yeniden eklemek en temiz yoldur — önce eskiyi kaldır, yenisini ekle).
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (overlay.current) map.removeLayer(overlay.current);

    const frame = utcFrame(hourOffset);
    const path = LAYERS.find((l) => l.type === layer)?.path ?? "tmp2m";
    const url = `https://weathermaps.weatherapi.com/${path}/tiles/${frame.date}${frame.hour}/{z}/{x}/{y}.png`;
    overlay.current = L.tileLayer(url, { maxZoom: 19, opacity: 0.85, crossOrigin: true }).addTo(map);
  }, [layer, hourOffset]);

  // Haritayı bir kez kur.
  useEffect(() => {
    if (!mapEl.current || leafletMap.current) return;

    const map = L.map(mapEl.current, {
      center: [lat, lon],
      zoom: 7,
      attributionControl: true,
    });
    map.attributionControl.setPrefix("");
    const darkBase = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }
    ).addTo(map);
    leafletMap.current = map;

    const frame = utcFrame(0);
    overlay.current = L.tileLayer(
      `https://weathermaps.weatherapi.com/${LAYERS[0].path}/tiles/${frame.date}${frame.hour}/{z}/{x}/{y}.png`,
      { maxZoom: 19, opacity: 0.85, crossOrigin: true }
    ).addTo(map);

    return () => {
      map.remove();
      leafletMap.current = null;
      overlay.current = null;
    };
  }, [lat, lon]);

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
          <div className="absolute bottom-3 inset-x-3 z-[500] flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border bg-black/60 backdrop-blur-xl">
            <button
              onClick={() => setHourOffset((h) => h - 1)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border ${th.header} ${th.accent}`}
              aria-label="previous hour"
            >
              <ChevronLeft size={20} />
            </button>
            <span className={`text-sm font-bold tracking-widest font-mono ${th.textPrimary}`}>
              {utcFrame(hourOffset).date} {utcFrame(hourOffset).hour}:00 UTC
            </span>
            <button
              onClick={() => setHourOffset((h) => h + 1)}
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