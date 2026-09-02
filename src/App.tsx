import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import {
  MapPin, Search, X, Settings, Palette, Check, Plus, Trash2,
  Navigation, Droplets, Wind, Umbrella, Gauge, Sunrise, Sunset,
  ChevronsDown, CloudSun, Mail, Shield, SunMedium, Leaf, Moon, AlertTriangle,
} from "lucide-react";
import { Location } from "./types";
export type FontScale = "normal" | "large" | "xlarge";
import { TURKEY_PROVINCES, PAKISTAN_CITIES } from "./utils/cityData";
import { getWeatherMapping } from "./utils/weatherHelper";
import { fetchWeatherBundle, WeatherServiceError } from "./services/weatherService";
import { requestLocationPermission, getCurrentPosition } from "./utils/locationHelper";
import { t, detectLanguage, LangCode } from "./utils/i18n";
import { showBannerAd, onBannerHeightChange, unlockWithRewardedInterstitial, isRewardedUnlockedThisSession } from "./services/adMobService";
import type { WeatherBundle } from "./types";

/**
 * th.card sınıfları (ör. "bg-slate-900/40") kart arka planlarında hafif/cam
 * efekti için bilinçli olarak yarı saydam tutuluyor. Ama tam ekran bir
 * modal/detay penceresinde bu saydamlık okunabilirliği düşürüyor. Bu yüzden
 * modal arka planı için, th.bg'deki tema rengini (ör. "bg-[#020617]")
 * çok daha opak bir rgba'ya çevirip inline style ile uyguluyoruz — th.card'ı
 * (ve onu kullanan diğer tüm kartları) etkilemeden.
 */
