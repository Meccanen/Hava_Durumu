import React from "react";
import {
  X, AlertTriangle, Droplets, Wind, Gauge, Umbrella, Eye, Snowflake,
  Cloud, SunMedium,
} from "lucide-react";
import { THEMES, ThemeKey, themeBgToOpaqueRgba } from "../theme";
import { getWeatherMapping } from "../utils/weatherHelper";
import { isLikelyCorruptedAlertText } from "../utils/notificationBuilder";
import { getAqiInfo, getUvBand, getMoonPhaseKey } from "../utils/weatherDisplay";
import { t, LangCode } from "../utils/i18n";
import type { WeatherBundle, HourlyForecast } from "../types";

export type DetailKind = "alert" | "uv" | "aq" | "moon" | "day" | "hour";

interface DetailModalProps {
  weather: WeatherBundle;
  detailModal: DetailKind | null;
  detailDayIndex: number;
  detailHourIndex: number;
  onClose: () => void;
  th: typeof THEMES[ThemeKey];
  lang: LangCode;
  formatHour: (dt: number) => string;
  formatDay: (dt: number) => string;
}

export default function DetailModal({
  weather, detailModal, detailDayIndex, detailHourIndex, onClose,
  th, lang, formatHour, formatDay,
}: DetailModalProps) {
  if (!detailModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: themeBgToOpaqueRgba(th.bg, 0.94) }}
        className={`w-full max-w-sm rounded-3xl border p-6 space-y-4 max-h-[80vh] overflow-y-auto backdrop-blur-xl ${th.card.replace(/bg-\S+/g, "")}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-base ${th.textPrimary}`}>
            {detailModal === "alert" && t("alertDetailTitle", lang)}
            {detailModal === "uv" && t("uvIndex", lang)}
            {detailModal === "aq" && t("airQuality", lang)}
            {detailModal === "moon" && t("moonPhase", lang)}
            {detailModal === "day" && t("dayDetailTitle", lang, {
              day: detailDayIndex === 0 ? t("wxToday", lang) : formatDay(weather.daily[detailDayIndex]?.dt ?? 0),
            })}
            {detailModal === "hour" && weather.hourly[detailHourIndex] && t("hourDetailTitle", lang, {
              time: formatHour(weather.hourly[detailHourIndex].dt),
            })}
          </h3>
          <button onClick={onClose} className={th.textMuted}>
            <X size={20} />
          </button>
        </div>

        {detailModal === "alert" && weather.alerts[0] && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-red-500 shrink-0" />
              <p className={`text-sm font-semibold text-red-500`}>{t("alertGenericWarning", lang)}</p>
            </div>
            {weather.alerts[0].effect && (
              <div className={`rounded-2xl border p-3.5 space-y-2 ${th.header}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${th.textMuted}`}>
                  {t("alertRawContentLabel", lang)}
                </p>
                {isLikelyCorruptedAlertText(weather.alerts[0].effect) ? (
                  <p className={`text-sm italic leading-relaxed ${th.textMuted}`}>
                    {t("alertRawUnavailable", lang)}
                  </p>
                ) : (
                  <>
                    <p className={`text-base whitespace-pre-line leading-relaxed font-medium ${th.textPrimary}`}>
                      {weather.alerts[0].effect}
                    </p>
                    {weather.alerts[0].language && (
                      <p className={`text-[11px] italic pt-1 ${th.textMuted}`}>
                        {t("alertLanguageNote", lang, { language: weather.alerts[0].language })}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {detailModal === "uv" && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${th.textPrimary}`}>{weather.current.uvIndex}</span>
              <span className={`text-sm font-semibold ${getUvBand(weather.current.uvIndex).colorClass}`}>
                {t(getUvBand(weather.current.uvIndex).key, lang)}
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${th.textSecondary}`}>
              {t(getUvBand(weather.current.uvIndex).adviceKey, lang)}
            </p>
          </div>
        )}

        {detailModal === "aq" && weather.airQuality && (
          <div className="space-y-2.5">
            <p className={`text-sm font-semibold ${getAqiInfo(weather.airQuality.usEpaIndex).colorClass}`}>
              {t(getAqiInfo(weather.airQuality.usEpaIndex).key, lang)}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`rounded-xl border p-2.5 ${th.header}`}>
                <p className={`text-sm font-bold ${th.textPrimary}`}>{weather.airQuality.pm2_5}</p>
                <p className={`text-[10px] leading-tight ${th.textMuted}`}>{t("aqiDetailPm25", lang)}</p>
              </div>
              <div className={`rounded-xl border p-2.5 ${th.header}`}>
                <p className={`text-sm font-bold ${th.textPrimary}`}>{weather.airQuality.pm10}</p>
                <p className={`text-[10px] leading-tight ${th.textMuted}`}>{t("aqiDetailPm10", lang)}</p>
              </div>
              <div className={`rounded-xl border p-2.5 ${th.header}`}>
                <p className={`text-sm font-bold ${th.textPrimary}`}>{weather.airQuality.o3}</p>
                <p className={`text-[10px] leading-tight ${th.textMuted}`}>{t("aqiDetailO3", lang)}</p>
              </div>
            </div>
            <p className={`text-[10px] text-center ${th.textMuted}`}>µg/m³</p>
          </div>
        )}

        {detailModal === "moon" && weather.astronomy && (
          <div className="space-y-3">
            <p className={`text-base font-semibold ${th.textPrimary}`}>
              {t(getMoonPhaseKey(weather.astronomy.moonPhase), lang)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className={th.textMuted}>{t("moonIlluminationLabel", lang)}</span>
              <span className={`font-semibold ${th.textPrimary}`}>{weather.astronomy.moonIllumination}%</span>
            </div>
            {weather.astronomy.moonrise !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className={th.textMuted}>{t("moonriseLabel", lang)}</span>
                <span className={`font-semibold ${th.textPrimary}`}>{formatHour(weather.astronomy.moonrise)}</span>
              </div>
            )}
            {weather.astronomy.moonset !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className={th.textMuted}>{t("moonsetLabel", lang)}</span>
                <span className={`font-semibold ${th.textPrimary}`}>{formatHour(weather.astronomy.moonset)}</span>
              </div>
            )}
          </div>
        )}

        {detailModal === "day" && weather.dailyHourly[detailDayIndex] && (() => {
          const day = weather.daily[detailDayIndex];
          const dayMap = day ? getWeatherMapping(day.weatherCode, true) : null;
          const hours = weather.dailyHourly[detailDayIndex];
          const maxUvHour = hours.reduce<HourlyForecast | null>(
            (best, h) => (h.uvIndex !== undefined && (best === null || h.uvIndex > (best.uvIndex ?? -1)) ? h : best), null);
          const maxGustHour = hours.reduce<HourlyForecast | null>(
            (best, h) => (h.windGustMps !== undefined && (best === null || h.windGustMps > (best.windGustMps ?? -1)) ? h : best), null);
          const expectedPrecip = hours.reduce((s, h) => s + (h.precipMm ?? 0), 0);
          return (
            <div className="space-y-1 -mx-2">
              {day && (
                <div className={`rounded-2xl border p-3.5 mb-2 space-y-2 ${th.header}`}>
                  <div className="flex items-center gap-3">
                    {dayMap && <dayMap.iconName size={28} className={`${dayMap.colorClass} shrink-0`} />}
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${th.textPrimary}`}>
                        {t("dayDetailHighLow", lang, { max: String(day.tempMax), min: String(day.tempMin) })}
                      </p>
                      <p className={`text-xs flex items-center gap-1.5 ${day.pop > 0.1 ? th.accent2 : th.textMuted}`}>
                        <Umbrella size={12} />
                        {t("dayDetailRainChance", lang, { p: String(Math.round(day.pop * 100)) })}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t text-xs">
                    {maxUvHour && maxUvHour.uvIndex !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <SunMedium size={13} className={th.accent2} />
                        <span className={`font-semibold ${th.textPrimary}`}>{maxUvHour.uvIndex}</span>
                        <span className={th.textMuted}>{formatHour(maxUvHour.dt)}</span>
                      </div>
                    )}
                    {day.maxWindMps !== undefined && maxGustHour && (
                      <div className="flex items-center gap-1.5">
                        <Wind size={13} className={th.accent2} />
                        <span className={`font-semibold ${th.textPrimary}`}>{maxGustHour.windGustMps ?? day.maxWindMps} m/s</span>
                        <span className={th.textMuted}>{formatHour(maxGustHour.dt)}</span>
                      </div>
                    )}
                    {expectedPrecip > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Droplets size={13} className={th.accent2} />
                        <span className={`font-semibold ${th.textPrimary}`}>{(Math.round(expectedPrecip * 10) / 10).toFixed(1)} mm</span>
                        <span className={th.textMuted}>{t("hrPrecipMm", lang)}</span>
                      </div>
                    )}
                    {(day.chanceOfSnow ?? 0) > 0.05 && (
                      <div className="flex items-center gap-1.5">
                        <Snowflake size={13} className={th.accent2} />
                        <span className={`font-semibold ${th.textPrimary}`}>{Math.round((day.chanceOfSnow ?? 0) * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className={`flex items-center gap-2 px-2 pb-1.5 mb-1 border-b text-[10px] font-semibold uppercase tracking-wide ${th.header} ${th.textMuted}`}>
                <span className="w-11 shrink-0">{t("wxColHour", lang)}</span>
                <span className="w-4 shrink-0" />
                <span className="w-9 shrink-0 text-right">{t("wxColTemp", lang)}</span>
                <span className="w-12 shrink-0 text-right">{t("wxColRain", lang)}</span>
                <span className="w-8 shrink-0 text-right">{t("wxUvIndex", lang)}</span>
                <span className="w-12 shrink-0 text-right">{t("wxColHumidity", lang)}</span>
                <span className="w-14 shrink-0 text-right">{t("wxColWind", lang)}</span>
                <span className="flex-1 text-right">{t("wxColPressure", lang)}</span>
              </div>
              {weather.dailyHourly[detailDayIndex].map((h, idx) => {
                const m = getWeatherMapping(h.weatherCode, h.isDay);
                const uvBand = h.uvIndex !== undefined ? getUvBand(h.uvIndex) : null;
                return (
                  <div key={idx} className={`flex items-center gap-2 px-2 py-2 text-xs rounded-xl ${th.cardHover}`}>
                    <span className={`w-11 shrink-0 font-medium ${th.textPrimary}`}>{formatHour(h.dt)}</span>
                    <m.iconName size={16} className={`${m.colorClass} shrink-0`} />
                    <span className={`w-9 shrink-0 text-right font-semibold ${th.textPrimary}`}>{h.temperature}°</span>
                    <span className={`flex flex-col items-end w-12 shrink-0 ${h.pop > 0.1 ? th.accent2 : th.textMuted}`}>
                      <span>{Math.round(h.pop * 100)}%</span>
                      {h.precipMm !== undefined && h.precipMm > 0 && (
                        <span className="text-[9px]">{(Math.round(h.precipMm * 10) / 10).toFixed(1)}mm</span>
                      )}
                    </span>
                    <span className={`w-8 shrink-0 text-right font-semibold ${uvBand?.colorClass ?? th.textMuted}`}>
                      {h.uvIndex !== undefined ? h.uvIndex : "—"}
                    </span>
                    <span className={`flex items-center gap-0.5 w-12 shrink-0 justify-end ${th.textMuted}`}>
                      <Droplets size={11} />{h.humidity ?? "—"}%
                    </span>
                    <span className={`flex items-center gap-0.5 w-14 shrink-0 justify-end ${th.textMuted}`}>
                      <Wind size={11} />{h.windSpeed ?? "—"}
                    </span>
                    <span className={`flex items-center gap-0.5 flex-1 justify-end ${th.textMuted}`}>
                      <Gauge size={11} />{h.pressure ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      {detailModal === "hour" && weather.hourly[detailHourIndex] && (() => {
          const h = weather.hourly[detailHourIndex];
          const m = getWeatherMapping(h.weatherCode, h.isDay);
          const uvBand = h.uvIndex !== undefined ? getUvBand(h.uvIndex) : null;
          const cells: { icon: React.ReactNode; label: string; value: string; valueClass?: string }[] = [
            { icon: <SunMedium size={14} className={th.accent2} />, label: t("wxFeelsLike", lang), value: `${h.feelsLike}°`, valueClass: th.textPrimary },
            { icon: <Umbrella size={14} className={th.accent2} />, label: t("wxPop", lang), value: h.pop > 0 ? `${Math.round(h.pop * 100)}%` : "—", valueClass: h.pop > 0.25 ? th.accent2 : undefined },
            { icon: <Droplets size={14} className={th.accent2} />, label: t("hrPrecipMm", lang), value: h.precipMm !== undefined && h.precipMm > 0 ? `${(Math.round(h.precipMm * 10) / 10).toFixed(1)}mm` : "—", valueClass: undefined },
            { icon: <Cloud size={14} className={th.accent2} />, label: t("hrCloud", lang), value: h.cloudPct !== undefined ? `%${h.cloudPct}` : "—", valueClass: undefined },
            { icon: <SunMedium size={14} className={th.accent2} />, label: t("wxUvIndex", lang), value: h.uvIndex !== undefined ? String(h.uvIndex) : "—", valueClass: uvBand?.colorClass },
            { icon: <Snowflake size={14} className={th.accent2} />, label: t("hrSnowChance", lang), value: (h.chanceOfSnow ?? 0) > 0.05 ? `%${Math.round((h.chanceOfSnow ?? 0) * 100)}` : "—", valueClass: undefined },
            { icon: <Wind size={14} className={th.accent2} />, label: t("wxWind", lang), value: h.windSpeed !== undefined ? `${h.windSpeed} m/s` : "—", valueClass: undefined },
            { icon: <Wind size={14} className={th.accent2} />, label: t("hrGust", lang), value: h.windGustMps !== undefined ? `${h.windGustMps} m/s` : "—", valueClass: undefined },
            { icon: <Droplets size={14} className={th.accent2} />, label: t("wxHumidity", lang), value: h.humidity !== undefined ? `%${h.humidity}` : "—", valueClass: undefined },
            { icon: <Gauge size={14} className={th.accent2} />, label: t("wxPressure", lang), value: h.pressure !== undefined ? String(h.pressure) : "—", valueClass: undefined },
            { icon: <Eye size={14} className={th.accent2} />, label: t("wxVisibility", lang), value: h.visibilityKm !== undefined ? `${h.visibilityKm} km` : "—", valueClass: undefined },
          ];
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <m.iconName size={40} className={m.colorClass} />
                <div>
                  <p className={`text-3xl font-bold font-mono ${th.textPrimary}`}>{h.temperature}°</p>
                  <p className={`text-sm capitalize font-medium ${th.textSecondary}`}>{t(m.descKey, lang)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {cells.map((c, i) => (
                  <div key={i} className={`rounded-xl border p-2.5 flex flex-col items-center gap-1 ${th.header}`}>
                    {c.icon}
                    <p className={`text-sm font-bold ${c.valueClass ?? th.textPrimary}`}>{c.value}</p>
                    <p className={`text-[10px] leading-tight ${th.textMuted}`}>{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}