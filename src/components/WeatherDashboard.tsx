import { useMemo, type RefObject } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle, ChevronsDown, Droplets, Wind, Umbrella, Gauge,
  Sunrise, Sunset, SunMedium, Leaf, Moon, Eye, Cloud, Clock, CalendarDays,
  MapPin, Share2, Map,
} from "lucide-react";
import { THEMES, ThemeKey } from "../theme";
import { getWeatherMapping } from "../utils/weatherHelper";
import { getAqiInfo, getUvBand, getMoonPhaseKey, formatVisibility, formatFullDate } from "../utils/weatherDisplay";
import { t, LangCode } from "../utils/i18n";
import type { WeatherBundle } from "../types";
import type { DetailKind } from "./DetailModal";
import WeatherAmbience from "./WeatherAmbience";

interface WeatherDashboardProps {
  weather: WeatherBundle;
  th: typeof THEMES[ThemeKey];
  lang: LangCode;
  isLightTheme: boolean;
  locationName: string;
  formatHour: (dt: number) => string;
  formatDay: (dt: number) => string;
  unlockingDetail: string | null;
  onOpenDetail: (kind: DetailKind, dayIndex?: number) => void;
  sharing: boolean;
  onShare: () => void;
  mapUnlocking: boolean;
  onOpenMap: () => void;
  heroRef: RefObject<HTMLElement | null>;
}

