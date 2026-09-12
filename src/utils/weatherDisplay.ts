import type { LangCode } from "./i18n";

// Dile göre Intl locale kodu — gün/ay isimleri (formatDay) ve saat
// biçimi artık seçili dile göre değişiyor, sabit "tr-TR" değil.
export const INTL_LOCALE: Record<LangCode, string> = {
  tr: "tr-TR", en: "en-US", de: "de-DE", ar: "ar-SA", ur: "ur-PK",
};

export function intlLocaleOf(lang: LangCode): string {
  return INTL_LOCALE[lang] || "en-US";
}

export function formatHour(dt: number, timezone: string | undefined, lang: LangCode): string {
  return new Intl.DateTimeFormat(intlLocaleOf(lang), {
    hour: "2-digit", minute: "2-digit", timeZone: timezone || "Europe/Istanbul",
  }).format(new Date(dt * 1000));
}

export function formatDay(dt: number, timezone: string | undefined, lang: LangCode): string {
  return new Intl.DateTimeFormat(intlLocaleOf(lang), {
    weekday: "short", day: "numeric", month: "short", timeZone: timezone || "Europe/Istanbul",
  }).format(new Date(dt * 1000));
}

// US EPA index (1-6) → i18n anahtarı + renk sınıfı
export function getAqiInfo(usEpaIndex: number): { key: string; colorClass: string } {
  switch (usEpaIndex) {
    case 1: return { key: "aqiGood", colorClass: "text-emerald-500" };
    case 2: return { key: "aqiModerate", colorClass: "text-yellow-500" };
    case 3: return { key: "aqiUnhealthySensitive", colorClass: "text-orange-500" };
    case 4: return { key: "aqiUnhealthy", colorClass: "text-red-500" };
    case 5: return { key: "aqiVeryUnhealthy", colorClass: "text-purple-500" };
    case 6: return { key: "aqiHazardous", colorClass: "text-rose-700" };
    default: return { key: "aqiUnknown", colorClass: "text-slate-400" };
  }
}

// WeatherAPI'nin İngilizce ay evresi metni → i18n anahtarı
export const MOON_PHASE_KEYS: Record<string, string> = {
  "New Moon": "moonNew", "Waxing Crescent": "moonWaxingCrescent",
  "First Quarter": "moonFirstQuarter", "Waxing Gibbous": "moonWaxingGibbous",
  "Full Moon": "moonFull", "Waning Gibbous": "moonWaningGibbous",
  "Last Quarter": "moonLastQuarter", "Waning Crescent": "moonWaningCrescent",
};
export const getMoonPhaseKey = (phase: string) => MOON_PHASE_KEYS[phase] || "moonUnknown";

// UV indeksi → risk bandı (WHO standardı) + tavsiye metni anahtarları
export function getUvBand(uv: number): { key: string; adviceKey: string; colorClass: string } {
  if (uv < 3) return { key: "uvLow", adviceKey: "uvAdviceLow", colorClass: "text-emerald-500" };
  if (uv < 6) return { key: "uvModerate", adviceKey: "uvAdviceModerate", colorClass: "text-yellow-500" };
  if (uv < 8) return { key: "uvHigh", adviceKey: "uvAdviceHigh", colorClass: "text-orange-500" };
  if (uv < 11) return { key: "uvVeryHigh", adviceKey: "uvAdviceVeryHigh", colorClass: "text-red-500" };
  return { key: "uvExtreme", adviceKey: "uvAdviceExtreme", colorClass: "text-purple-500" };
}