function themeBgToOpaqueRgba(bgClass: string, alpha: number): string {
  const match = bgClass.match(/#([0-9a-fA-F]{6})/);
  if (!match) return `rgba(15, 23, 42, ${alpha})`; // güvenli varsayılan (slate-900)
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * ============================================================================
 * TEMALAR — Meccanen Namaz Vakti'nden BİREBİR taşındı, hiç değiştirilmedi.
 * Aynı 16 tema, aynı renk paleti, aynı Tailwind sınıfları.
 * ============================================================================
 */
export const THEMES = {
  gece: {
    label: "Gece Mavisi", preview: ["#020617","#0ea5e9","#818cf8"],
    bg: "bg-[#020617]", card: "bg-slate-900/40 border-slate-800/80",
    cardHover: "hover:border-slate-700/60", header: "border-slate-800/80",
    accent: "text-sky-400", accent2: "text-indigo-400", accent3: "text-amber-300",
    prayerActive: "bg-gradient-to-b from-amber-500/10 to-amber-500/25 border-amber-500/30 text-amber-300 ring-amber-500/20",
    clockGrad: "from-white to-slate-200", secColor: "text-sky-400",
    blob1: "bg-indigo-500/5", blob2: "bg-sky-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-amber-400", settingsCard: "bg-slate-900/95 border-slate-700",
  },
  alacakaranlik: {
    label: "Alacakaranlık", preview: ["#1a0a2e","#e879f9","#f59e0b"],
    bg: "bg-[#1a0a2e]", card: "bg-purple-950/30 border-purple-900/30",
    cardHover: "hover:border-purple-700/40", header: "border-purple-900/40",
    accent: "text-fuchsia-400", accent2: "text-purple-400", accent3: "text-amber-300",
    prayerActive: "bg-gradient-to-b from-fuchsia-500/10 to-fuchsia-500/25 border-fuchsia-500/30 text-fuchsia-300 ring-fuchsia-500/20",
    clockGrad: "from-fuchsia-100 to-purple-200", secColor: "text-fuchsia-400",
    blob1: "bg-fuchsia-500/5", blob2: "bg-purple-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-fuchsia-400", settingsCard: "bg-purple-950/95 border-purple-700",
  },
  orman: {
    label: "Orman Yeşili", preview: ["#051a0f","#34d399","#a3e635"],
    bg: "bg-[#051a0f]", card: "bg-emerald-950/30 border-emerald-900/30",
    cardHover: "hover:border-emerald-700/40", header: "border-emerald-900/40",
    accent: "text-emerald-400", accent2: "text-lime-400", accent3: "text-amber-300",
    prayerActive: "bg-gradient-to-b from-emerald-500/10 to-emerald-500/25 border-emerald-500/30 text-emerald-300 ring-emerald-500/20",
    clockGrad: "from-emerald-100 to-lime-200", secColor: "text-emerald-400",
    blob1: "bg-emerald-500/5", blob2: "bg-lime-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-lime-400", settingsCard: "bg-emerald-950/95 border-emerald-700",
  },
  altin: {
    label: "Altın Çöl", preview: ["#160d00","#f59e0b","#fb923c"],
    bg: "bg-[#160d00]", card: "bg-amber-950/30 border-amber-900/30",
    cardHover: "hover:border-amber-700/40", header: "border-amber-900/40",
    accent: "text-amber-400", accent2: "text-orange-400", accent3: "text-yellow-300",
    prayerActive: "bg-gradient-to-b from-amber-500/10 to-amber-500/25 border-amber-500/30 text-amber-300 ring-amber-500/20",
    clockGrad: "from-amber-100 to-orange-200", secColor: "text-amber-400",
    blob1: "bg-amber-500/5", blob2: "bg-orange-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-orange-400", settingsCard: "bg-amber-950/95 border-amber-700",
  },
  ramazan: {
    label: "Ramazan", preview: ["#0d0a1a","#c084fc","#fde68a"],
    bg: "bg-[#0d0a1a]", card: "bg-violet-950/30 border-violet-900/30",
    cardHover: "hover:border-violet-700/40", header: "border-violet-900/40",
    accent: "text-violet-300", accent2: "text-yellow-300", accent3: "text-rose-300",
    prayerActive: "bg-gradient-to-b from-violet-500/10 to-violet-500/25 border-violet-500/30 text-violet-200 ring-violet-500/20",
    clockGrad: "from-violet-100 to-yellow-200", secColor: "text-violet-300",
    blob1: "bg-violet-500/5", blob2: "bg-yellow-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-yellow-300", settingsCard: "bg-violet-950/95 border-violet-800",
  },
  kabe: {
    label: "Kâbe", preview: ["#0a0a0a","#d4af37","#ffffff"],
    bg: "bg-[#0a0a0a]", card: "bg-neutral-900/60 border-neutral-800/60",
    cardHover: "hover:border-neutral-700/50", header: "border-neutral-800/60",
    accent: "text-yellow-500", accent2: "text-yellow-300", accent3: "text-white",
    prayerActive: "bg-gradient-to-b from-yellow-500/10 to-yellow-500/20 border-yellow-500/30 text-yellow-300 ring-yellow-500/20",
    clockGrad: "from-yellow-200 to-white", secColor: "text-yellow-500",
    blob1: "bg-yellow-500/3", blob2: "bg-white/3",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-yellow-400", settingsCard: "bg-neutral-900/95 border-neutral-700",
  },
  turkuaz: {
    label: "Turkuaz Deniz", preview: ["#010f14","#06b6d4","#67e8f9"],
    bg: "bg-[#010f14]", card: "bg-cyan-950/30 border-cyan-900/30",
    cardHover: "hover:border-cyan-700/40", header: "border-cyan-900/40",
    accent: "text-cyan-400", accent2: "text-teal-400", accent3: "text-sky-200",
    prayerActive: "bg-gradient-to-b from-cyan-500/10 to-cyan-500/25 border-cyan-500/30 text-cyan-300 ring-cyan-500/20",
    clockGrad: "from-cyan-100 to-teal-200", secColor: "text-cyan-400",
    blob1: "bg-cyan-500/5", blob2: "bg-teal-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-teal-400", settingsCard: "bg-cyan-950/95 border-cyan-800",
  },
  bordo: {
    label: "Bordo Kadife", preview: ["#1a0008","#f43f5e","#fda4af"],
    bg: "bg-[#1a0008]", card: "bg-rose-950/30 border-rose-900/30",
    cardHover: "hover:border-rose-700/40", header: "border-rose-900/40",
    accent: "text-rose-400", accent2: "text-pink-400", accent3: "text-orange-300",
    prayerActive: "bg-gradient-to-b from-rose-500/10 to-rose-500/25 border-rose-500/30 text-rose-300 ring-rose-500/20",
    clockGrad: "from-rose-100 to-pink-200", secColor: "text-rose-400",
    blob1: "bg-rose-500/5", blob2: "bg-pink-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-pink-400", settingsCard: "bg-rose-950/95 border-rose-800",
  },
  gunes: {
    label: "Gün Batımı", preview: ["#1a0d00","#f97316","#fbbf24"],
    bg: "bg-[#1a0d00]", card: "bg-orange-950/30 border-orange-900/30",
    cardHover: "hover:border-orange-700/40", header: "border-orange-900/40",
    accent: "text-orange-400", accent2: "text-amber-300", accent3: "text-yellow-200",
    prayerActive: "bg-gradient-to-b from-orange-500/10 to-orange-500/25 border-orange-500/30 text-orange-300 ring-orange-500/20",
    clockGrad: "from-orange-100 to-amber-200", secColor: "text-orange-400",
    blob1: "bg-orange-500/5", blob2: "bg-amber-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-amber-300", settingsCard: "bg-orange-950/95 border-orange-800",
  },
  safir: {
    label: "Safir Gece", preview: ["#00051a","#3b82f6","#a5b4fc"],
    bg: "bg-[#00051a]", card: "bg-blue-950/30 border-blue-900/30",
    cardHover: "hover:border-blue-700/40", header: "border-blue-900/40",
    accent: "text-blue-400", accent2: "text-indigo-300", accent3: "text-sky-200",
    prayerActive: "bg-gradient-to-b from-blue-500/10 to-blue-500/25 border-blue-500/30 text-blue-300 ring-blue-500/20",
    clockGrad: "from-blue-100 to-indigo-200", secColor: "text-blue-400",
    blob1: "bg-blue-500/5", blob2: "bg-indigo-500/5",
    textPrimary: "text-slate-100", textSecondary: "text-slate-400", textMuted: "text-slate-500",
    hijriAccent: "text-indigo-300", settingsCard: "bg-blue-950/95 border-blue-800",
  },
  seher: {
    label: "Beyaz Seher", preview: ["#fefce8","#d97706","#92400e"],
    bg: "bg-[#fefce8]", card: "bg-white/70 border-amber-200/80",
    cardHover: "hover:border-amber-300/60", header: "border-amber-200/60",
    accent: "text-amber-700", accent2: "text-orange-600", accent3: "text-amber-900",
    prayerActive: "bg-gradient-to-b from-amber-400/20 to-amber-400/35 border-amber-500/40 text-amber-800 ring-amber-400/30",
    clockGrad: "from-amber-900 to-orange-800", secColor: "text-amber-600",
    blob1: "bg-amber-300/20", blob2: "bg-orange-200/20",
    textPrimary: "text-amber-950", textSecondary: "text-amber-800", textMuted: "text-amber-600",
    hijriAccent: "text-orange-700", settingsCard: "bg-white/98 border-amber-200",
  },
  gul: {
    label: "Gül Bahçesi", preview: ["#fff1f2","#e11d48","#9f1239"],
    bg: "bg-[#fff1f2]", card: "bg-white/70 border-rose-200/80",
    cardHover: "hover:border-rose-300/60", header: "border-rose-200/60",
    accent: "text-rose-600", accent2: "text-pink-600", accent3: "text-rose-800",
    prayerActive: "bg-gradient-to-b from-rose-400/20 to-rose-400/35 border-rose-500/40 text-rose-700 ring-rose-400/30",
    clockGrad: "from-rose-900 to-pink-800", secColor: "text-rose-500",
    blob1: "bg-rose-300/20", blob2: "bg-pink-200/20",
    textPrimary: "text-rose-950", textSecondary: "text-rose-700", textMuted: "text-rose-500",
    hijriAccent: "text-rose-700", settingsCard: "bg-white/98 border-rose-200",
  },
  nane: {
    label: "Nane Yeşili", preview: ["#f0fdf4","#16a34a","#14532d"],
    bg: "bg-[#f0fdf4]", card: "bg-white/70 border-green-200/80",
    cardHover: "hover:border-green-300/60", header: "border-green-200/60",
    accent: "text-green-700", accent2: "text-emerald-600", accent3: "text-green-900",
    prayerActive: "bg-gradient-to-b from-green-400/20 to-green-400/35 border-green-500/40 text-green-800 ring-green-400/30",
    clockGrad: "from-green-900 to-emerald-800", secColor: "text-green-600",
    blob1: "bg-green-300/20", blob2: "bg-emerald-200/20",
    textPrimary: "text-green-950", textSecondary: "text-green-700", textMuted: "text-green-500",
    hijriAccent: "text-emerald-700", settingsCard: "bg-white/98 border-green-200",
  },
  vaha: {
    label: "Yeşil Vaha", preview: ["#e6fbf5","#0f766e","#3730a3"],
    bg: "bg-[#e6fbf5]", card: "bg-white/70 border-teal-200/80",
    cardHover: "hover:border-teal-300/60", header: "border-teal-200/60",
    accent: "text-indigo-700", accent2: "text-teal-600", accent3: "text-indigo-900",
    prayerActive: "bg-gradient-to-b from-indigo-400/20 to-indigo-400/35 border-indigo-500/40 text-indigo-800 ring-indigo-400/30",
    clockGrad: "from-indigo-900 to-teal-800", secColor: "text-indigo-600",
    blob1: "bg-teal-300/20", blob2: "bg-indigo-200/20",
    textPrimary: "text-teal-950", textSecondary: "text-teal-800", textMuted: "text-teal-600",
    hijriAccent: "text-indigo-700", settingsCard: "bg-white/98 border-teal-200",
  },
  nilufer: {
    label: "Nilüfer Bahçesi", preview: ["#e6fbf5","#0f766e","#e11d48"],
    bg: "bg-[#e6fbf5]", card: "bg-white/70 border-teal-200/80",
    cardHover: "hover:border-teal-300/60", header: "border-teal-200/60",
    accent: "text-rose-600", accent2: "text-teal-600", accent3: "text-rose-800",
    prayerActive: "bg-gradient-to-b from-rose-400/20 to-rose-400/35 border-rose-500/40 text-rose-700 ring-rose-400/30",
    clockGrad: "from-rose-800 to-teal-800", secColor: "text-rose-500",
    blob1: "bg-teal-300/20", blob2: "bg-rose-200/20",
    textPrimary: "text-teal-950", textSecondary: "text-teal-800", textMuted: "text-teal-600",
    hijriAccent: "text-rose-600", settingsCard: "bg-white/98 border-teal-200",
  },
  lavanta: {
    label: "Lavanta Bahçesi", preview: ["#f5f3ff","#7c3aed","#b45309"],
    bg: "bg-[#f5f3ff]", card: "bg-white/70 border-violet-200/80",
    cardHover: "hover:border-violet-300/60", header: "border-violet-200/60",
    accent: "text-violet-700", accent2: "text-amber-600", accent3: "text-violet-900",
    prayerActive: "bg-gradient-to-b from-violet-400/20 to-violet-400/35 border-violet-500/40 text-violet-800 ring-violet-400/30",
    clockGrad: "from-violet-900 to-amber-800", secColor: "text-violet-600",
    blob1: "bg-violet-300/20", blob2: "bg-amber-200/20",
    textPrimary: "text-violet-950", textSecondary: "text-violet-800", textMuted: "text-violet-600",
    hijriAccent: "text-amber-700", settingsCard: "bg-white/98 border-violet-200",
  },
} as const;
export type ThemeKey = keyof typeof THEMES;
const isLight = (key: ThemeKey) => (["seher","gul","nane","vaha","nilufer","lavanta"] as ThemeKey[]).includes(key);

function guessTimezone(lng: number): string {
  const offset = Math.round(lng / 15);
  const MAP: Record<string, string> = {
    "-12":"Etc/GMT+12","-11":"Pacific/Midway","-10":"Pacific/Honolulu","-9":"America/Anchorage",
    "-8":"America/Los_Angeles","-7":"America/Denver","-6":"America/Chicago","-5":"America/New_York",
    "-4":"America/Halifax","-3":"America/Sao_Paulo","-2":"Atlantic/South_Georgia","-1":"Atlantic/Azores",
    "0":"Europe/London","1":"Europe/Berlin","2":"Europe/Helsinki","3":"Europe/Istanbul",
    "4":"Asia/Dubai","5":"Asia/Karachi","6":"Asia/Dhaka","7":"Asia/Bangkok",
    "8":"Asia/Singapore","9":"Asia/Tokyo","10":"Australia/Sydney","11":"Pacific/Noumea","12":"Pacific/Auckland",
  };
  return MAP[String(offset)] || "Europe/London";
}

const APP_VERSION = "0.1.0";

const DEFAULT_LOCATION: Location = {
  name: "İstanbul", country: "Türkiye",
  latitude: 41.0082, longitude: 28.9784,
  timezone: "Europe/Istanbul", admin1: "Marmara"
};

/**
 * ============================================================================
 * AYARLAR PANELİ — Tema / Konum / Hakkında (Destekçi Rozeti dahil).
 * ============================================================================
 */
function SettingsPanel({
  theme, setTheme, location, setLocation,
  savedLocations, setSavedLocations,
  onClose, th, lang, setLang,
  onFindLocation, isDetectingLocation,
  autoLocationEnabled, onToggleAutoLocation,
  initialTab,
}: {
  theme: ThemeKey; setTheme: (k: ThemeKey) => void;
  location: Location; setLocation: (l: Location) => void;
  savedLocations: Location[]; setSavedLocations: (locs: Location[]) => void;
  onClose: () => void; th: typeof THEMES[ThemeKey];
  lang: LangCode; setLang: (l: LangCode) => void;
  onFindLocation: () => void; isDetectingLocation: boolean;
  autoLocationEnabled: boolean; onToggleAutoLocation: (val: boolean) => void;
  initialTab?: "tema" | "konum" | "dil" | "hakkinda";
}) {
  const [tab, setTab] = useState<"tema" | "konum" | "dil" | "hakkinda">(initialTab || "tema");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [notification, setNotification] = useState("");
  const MAX_LOCATIONS = 33;

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const performSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true); setSearchError(""); setSearchResults([]);
    try {
      const apiLang = lang === "ur" ? "ar" : lang;
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${apiLang}`);
      const data = await res.json();
      if (data.results?.length) {
        setSearchResults(data.results.map((r: any) => ({
          name: r.name, country: r.country || t("unknown", lang),
          latitude: r.latitude, longitude: r.longitude,
          timezone: r.timezone && r.timezone !== "GMT" && r.timezone !== "UTC"
            ? r.timezone : guessTimezone(r.longitude),
          admin1: r.admin1 || ""
        })));
      } else setSearchError(t("noResults", lang));
    } catch { setSearchError(t("searchError", lang)); }
    finally { setIsSearching(false); }
  };

  const addAndSelectCity = (loc: Location) => {
    const exists = savedLocations.some(l =>
      l.latitude.toFixed(2) === loc.latitude.toFixed(2) &&
      l.longitude.toFixed(2) === loc.longitude.toFixed(2)
    );
    if (!exists && savedLocations.length >= MAX_LOCATIONS) {
      notify(t("maxLocations", lang, { n: String(MAX_LOCATIONS) }));
      return;
    }
    const newList = exists ? savedLocations : [...savedLocations, loc];
    setSavedLocations(newList);
    setLocation(loc);
    localStorage.setItem("mhd_auto_location", "false");
    onToggleAutoLocation(false);
    setSearchResults([]); setSearchQuery("");
    notify(t("citySelected", lang, { city: loc.name, country: loc.country }));
  };

  const selectSaved = (loc: Location) => { setLocation(loc); notify(t("citySelected", lang, { city: loc.name, country: loc.country })); };

  const deleteSaved = (idx: number) => {
    const next = savedLocations.filter((_, i) => i !== idx);
    setSavedLocations(next);
    if (location.latitude === savedLocations[idx].latitude) setLocation(next[0] || DEFAULT_LOCATION);
  };

  const LANGUAGES: { code: LangCode; label: string }[] = [
    { code: "tr", label: "Türkçe" }, { code: "en", label: "English" },
    { code: "de", label: "Deutsch" }, { code: "ar", label: "العربية" },
    { code: "ur", label: "اردو" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 px-3 pb-3 sm:pt-8 sm:px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-lg rounded-[28px] border ${th.settingsCard} max-h-[92vh] flex flex-col`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${th.header}`}>
          <h2 className={`font-semibold text-lg ${th.textPrimary}`}>{t("settings", lang)}</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${th.cardHover} ${th.textSecondary}`}><X size={18}/></button>
        </div>

        <div className={`flex border-b ${th.header} px-2`}>
          {(["tema","konum","dil","hakkinda"] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`flex-1 py-3 text-sm font-medium transition ${tab === tb ? th.accent : th.textMuted}`}>
              {tb === "tema" ? t("themeTab", lang) : tb === "konum" ? t("location", lang) : tb === "dil" ? t("language", lang) : t("about", lang)}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {notification && (
            <div className={`text-sm px-3 py-2 rounded-xl ${th.card} ${th.accent} animate-fadeIn`}>{notification}</div>
          )}

          {tab === "tema" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
              {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, cardTh]) => (
                <button key={key} onClick={() => setTheme(key)}
                  className={`relative rounded-2xl border p-3 text-left transition ${cardTh.card} ${cardTh.cardHover} ${theme === key ? "ring-2 ring-offset-2 ring-offset-transparent " + cardTh.accent : ""}`}>
                  <div className="flex gap-1 mb-2">
                    {cardTh.preview.map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ background: c }} />
                    ))}
                  </div>
                  <div className={`text-xs font-medium ${cardTh.textPrimary}`}>{t(`theme_${key}`, lang)}</div>
                  {theme === key && <Check size={14} className={`absolute top-2 right-2 ${cardTh.accent}`} />}
                </button>
              ))}
              </div>
            </div>
          )}

          {tab === "konum" && (
            <div className="space-y-4">
              <button onClick={onFindLocation} disabled={isDetectingLocation}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border ${th.card} ${th.cardHover} ${th.accent} font-medium text-sm`}>
                <Navigation size={16} className={isDetectingLocation ? "animate-spin" : ""} />
                {t("findMyLocation", lang)}
              </button>

              <div className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border ${th.card}`}>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${th.textPrimary}`}>{t("autoLocation", lang)}</p>
                  <p className={`text-xs ${th.textMuted}`}>{t("autoLocationDesc", lang)}</p>
                </div>
                <button
                  role="switch" aria-checked={autoLocationEnabled}
                  onClick={() => onToggleAutoLocation(!autoLocationEnabled)}
                  className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${autoLocationEnabled ? th.accent + " bg-current" : "bg-black/20"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoLocationEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex gap-2">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && performSearch()}
                  placeholder={t("searchCity", lang)}
                  className={`flex-1 px-3 py-2 rounded-xl border bg-transparent text-sm ${th.card} ${th.textPrimary} outline-none`} />
                <button onClick={performSearch} disabled={isSearching}
                  className={`px-3 rounded-xl border ${th.card} ${th.accent}`}><Search size={16}/></button>
              </div>
              {searchError && <p className={`text-xs ${th.textMuted}`}>{searchError}</p>}
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => addAndSelectCity(r)}
                      className={`w-full text-left px-3 py-2 rounded-xl border ${th.card} ${th.cardHover} text-sm ${th.textPrimary}`}>
                      {r.name}, {r.admin1 ? r.admin1 + ", " : ""}{r.country}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className={`text-xs uppercase tracking-wide ${th.textMuted}`}>{t("location", lang)}</p>
                {savedLocations.map((l, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${th.card} ${location.latitude === l.latitude && location.longitude === l.longitude ? th.accent : th.textPrimary}`}>
                    <button onClick={() => selectSaved(l)} className="flex items-center gap-2 text-sm flex-1 text-left">
                      <MapPin size={14} /> {l.name}, {l.country}
                    </button>
                    <button onClick={() => deleteSaved(i)} className={th.textMuted}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>

              {lang === "tr" && (
                <div className="space-y-1 pt-2">
                  <p className={`text-xs uppercase tracking-wide ${th.textMuted}`}>{t("turkeyProvinces", lang)}</p>
                  <select onChange={e => {
                    const p = TURKEY_PROVINCES.find(x => x.name === e.target.value);
                    if (p) addAndSelectCity({ name: p.name, country: "Türkiye", latitude: p.latitude, longitude: p.longitude, timezone: "Europe/Istanbul", admin1: "Türkiye" });
                  }} className={`w-full px-3 py-2 rounded-xl border bg-transparent text-sm ${th.card} ${th.textPrimary}`}>
                    <option value="">{t("select", lang)}</option>
                    {TURKEY_PROVINCES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {lang === "ur" && (
                <div className="space-y-1 pt-2" dir="rtl">
                  <p className={`text-xs uppercase tracking-wide ${th.textMuted}`}>{t("pakistanCities", lang)}</p>
                  <select onChange={e => {
                    const p = PAKISTAN_CITIES.find(x => x.id === Number(e.target.value));
                    if (p) addAndSelectCity({ name: p.name, country: "Pakistan", latitude: p.latitude, longitude: p.longitude, timezone: "Asia/Karachi", admin1: "Pakistan" });
                  }} className={`w-full px-3 py-2 rounded-xl border bg-transparent text-sm ${th.card} ${th.textPrimary}`} dir="rtl">
                    <option value="">{t("select", lang)}</option>
                    {PAKISTAN_CITIES.map(p => <option key={p.id} value={p.id}>{p.urdu}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {tab === "dil" && (
            <div className="space-y-2">
              <p className={`text-xs uppercase tracking-wide ${th.textMuted}`}>{t("language", lang)}</p>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => setLang(l.code)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border transition ${th.card} ${th.cardHover} ${lang === l.code ? th.accent + " ring-2 ring-offset-2 ring-offset-transparent " + th.accent : th.textMuted}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "hakkinda" && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h3 className={`font-semibold ${th.textPrimary}`}>{t("appName", lang)}</h3>
                <p className={`text-xs ${th.textMuted}`}>v{APP_VERSION}</p>
              </div>

              <div className={`rounded-2xl border p-4 space-y-3 ${th.card}`}>
                <p className={`text-sm leading-relaxed ${th.textSecondary}`}>{t("aboutDescription", lang)}</p>
              </div>

              <div className={`rounded-2xl border p-4 space-y-3 ${th.card}`}>
                <h4 className={`font-medium text-sm ${th.textPrimary}`}>{t("aboutFeaturesTitle", lang)}</h4>
                <ul className="space-y-2">
                  {(["aboutFeature1", "aboutFeature2", "aboutFeature3", "aboutFeature4"] as const).map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check size={15} className={`mt-0.5 shrink-0 ${th.accent}`} />
                      <span className={`text-xs leading-relaxed ${th.textSecondary}`}>{t(key, lang)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`rounded-2xl border p-4 space-y-3 ${th.card}`}>
                <a href="https://meccanen.github.io/Hava_Durumu/privacy-policy-en.html" target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2 text-xs font-medium ${th.accent}`}>
                  <Shield size={15} />
                  {t("aboutPrivacyLink", lang)}
                </a>
                <a href="mailto:meccanen@meccanen.xyz"
                  className={`flex items-center gap-2 text-xs ${th.textSecondary}`}>
                  <Mail size={15} />
                  {t("aboutContact", lang)}
                </a>
              </div>

              <p className={`text-center text-xs ${th.textMuted}`}>{t("aboutFooter", lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * ANA UYGULAMA
 * ============================================================================
 */
export default function App() {
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem("mhd_theme") as ThemeKey;
    return saved && THEMES[saved] ? saved : "gece";
  });
  const setTheme = (key: ThemeKey) => { setThemeKey(key); localStorage.setItem("mhd_theme", key); };
  const th = THEMES[themeKey];

  const [lang, setLangState] = useState<LangCode>(
    () => (localStorage.getItem("mhd_lang") as LangCode) || detectLanguage()
  );
  const setLang = (l: LangCode) => { setLangState(l); localStorage.setItem("mhd_lang", l); };

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const saved = localStorage.getItem("mhd_font_scale") as FontScale | null;
    return saved === "normal" || saved === "large" || saved === "xlarge" ? saved : "large";
  });
  const setFontScale = (f: FontScale) => { setFontScaleState(f); localStorage.setItem("mhd_font_scale", f); };
  useEffect(() => {
    document.documentElement.classList.remove("font-scale-normal", "font-scale-large", "font-scale-xlarge");
    document.documentElement.classList.add(`font-scale-${fontScale}`);
  }, [fontScale]);

  const [location, setLocationState] = useState<Location>(() => {
    try { const s = localStorage.getItem("mhd_location"); return s ? JSON.parse(s) : DEFAULT_LOCATION; }
    catch { return DEFAULT_LOCATION; }
  });
  const setLocationAndSave = (loc: Location) => { setLocationState(loc); localStorage.setItem("mhd_location", JSON.stringify(loc)); };

  const [savedLocations, setSavedLocationsState] = useState<Location[]>(() => {
    try { const s = localStorage.getItem("mhd_saved_locations"); return s ? JSON.parse(s) : [DEFAULT_LOCATION]; }
    catch { return [DEFAULT_LOCATION]; }
  });
  const setSavedLocations = (locs: Location[]) => { setSavedLocationsState(locs); localStorage.setItem("mhd_saved_locations", JSON.stringify(locs)); };

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"tema"|"konum"|"dil"|"hakkinda">("tema");

  const [autoLocationEnabled, setAutoLocationEnabled] = useState(
    () => localStorage.getItem("mhd_auto_location") === "true"
  );
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(
    () => !localStorage.getItem("mhd_location_prompted")
  );

  // ---- Hava durumu verisi ----
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const loadWeather = async () => {
    setWeatherLoading(true); setWeatherError(null);
    try {
      const bundle = await fetchWeatherBundle(location.latitude, location.longitude);
      setWeather(bundle);
    } catch (e) {
      const msg = e instanceof WeatherServiceError ? e.message : t("wxError", lang);
      setWeatherError(msg);
      console.log("[Meccanen HD] Hava durumu alınamadı:", e);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => { loadWeather(); }, [location.latitude, location.longitude, lang]);

  // ---- AdMob banner ----
  // NOT: Şu an herkese reklam gösteriliyor. Abonelik sistemi (aylık/yıllık,
  // reklamları kaldıran) devreye girdiğinde bu effect abonelik durumuna göre
  // koşullu hale getirilecek.
  const [bannerHeight, setBannerHeight] = useState(0);

  // ---- Ödüllü reklamla açılan detay ekranları (UV / Hava Kalitesi / Ay Evresi / Uyarı / Gün) ----
  type DetailKind = "alert" | "uv" | "aq" | "moon" | "day";
  const [detailModal, setDetailModal] = useState<DetailKind | null>(null);
  const [detailDayIndex, setDetailDayIndex] = useState<number>(0);
  const [unlockingDetail, setUnlockingDetail] = useState<string | null>(null);

  const handleOpenDetail = async (kind: DetailKind, dayIndex?: number) => {
    const unlockKey = kind === "day" ? `day-${dayIndex}` : kind;
    if (dayIndex !== undefined) setDetailDayIndex(dayIndex);
    if (isRewardedUnlockedThisSession()) { setDetailModal(kind); return; }
    setUnlockingDetail(unlockKey);
    const granted = await unlockWithRewardedInterstitial();
    setUnlockingDetail(null);
    if (granted) setDetailModal(kind);
  };

  useEffect(() => {
    showBannerAd();
    const unsubscribe = onBannerHeightChange(setBannerHeight);
    return unsubscribe;
  }, []);

  // ---- Konum tespiti (namaz vaktindeki mantıkla birebir) ----
  const detectAndUpdateLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const coords = await getCurrentPosition();
      const latDiff = Math.abs(coords.latitude - location.latitude);
      const lonDiff = Math.abs(coords.longitude - location.longitude);
      if (latDiff < 0.05 && lonDiff < 0.05) { setIsDetectingLocation(false); return; }

      let name = `${coords.latitude.toFixed(2)}°N ${coords.longitude.toFixed(2)}°E`;
      let country = t("unknown", lang);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=${lang === "ur" ? "ar" : lang}`,
          { headers: { "Accept": "application/json" } }
        );
        const data = await res.json();
        if (data?.address) {
          const addr = data.address;
          name = addr.city || addr.town || addr.village || addr.county || addr.state || name;
          country = addr.country || country;
        }
      } catch (geoErr) {
        console.log("[Meccanen HD] Reverse geocoding başarısız, koordinatlarla devam:", geoErr);
      }

      const newLoc: Location = {
        name, country, latitude: coords.latitude, longitude: coords.longitude,
        timezone: guessTimezone(coords.longitude),
      };
      setLocationAndSave(newLoc);
      const exists = savedLocations.some(l => l.latitude.toFixed(2) === newLoc.latitude.toFixed(2));
      if (!exists) setSavedLocations([...savedLocations, newLoc]);
    } catch (e) {
      console.log("[Meccanen HD] Konum tespiti hatası:", e);
    }
    setIsDetectingLocation(false);
  };

  useEffect(() => {
    if (autoLocationEnabled) detectAndUpdateLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoLocationEnabled) return;
    const interval = setInterval(() => detectAndUpdateLocation(), 30 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocationEnabled]);

  const handleFindLocation = async () => {
    localStorage.setItem("mhd_auto_location", "true");
    setAutoLocationEnabled(true);
    setShowLocationPrompt(true);
  };

  const handleToggleAutoLocation = (val: boolean) => {
    localStorage.setItem("mhd_auto_location", String(val));
    setAutoLocationEnabled(val);
    if (val) detectAndUpdateLocation();
  };

  const handleLocationAllowed = async () => {
    setShowLocationPrompt(false);
    localStorage.setItem("mhd_location_prompted", "true");
    setIsDetectingLocation(true);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsDetectingLocation(false);
      alert(t("locationDenied", lang));
      return;
    }
    await detectAndUpdateLocation();
  };

  const handleLocationDenied = () => {
    setShowLocationPrompt(false);
    localStorage.setItem("mhd_location_prompted", "true");
  };

  // ---- Türetilmiş görünüm verisi ----
  const currentMapping = useMemo(
    () => weather ? getWeatherMapping(weather.current.weatherCode, weather.current.isDay) : null,
    [weather]
  );

  // Dile göre Intl locale kodu — gün/ay isimleri (formatDay) ve saat
  // biçimi artık seçili dile göre değişiyor, sabit "tr-TR" değil.
  const INTL_LOCALE: Record<LangCode, string> = {
    tr: "tr-TR", en: "en-US", de: "de-DE", ar: "ar-SA", ur: "ur-PK",
  };
  const intlLocale = INTL_LOCALE[lang] || "en-US";

  const formatHour = (dt: number) => new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit", minute: "2-digit", timeZone: location.timezone || "Europe/Istanbul",
  }).format(new Date(dt * 1000));

  const formatDay = (dt: number) => new Intl.DateTimeFormat(intlLocale, {
    weekday: "short", day: "numeric", month: "short", timeZone: location.timezone || "Europe/Istanbul",
  }).format(new Date(dt * 1000));

  // US EPA index (1-6) → i18n anahtarı + renk sınıfı
  const getAqiInfo = (usEpaIndex: number): { key: string; colorClass: string } => {
    switch (usEpaIndex) {
      case 1: return { key: "aqiGood", colorClass: "text-emerald-500" };
      case 2: return { key: "aqiModerate", colorClass: "text-yellow-500" };
      case 3: return { key: "aqiUnhealthySensitive", colorClass: "text-orange-500" };
      case 4: return { key: "aqiUnhealthy", colorClass: "text-red-500" };
      case 5: return { key: "aqiVeryUnhealthy", colorClass: "text-purple-500" };
      case 6: return { key: "aqiHazardous", colorClass: "text-rose-700" };
      default: return { key: "aqiUnknown", colorClass: "text-slate-400" };
    }
  };

  // WeatherAPI'nin İngilizce ay evresi metni → i18n anahtarı
  const MOON_PHASE_KEYS: Record<string, string> = {
    "New Moon": "moonNew", "Waxing Crescent": "moonWaxingCrescent",
    "First Quarter": "moonFirstQuarter", "Waxing Gibbous": "moonWaxingGibbous",
    "Full Moon": "moonFull", "Waning Gibbous": "moonWaningGibbous",
    "Last Quarter": "moonLastQuarter", "Waning Crescent": "moonWaningCrescent",
  };
  const getMoonPhaseKey = (phase: string) => MOON_PHASE_KEYS[phase] || "moonUnknown";

  // UV indeksi → risk bandı (WHO standardı) + tavsiye metni anahtarları
  const getUvBand = (uv: number): { key: string; adviceKey: string; colorClass: string } => {
    if (uv < 3) return { key: "uvLow", adviceKey: "uvAdviceLow", colorClass: "text-emerald-500" };
    if (uv < 6) return { key: "uvModerate", adviceKey: "uvAdviceModerate", colorClass: "text-yellow-500" };
    if (uv < 8) return { key: "uvHigh", adviceKey: "uvAdviceHigh", colorClass: "text-orange-500" };
    if (uv < 11) return { key: "uvVeryHigh", adviceKey: "uvAdviceVeryHigh", colorClass: "text-red-500" };
    return { key: "uvExtreme", adviceKey: "uvAdviceExtreme", colorClass: "text-purple-500" };
  };

  const hdrBtnBg = isLight(themeKey) ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10";
  const hdrBtnText = th.textSecondary;

  return (
    <div dir={lang === "ar" || lang === "ur" ? "rtl" : "ltr"}
      style={{ paddingBottom: bannerHeight ? bannerHeight + 12 : undefined }}
      className={`min-h-screen ${th.bg} ${th.textPrimary} relative overflow-hidden p-3 sm:p-6 md:p-8 transition-colors duration-700`}>
      <div className={`pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl ${th.blob1}`} />
      <div className={`pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl ${th.blob2}`} />

      <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 sm:gap-5 relative z-10 animate-fadeIn">

        {/* Header — kontroller bilinçli olarak SABİT boyutta (px), font
            ölçeğinden (fontScale) etkilenmiyor. Böylece "Büyük/Çok Büyük"
            yazı tercihi asıl içeriği (sıcaklık, tahmin, açıklama metni)
            büyütür ama üst menü her zaman düzenli/tek satır kalır — RTL
            dillerde de aynı şekilde stabil. */}
        <header className="flex flex-col gap-[8px] pb-[8px]">
          <div className="flex justify-between items-center gap-[8px]">
            <button onClick={() => { setSettingsTab("hakkinda"); setShowSettings(true); }}
              className="cursor-pointer select-none hover:opacity-75 transition-opacity duration-200 text-left shrink-0">
              <div className={`text-[28px] font-extrabold tracking-widest ${th.accent} leading-none`}>
                MECCANEN
              </div>
            </button>
            <div className="flex items-center gap-[10px] min-w-0">
              {savedLocations.length > 1 ? (
                <button onClick={() => {
                    const idx = savedLocations.findIndex(l =>
                      l.latitude.toFixed(3) === location.latitude.toFixed(3) &&
                      l.longitude.toFixed(3) === location.longitude.toFixed(3)
                    );
                    const next = savedLocations[(idx + 1) % savedLocations.length];
                    setLocationAndSave(next);
                  }}
                  className={`inline-flex items-center gap-[8px] h-[48px] px-[18px] border rounded-full text-[16px] font-bold ${th.accent} ${hdrBtnBg} transition-all cursor-pointer min-w-0 max-w-[42vw]`}>
                  <MapPin size={20} className="shrink-0" /><span className="truncate">{location.name}</span><ChevronsDown size={16} className="-rotate-90 shrink-0" />
                </button>
              ) : (
                <button onClick={() => { setSettingsTab("konum"); setShowSettings(true); }}
                  className={`inline-flex items-center gap-[8px] h-[48px] px-[18px] border rounded-full text-[16px] font-bold ${th.accent} ${hdrBtnBg} min-w-0 max-w-[42vw]`}>
                  <MapPin size={20} className="shrink-0" /><span className="truncate">{location.name}</span>
                </button>
              )}
              <button onClick={() => { setSettingsTab("tema"); setShowSettings(true); }}
                className={`w-[48px] h-[48px] flex items-center justify-center border rounded-full transition-all cursor-pointer shrink-0 ${hdrBtnBg} ${hdrBtnText}`}>
                <Settings size={24} />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center gap-[8px]">
            <div className="flex items-center gap-[8px] min-w-0">
              <span className={`text-[15px] font-semibold truncate ${th.textSecondary}`}>{t("appName", lang)}</span>
            </div>
            <div className="flex items-center gap-[10px] shrink-0">
              <button onClick={() => {
                  const order: FontScale[] = ["normal", "large", "xlarge"];
                  const next = order[(order.indexOf(fontScale) + 1) % order.length];
                  setFontScale(next);
                }}
                title={t("fontSize", lang)}
                className={`w-[48px] h-[48px] flex items-center justify-center text-[17px] font-extrabold border rounded-full transition-all cursor-pointer ${hdrBtnBg} ${hdrBtnText}`}>
                Aa
              </button>
              <button onClick={() => {
                  const order: LangCode[] = ["tr", "en", "ar", "de", "ur"];
                  const next = order[(order.indexOf(lang) + 1) % order.length];
                  setLang(next);
                }}
                className={`px-[18px] h-[48px] flex items-center justify-center text-[16px] font-bold border rounded-full transition-all cursor-pointer ${hdrBtnBg} ${hdrBtnText}`}>
                {lang.toUpperCase()}
              </button>
              <button onClick={() => {
                  const order = Object.keys(THEMES) as ThemeKey[];
                  const next = order[(order.indexOf(themeKey) + 1) % order.length];
                  setTheme(next);
                }}
                title={t("changeTheme", lang)}
                className={`w-[48px] h-[48px] flex items-center justify-center border rounded-full transition-all cursor-pointer ${hdrBtnBg} ${hdrBtnText}`}>
                <Palette size={19} />
              </button>
            </div>
          </div>
        </header>

        {weatherLoading && !weather && (
          <div className="flex flex-col items-center gap-3 py-16">
            <CloudSun size={36} className={`${th.accent} animate-pulse`} />
            <p className={`text-sm ${th.textMuted}`}>{t("wxLoading", lang)}</p>
          </div>
        )}
        {weatherError && !weather && (
          <div className={`text-center text-sm ${th.textMuted} py-16 space-y-3`}>
            <p>{weatherError}</p>
            <button onClick={loadWeather} className={`px-4 py-2 rounded-full border text-xs font-semibold ${th.card} ${th.accent}`}>
              {t("wxRefresh", lang)}
            </button>
          </div>
        )}

        {weather && currentMapping && (
          <>
            {/* Hero kart — namaz vaktindeki saat kartıyla aynı ağırlıkta (rounded-3xl, shadow-2xl, gradient sayı) */}
            {weather.alerts.length > 0 && (
              <button onClick={() => handleOpenDetail("alert")} disabled={unlockingDetail !== null}
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

            <section className={`${th.card} border rounded-3xl p-6 sm:p-7 transition-all duration-300 shadow-2xl relative overflow-hidden`}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${currentMapping.bgClass}`} />

              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative mb-1"
                >
                  <div className={`absolute inset-0 blur-2xl opacity-40 ${currentMapping.colorClass}`}>
                    <currentMapping.iconName size={72} />
                  </div>
                  <currentMapping.iconName size={72} className={`relative ${currentMapping.colorClass}`} />
                </motion.div>

                <div className="flex items-start justify-center font-mono select-none">
                  <span className={`text-6xl sm:text-7xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b ${th.clockGrad} tracking-tight leading-none`}>
                    {weather.current.temperature}
                  </span>
                  <span className={`text-2xl sm:text-3xl font-light ${th.secColor} mt-1`}>°</span>
                </div>
                <p className={`text-sm sm:text-base font-medium ${th.textSecondary} mt-1 capitalize`}>{t(currentMapping.descKey, lang)}</p>

                <div className={`mt-5 w-full p-4 rounded-2xl border-2 ${th.prayerActive} flex items-center justify-center gap-2 shadow-lg`}>
                  <span className="text-sm font-semibold uppercase tracking-wide opacity-80">{t("wxFeelsLike", lang)}</span>
                  <span className="text-xl font-mono font-extrabold">{weather.current.apparentTemperature}°</span>
                </div>

                <div className={`w-full border-t pt-4 mt-5 grid grid-cols-4 gap-2 text-xs ${th.header}`}>
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <Droplets size={16} className={th.accent2} />
                    <span className={`font-semibold ${th.textPrimary}`}>{weather.current.humidity}%</span>
                    <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxHumidity", lang)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <Wind size={16} className={th.accent2} />
                    <span className={`font-semibold ${th.textPrimary}`}>{Math.round(weather.current.windSpeed)} m/s</span>
                    <span className={`w-full text-center leading-tight break-words ${th.textMuted}`}>{t("wxWind", lang)}</span>
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

                <div className="flex justify-center gap-8 pt-4 text-xs">
                  <div className="flex items-center gap-1.5"><Sunrise size={15} className={th.accent3} />{formatHour(weather.current.sunrise)}</div>
                  <div className="flex items-center gap-1.5"><Sunset size={15} className={th.accent3} />{formatHour(weather.current.sunset)}</div>
                </div>
              </div>
            </section>

            {/* Ekstra bilgiler: UV, Hava Kalitesi, Ay Evresi */}
            <section className="grid grid-cols-3 gap-2.5">
              <button onClick={() => handleOpenDetail("uv")} disabled={unlockingDetail !== null}
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
              <button onClick={() => handleOpenDetail("aq")} disabled={unlockingDetail !== null}
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
              <button onClick={() => handleOpenDetail("moon")} disabled={unlockingDetail !== null}
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
              <p className={`text-xs font-bold uppercase tracking-wide mb-2.5 px-1 ${th.textMuted}`}>{t("wxHourlyTitle", lang)}</p>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                {weather.hourly.map((h, i) => {
                  const m = getWeatherMapping(h.weatherCode, h.isDay);
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.03 }}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3.5 py-3.5 min-w-[68px] shadow-sm ${th.card} ${th.cardHover} transition-colors`}>
                      <span className={`text-xs font-semibold ${i === 0 ? th.accent : th.textSecondary}`}>
                        {i === 0 ? t("wxNow", lang) : formatHour(h.dt)}
                      </span>
                      <m.iconName size={22} className={m.colorClass} />
                      <span className="text-sm font-bold">{h.temperature}°</span>
                      {h.pop > 0.15 && (
                        <span className={`text-[10px] ${th.accent2}`}>{Math.round(h.pop * 100)}%</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* 7 günlük tahmin */}
            <section className={`${th.card} border rounded-3xl overflow-hidden shadow-xl`}>
              <p className={`text-xs font-bold uppercase tracking-wide px-4 pt-4 pb-1 ${th.textMuted}`}>{t("wxDailyTitle", lang)}</p>
              <div className={`divide-y ${isLight(themeKey) ? "divide-black/5" : "divide-white/5"}`}>
                {weather.daily.map((d, i) => {
                  const m = getWeatherMapping(d.weatherCode, true);
                  return (
                    <button key={i} onClick={() => handleOpenDetail("day", i)} disabled={unlockingDetail !== null}
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
        )}
      </div>

      {showLocationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className={`w-full max-w-sm rounded-3xl border p-6 text-center space-y-4 ${th.settingsCard}`}>
            <Navigation size={32} className={`mx-auto ${th.accent}`} />
            <h3 className="font-semibold">{t("locationPermission", lang)}</h3>
            <p className={`text-sm ${th.textSecondary}`}>{t("findMyLocation", lang)}?</p>
            <div className="flex gap-2">
              <button onClick={handleLocationDenied} className={`flex-1 py-2.5 rounded-xl border text-sm ${th.card} ${th.textMuted}`}>
                {t("change", lang)}
              </button>
              <button onClick={handleLocationAllowed} disabled={isDetectingLocation}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${th.card} ${th.accent}`}>
                {isDetectingLocation ? "…" : t("findMyLocation", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          theme={themeKey} setTheme={setTheme}
          location={location} setLocation={setLocationAndSave}
          savedLocations={savedLocations} setSavedLocations={setSavedLocations}
          onClose={() => setShowSettings(false)} th={th}
          lang={lang} setLang={setLang}
          onFindLocation={handleFindLocation} isDetectingLocation={isDetectingLocation}
          autoLocationEnabled={autoLocationEnabled} onToggleAutoLocation={handleToggleAutoLocation}
          initialTab={settingsTab}
        />
      )}

      {detailModal && weather && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={() => setDetailModal(null)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: themeBgToOpaqueRgba(th.bg, 0.94) }}
            className={`w-full max-w-sm rounded-3xl border p-6 space-y-4 max-h-[80vh] overflow-y-auto backdrop-blur-xl ${th.card.replace(/bg-\S+/g, "")}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold text-base ${th.textPrimary}`}>
                {detailModal === "alert" && t("alertDetailTitle", lang)}
                {detailModal === "uv" && t("uvIndex", lang)}
                {detailModal === "aq" && t("airQuality", lang)}
                {detailModal === "moon" && t("moonPhase", lang)}
                {detailModal === "day" && (detailDayIndex === 0 ? t("wxToday", lang) : formatDay(weather.daily[detailDayIndex]?.dt ?? 0))}
              </h3>
              <button onClick={() => setDetailModal(null)} className={th.textMuted}>
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
                    <p className={`text-base whitespace-pre-line leading-relaxed font-medium ${th.textPrimary}`}>
                      {weather.alerts[0].effect}
                    </p>
                    {weather.alerts[0].language && (
                      <p className={`text-[11px] italic pt-1 ${th.textMuted}`}>
                        {t("alertLanguageNote", lang, { language: weather.alerts[0].language })}
                      </p>
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

            {detailModal === "day" && weather.dailyHourly[detailDayIndex] && (
              <div className="space-y-1 -mx-2">
                <div className={`flex items-center gap-2 px-2 pb-1.5 mb-1 border-b text-[10px] font-semibold uppercase tracking-wide ${th.header} ${th.textMuted}`}>
                  <span className="w-11 shrink-0">{t("wxColHour", lang)}</span>
                  <span className="w-4 shrink-0" />
                  <span className="w-9 shrink-0 text-right">{t("wxColTemp", lang)}</span>
                  <span className="w-12 shrink-0 text-right">{t("wxColHumidity", lang)}</span>
                  <span className="w-14 shrink-0 text-right">{t("wxColWind", lang)}</span>
                  <span className="w-14 shrink-0 text-right">{t("wxColPressure", lang)}</span>
                  <span className="flex-1 text-right">{t("wxColRain", lang)}</span>
                </div>
                {weather.dailyHourly[detailDayIndex].map((h, idx) => {
                  const m = getWeatherMapping(h.weatherCode, h.isDay);
                  return (
                    <div key={idx} className={`flex items-center gap-2 px-2 py-2 text-xs rounded-xl ${th.cardHover}`}>
                      <span className={`w-11 shrink-0 font-medium ${th.textPrimary}`}>{formatHour(h.dt)}</span>
                      <m.iconName size={16} className={`${m.colorClass} shrink-0`} />
                      <span className={`w-9 shrink-0 text-right font-semibold ${th.textPrimary}`}>{h.temperature}°</span>
                      <span className={`flex items-center gap-0.5 w-12 shrink-0 justify-end ${th.textMuted}`}>
                        <Droplets size={11} />{h.humidity ?? "—"}%
                      </span>
                      <span className={`flex items-center gap-0.5 w-14 shrink-0 justify-end ${th.textMuted}`}>
                        <Wind size={11} />{h.windSpeed ?? "—"}
                      </span>
                      <span className={`flex items-center gap-0.5 w-14 shrink-0 justify-end ${th.textMuted}`}>
                        <Gauge size={11} />{h.pressure ?? "—"}
                      </span>
                      <span className={`flex items-center gap-0.5 flex-1 justify-end ${h.pop > 0.1 ? th.accent2 : th.textMuted}`}>
                        <Umbrella size={11} />{Math.round(h.pop * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