export default function WeatherDashboard({
  weather, th, lang, isLightTheme, locationName, formatHour, formatDay,
  unlockingDetail, onOpenDetail, sharing, onShare, mapUnlocking, onOpenMap, heroRef,
}: WeatherDashboardProps) {
  const currentMapping = useMemo(
    () => getWeatherMapping(weather.current.weatherCode, weather.current.isDay),
    [weather]
  );

  // Açık/az bulutlu gündüzde güneş parlaması, açık gecede ay parlaması.
  const codeGlow = useMemo(() => {
    const c = weather.current.weatherCode;
    if (c === 0 || c === 1) return weather.current.isDay ? "sun" : "moon";
    if (c === 2) return weather.current.isDay ? "sun" : "moon";
    return null;
  }, [weather]);

  return (
    <>
      {/* Hero kart — namaz vaktindeki saat kartıyla aynı ağırlıkta (rounded-3xl, shadow-2xl, gradient sayı) */}
      {weather.alerts.length > 0 && (
        <button onClick={() => onOpenDetail("alert")} disabled={unlockingDetail !== null}
          className={`w-full text-left rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform`}>
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-500 flex-1">{t("alertGenericWarning", lang)}</p>
          {unlockingDetail === "alert" ? (
            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin shrink-0" />
          ) : (
            <ChevronsDown size={16} className="text-red-500 shrink-0 -rotate-90" />
          )}
        </button>
      )}

      <section ref={heroRef} className={`${th.card} border rounded-3xl p-6 sm:p-7 transition-all duration-300 shadow-2xl relative overflow-hidden`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${currentMapping.bgClass}`} />
        <WeatherAmbience code={weather.current.weatherCode} isDay={weather.current.isDay} isLight={isLightTheme} />

        <div className="relative flex flex-col items-center">
          <button onClick={onShare} disabled={sharing}
            data-share-hide
            title={t("shareHero", lang)}
            className={`absolute top-0 end-0 z-20 w-11 h-11 flex items-center justify-center rounded-full border transition-all cursor-pointer active:scale-95 ${th.header} ${th.textMuted} hover:opacity-75`}>
            {sharing ? (
              <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
            ) : (
              <Share2 size={18} />
            )}
          </button>

          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] mb-1 ${th.textMuted}`}>
            <MapPin size={12} className="inline -mt-0.5 me-1" />
            {locationName}
            <span className="mx-1.5 opacity-60">•</span>
            {formatFullDate(Math.floor(Date.now() / 1000), undefined, lang)}
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative w-full grid grid-cols-2 items-center gap-x-4 sm:gap-x-8"
          >
            <div className="relative justify-self-center sm:justify-self-end">
              {codeGlow && codeGlow === "sun" && (
                <div className="absolute inset-0">
                  <div className={`w-sun-halo ${currentMapping.colorClass}`} />
                  <div className={`w-sun-rays ${currentMapping.colorClass}`} />
                </div>
              )}
              {codeGlow && codeGlow === "moon" && (
                <div className="absolute inset-0">
                  <div className={`w-moon-halo ${currentMapping.colorClass}`} />
                </div>
              )}
              <div className={`absolute inset-0 blur-2xl opacity-40 ${currentMapping.colorClass}`}>
                <currentMapping.iconName size={84} />
              </div>
              <currentMapping.iconName size={84} className={`relative ${currentMapping.colorClass}`} />
            </div>

            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <div className="flex items-start font-mono select-none">
                <span className={`text-6xl sm:text-7xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b ${th.clockGrad} tracking-tight leading-none`}>
                  {weather.current.temperature}
                </span>
                <span className={`text-2xl sm:text-3xl font-light ${th.secColor} mt-1`}>°</span>
              </div>
              <p className={`text-base sm:text-lg font-medium ${th.textSecondary} capitalize`}>{t(currentMapping.descKey, lang)}</p>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${th.header} ${th.accent2}`}>
                  <ChevronsDown size={12} className="rotate-180" />
                  {weather.daily[0]?.tempMax ?? weather.current.temperature}°
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${th.header} ${th.textMuted}`}>
                  <ChevronsDown size={12} />
                  {weather.daily[0]?.tempMin ?? weather.current.apparentTemperature}°
                </span>
              </div>
            </div>
          </motion.div>

          <div className={`mt-3 w-full px-4 py-2.5 rounded-full border ${th.prayerActive} flex items-center justify-center gap-2 shadow-lg`}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("wxFeelsLike", lang)}</span>
            <span className="text-base font-mono font-extrabold">{weather.current.apparentTemperature}°</span>
          </div>

          <div className={`w-full grid grid-cols-2 gap-2 pt-4 text-xs`}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Sunrise size={18} className={th.accent3} />
              <span className={`font-semibold ${th.textPrimary}`}>{formatHour(weather.current.sunrise)}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxSunrise", lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Sunset size={18} className={th.accent3} />
              <span className={`font-semibold ${th.textPrimary}`}>{formatHour(weather.current.sunset)}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxSunset", lang)}</span>
            </div>
          </div>

          <div className={`w-full border-t pt-4 mt-4 grid grid-cols-3 gap-2 text-xs ${th.header}`}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <Droplets size={16} className={th.accent2} />
              <span className={`font-semibold ${th.textPrimary}`}>{weather.current.humidity}%</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxHumidity", lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <Gauge size={16} className={th.accent2} />
              <span className={`font-semibold ${th.textPrimary}`}>{weather.current.pressure}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxPressure", lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <Umbrella size={16} className={th.accent2} />
              <span className={`font-semibold ${th.textPrimary}`}>{Math.round(weather.current.popToday)}%</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxPop", lang)}</span>
            </div>
          </div>

          <div className={`w-full grid grid-cols-3 gap-2 pt-4 text-xs`}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Eye size={15} className={th.accent3} />
              <span className={`font-semibold ${th.textPrimary}`}>{formatVisibility(weather.current.visibilityKm)}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxVisibility", lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Cloud size={15} className={th.accent3} />
              <span className={`font-semibold ${th.textPrimary}`}>{weather.current.cloudPct !== undefined ? `%${weather.current.cloudPct}` : "—"}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("hrCloud", lang)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <Wind size={15} className={th.accent3} />
              <span className={`font-semibold ${th.textPrimary}`}>{weather.current.windGustMps !== undefined ? `${weather.current.windGustMps} m/s` : "—"}</span>
              <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("hrGust", lang)}</span>
            </div>
          </div>

          {/* Paylaşım görselinde görünen marka şeridi — normalde gizli; yakalamada görünür yapılır */}
          <div data-share-brand
            className="w-full mt-3 flex items-center justify-center gap-2"
            style={{ display: "none" }}>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${th.header} ${th.accent}`}>
              <span>{t("appName", lang)}</span>
              <span className="opacity-50">•</span>
              <span className="uppercase tracking-widest">Meccanen</span>
            </span>
          </div>
        </div>
      </section>

      {/* Ekstra bilgiler: UV, Hava Kalitesi, Ay Evresi */}
      <section className="grid grid-cols-3 gap-2.5">
        <button onClick={() => onOpenDetail("uv")} disabled={unlockingDetail !== null}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 min-w-0 active:scale-[0.97] transition-transform relative ${th.card}`}>
          {unlockingDetail === "uv" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
              <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
            </div>
          )}
          <SunMedium size={18} className="text-amber-500" />
          <span className={`text-lg font-bold ${th.textPrimary}`}>{weather.current.uvIndex}</span>
          <span className={`w-full text-[10px] text-center leading-tight break-words ${th.textMuted}`}>{t("uvIndex", lang)}</span>
        </button>
        <button onClick={() => onOpenDetail("aq")} disabled={unlockingDetail !== null}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 min-w-0 active:scale-[0.97] transition-transform relative ${th.card}`}>
          {unlockingDetail === "aq" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
              <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
            </div>
          )}
          <Leaf size={18} className={weather.airQuality ? getAqiInfo(weather.airQuality.usEpaIndex).colorClass : "text-slate-400"} />
          <span className={`w-full text-xs font-bold text-center leading-tight break-words ${weather.airQuality ? getAqiInfo(weather.airQuality.usEpaIndex).colorClass : th.textPrimary}`}>
            {weather.airQuality ? t(getAqiInfo(weather.airQuality.usEpaIndex).key, lang) : "—"}
          </span>
          <span className={`w-full text-[10px] text-center leading-tight break-words ${th.textMuted}`}>{t("airQuality", lang)}</span>
        </button>
        <button onClick={() => onOpenDetail("moon")} disabled={unlockingDetail !== null}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 min-w-0 active:scale-[0.97] transition-transform relative ${th.card}`}>
          {unlockingDetail === "moon" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
              <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
            </div>
          )}
          <Moon size={18} className={th.accent3} />
          <span className={`w-full text-xs font-bold text-center leading-tight break-words ${th.textPrimary}`}>
            {weather.astronomy ? t(getMoonPhaseKey(weather.astronomy.moonPhase), lang) : "—"}
          </span>
          <span className={`w-full text-[10px] text-center leading-tight break-words ${th.textMuted}`}>{t("moonPhase", lang)}</span>
        </button>
      </section>

      {/* Saatlik tahmin */}
      <section>
        <div className="flex items-center gap-1.5 mb-2.5 px-1">
          <Clock size={13} className={th.textMuted} />
          <p className={`text-xs font-bold uppercase tracking-wide ${th.textMuted}`}>{t("wxHourlyTitle", lang)}</p>
        </div>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {weather.hourly.map((h, i) => {
            const m = getWeatherMapping(h.weatherCode, h.isDay);
            const isUnlocking = unlockingDetail === `hour-${i}`;
            const isNow = i === 0;
            return (
              <motion.button key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.03 }}
                onClick={() => onOpenDetail("hour", i)}
                disabled={unlockingDetail !== null}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-3.5 py-3.5 min-w-[68px] shadow-sm active:scale-[0.97] transition-transform ${isNow ? th.prayerActive : `${th.card} ${th.cardHover}`}`}>
                {isUnlocking && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
                    <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
                  </div>
                )}
                {h.pop > 0.15 && !isUnlocking && (
                  <span className={`absolute top-1.5 right-1.5 w-14 text-right text-[10px] ${th.accent2}`}>
                    {Math.round(h.pop * 100)}%
                  </span>
                )}
                <span className={`text-xs font-semibold ${isNow ? th.accent : th.textSecondary}`}>
                  {isNow ? t("wxNow", lang) : formatHour(h.dt)}
                </span>
                <m.iconName size={22} className={m.colorClass} />
                <span className="text-sm font-bold">{h.temperature}°</span>
                {isNow && (
                  <span className={`w-14 text-center text-[10px] leading-tight ${th.textMuted}`}>
                    {h.uvIndex !== undefined && (
                      <span className="flex items-center justify-center gap-0.5 text-amber-500">
                        <SunMedium size={9} /><b>{h.uvIndex}</b>
                      </span>
                    )}
                    {h.precipMm !== undefined && h.precipMm > 0 && (
                      <span className="flex items-center justify-center gap-0.5">
                        <Droplets size={9} />{(Math.round(h.precipMm * 10) / 10).toFixed(1)}mm
                      </span>
                    )}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Hava haritası (radar) — ödüllü reklamla açılır */}
      <button onClick={onOpenMap} disabled={mapUnlocking}
        className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-3xl border transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden ${th.card} ${th.cardHover}`}>
        {mapUnlocking && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
          </div>
        )}
        <Map size={20} className={th.accent} />
        <span className={`text-sm font-bold ${th.textPrimary}`}>{t("mapTitle", lang)}</span>
        <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 ${th.header} ${th.textMuted}`}>
          {t("mapLocked", lang)}
        </span>
      </button>

      {/* Günlük tahmin */}
      <section className={`${th.card} border rounded-3xl overflow-hidden shadow-xl`}>
        <div className="flex items-center gap-1.5 px-4 pt-4 pb-1">
          <CalendarDays size={13} className={th.textMuted} />
          <p className={`text-xs font-bold uppercase tracking-wide ${th.textMuted}`}>{t("wxDailyTitle", lang)}</p>
        </div>
        <div className={`divide-y ${isLightTheme ? "divide-black/5" : "divide-white/5"}`}>
          {weather.daily.map((d, i) => {
            const m = getWeatherMapping(d.weatherCode, true);
            return (
              <button key={i} onClick={() => onOpenDetail("day", i)} disabled={unlockingDetail !== null}
                className={`w-full flex items-center justify-between px-4 py-3.5 text-sm ${th.cardHover} transition-colors relative`}>
                {unlockingDetail === `day-${i}` && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${th.accent}`} />
                  </div>
                )}
                <span className={`w-20 shrink-0 font-medium text-left ${i === 0 ? th.accent : th.textPrimary}`}>
                  {i === 0 ? t("wxToday", lang) : formatDay(d.dt)}
                </span>
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <m.iconName size={19} className={m.colorClass} />
                  {d.pop > 0.15 && (
                    <span className={`text-xs ${th.accent2}`}>{Math.round(d.pop * 100)}%</span>
                  )}
                </div>
                <span className="w-24 text-right font-semibold font-mono">
                  <span className={th.textPrimary}>{d.tempMax}°</span>
                  <span className={`mx-1 ${th.textMuted}`}>/</span>
                  <span className={th.textMuted}>{d.tempMin}°</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}