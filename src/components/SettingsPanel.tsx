import React, { useState } from "react";
import {
  X, Palette, MapPin, Globe, Bell, Info, Search, Check, Navigation, Trash2, Shield, Mail,
} from "lucide-react";
import { THEMES, ThemeKey } from "../theme";
import { t, LangCode } from "../utils/i18n";
import { guessTimezone } from "../utils/locationHelper";
import { TURKEY_PROVINCES, PAKISTAN_CITIES } from "../utils/cityData";
import { APP_VERSION, DEFAULT_LOCATION } from "../config";
import type { Location } from "../types";

/**
 * AYARLAR PANELİ — Tema / Konum / Dil / Bildirim / Hakkında (Destekçi Rozeti dahil).
 */
export default function SettingsPanel({
  theme, setTheme, location, setLocation,
  savedLocations, setSavedLocations,
  onClose, th, lang, setLang,
  onFindLocation, isDetectingLocation,
  autoLocationEnabled, onToggleAutoLocation,
  initialTab,
  notifDailyEnabled, onToggleNotifDaily,
  notifTime, onChangeNotifTime,
  notifPermissionGranted,
  notifChangeAlertEnabled, onToggleChangeAlert,
}: {
  theme: ThemeKey; setTheme: (k: ThemeKey) => void;
  location: Location; setLocation: (l: Location) => void;
  savedLocations: Location[]; setSavedLocations: (locs: Location[]) => void;
  onClose: () => void; th: typeof THEMES[ThemeKey];
  lang: LangCode; setLang: (l: LangCode) => void;
  onFindLocation: () => void; isDetectingLocation: boolean;
  autoLocationEnabled: boolean; onToggleAutoLocation: (val: boolean) => void;
  initialTab?: "tema" | "konum" | "dil" | "bildirim" | "hakkinda";
  notifDailyEnabled: boolean; onToggleNotifDaily: (val: boolean) => void;
  notifTime: string; onChangeNotifTime: (time: string) => void;
  notifPermissionGranted: boolean;
  notifChangeAlertEnabled: boolean; onToggleChangeAlert: (val: boolean) => void;
}) {
  const [tab, setTab] = useState<"tema" | "konum" | "dil" | "bildirim" | "hakkinda">(initialTab || "tema");
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

        <div className={`flex flex-wrap justify-center gap-2 px-3 py-3 border-b ${th.header}`}>
          {(["tema","konum","dil","bildirim","hakkinda"] as const).map(tb => {
            const TabIcon = tb === "tema" ? Palette : tb === "konum" ? MapPin : tb === "dil" ? Globe : tb === "bildirim" ? Bell : Info;
            const label = tb === "tema" ? t("themeTab", lang) : tb === "konum" ? t("location", lang) : tb === "dil" ? t("language", lang) : tb === "bildirim" ? t("notifTab", lang) : t("about", lang);
            const active = tab === tb;
            return (
              <button key={tb} onClick={() => setTab(tb)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap transition ${active ? `${th.card} ${th.accent} border-current` : `border-transparent ${th.textMuted}`}`}>
                <TabIcon size={14} />
                {label}
              </button>
            );
          })}
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

          {tab === "bildirim" && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border ${th.card}`}>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${th.textPrimary}`}>{t("notifDailyToggleLabel", lang)}</p>
                  <p className={`text-xs ${th.textMuted}`}>{t("notifDailyToggleDesc", lang)}</p>
                </div>
                <button
                  role="switch" aria-checked={notifDailyEnabled}
                  onClick={() => onToggleNotifDaily(!notifDailyEnabled)}
                  className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${notifDailyEnabled ? th.accent + " bg-current" : "bg-black/20"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifDailyEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {notifDailyEnabled && (
                <div className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border ${th.card}`}>
                  <p className={`text-sm font-medium ${th.textPrimary}`}>{t("notifTimeLabel", lang)}</p>
                  <input type="time" value={notifTime}
                    onChange={(e) => onChangeNotifTime(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border bg-transparent text-sm ${th.card} ${th.textPrimary} outline-none`} />
                </div>
              )}

              {notifDailyEnabled && !notifPermissionGranted && (
                <p className={`text-xs ${th.textMuted}`}>{t("notifPermissionDenied", lang)}</p>
              )}

              <div className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border ${th.card}`}>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${th.textPrimary}`}>{t("notifChangeToggleLabel", lang)}</p>
                  <p className={`text-xs ${th.textMuted}`}>{t("notifChangeToggleDesc", lang)}</p>
                </div>
                <button
                  role="switch" aria-checked={notifChangeAlertEnabled}
                  onClick={() => onToggleChangeAlert(!notifChangeAlertEnabled)}
                  className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${notifChangeAlertEnabled ? th.accent + " bg-current" : "bg-black/20"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifChangeAlertEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
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