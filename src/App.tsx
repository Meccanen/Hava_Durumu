import React, { useState, useEffect, useRef } from "react";
import {
  MapPin, ChevronsDown, Settings, Palette, CloudSun,
} from "lucide-react";
import { Location } from "./types";
export type FontScale = "normal" | "large" | "xlarge";
import { THEMES, ThemeKey, isLight } from "./theme";
import { DEFAULT_LOCATION } from "./config";
import { fetchWeatherBundle, WeatherServiceError, getCachedWeather, CACHE_MAX_AGE_MS } from "./services/weatherService";
import { initBackgroundTask } from "./services/backgroundTaskService";
import { requestLocationPermission, getCurrentPosition, guessTimezone } from "./utils/locationHelper";
import { t, detectLanguage, LangCode } from "./utils/i18n";
import { formatHour, formatDay } from "./utils/weatherDisplay";
import { showBannerAd, onBannerHeightChange, unlockWithRewardedInterstitial, isRewardedUnlockedThisSession } from "./services/adMobService";
import { shareWeatherCard } from "./services/shareService";
import { getWeatherMapping } from "./utils/weatherHelper";
import {
  hasNotificationPermission, requestNotificationPermission,
  refreshScheduledNotifications,
} from "./services/notificationService";
import { LocalNotifications } from '@capacitor/local-notifications';
import type { ActionPerformed } from '@capacitor/local-notifications';
import type { WeatherBundle } from "./types";
import SettingsPanel from "./components/SettingsPanel";
import WeatherDashboard from "./components/WeatherDashboard";
import DetailModal, { DetailKind } from "./components/DetailModal";
import WeatherMapModal from "./components/WeatherMapModal";
import { LocationPrompt, NotificationPrompt, LocationErrorBanner } from "./components/Prompts";

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
  const [settingsTab, setSettingsTab] = useState<"tema"|"konum"|"dil"|"bildirim"|"hakkinda">("tema");

  const [autoLocationEnabled, setAutoLocationEnabled] = useState(
    () => localStorage.getItem("mhd_auto_location") === "true"
  );
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<"denied" | "failed" | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(
    () => !localStorage.getItem("mhd_location_prompted")
  );

  // ---- Hava durumu verisi ----
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const loadWeather = async () => {
    // Önce cache'den oku — arka plan task'ı saat başı tazeliyor. Cache
    // tazeyse VE mevcut konumun verisiyse API çağrısı yapma (hem hız hem
    // Free tier limiti için).
    const cached = getCachedWeather(location.latitude, location.longitude);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) {
      setWeather(cached);
      return;
    }
    setWeatherLoading(true); setWeatherError(null);
    try {
      const bundle = await fetchWeatherBundle(location.latitude, location.longitude);
      setWeather(bundle);
    } catch (e) {
      const msg = e instanceof WeatherServiceError ? e.message : t("wxError", lang);
      setWeatherError(msg);
      console.log("[Meccanen HD] Hava durumu alınamadı:", e);
      // Ağ hatası olsa bile son bilinen cache'i göster (çevrimdışı dayanıklılık)
      const offline = getCachedWeather(location.latitude, location.longitude);
      if (offline && !weather) setWeather(offline);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => { loadWeather(); }, [location.latitude, location.longitude, lang]);

  // ---- Arka plan veri yenileme (saat başı) ----
  // BackgroundFetch, uygulama arka plandayken hava verisini cache'e yazar.
  // Uygulama öne geldiğinde veya düzenli aralıkla burada cache'den okuyoruz.
  useEffect(() => {
    initBackgroundTask();
  }, []);

  // Periyodik kontrol: cache'de bizim state'ten daha yeni bir veri varsa al.
  // Arka plan task'ı React state'ini doğrudan değiştiremez — bu köprü bunu
  // çözüyor; ayrıca cache'in güncel konuma ait olduğunu da kontrol ederiz.
  useEffect(() => {
    const interval = setInterval(() => {
      const cached = getCachedWeather(location.latitude, location.longitude);
      if (cached && cached.fetchedAt > (weather?.fetchedAt ?? 0)) {
        console.log("[Meccanen HD] Arka plandan yeni veri alındı, state güncelleniyor.");
        setWeather(cached);
      }
    }, 5 * 60 * 1000); // her 5 dakika
    return () => clearInterval(interval);
  }, [weather, location.latitude, location.longitude]);

  // ---- AdMob banner ----
  // NOT: Şu an herkese reklam gösteriliyor. Abonelik sistemi (aylık/yıllık,
  // reklamları kaldıran) devreye girdiğinde bu effect abonelik durumuna göre
  // koşullu hale getirilecek.
  const [bannerHeight, setBannerHeight] = useState(0);

  // ---- Ödüllü reklamla açılan detay ekranları (UV / Hava Kalitesi / Ay Evresi / Uyarı / Gün / Saat) ----
  const [detailModal, setDetailModal] = useState<DetailKind | null>(null);
  const [detailDayIndex, setDetailDayIndex] = useState<number>(0);
  const [detailHourIndex, setDetailHourIndex] = useState<number>(0);
  const [unlockingDetail, setUnlockingDetail] = useState<string | null>(null);

  const handleOpenDetail = async (kind: DetailKind, index?: number) => {
    const unlockKey = kind === "day" || kind === "hour" ? `${kind}-${index ?? 0}` : kind;
    if (kind === "day" && index !== undefined) setDetailDayIndex(index);
    if (kind === "hour" && index !== undefined) setDetailHourIndex(index);
    if (isRewardedUnlockedThisSession()) { setDetailModal(kind); return; }
    setUnlockingDetail(unlockKey);
    const granted = await unlockWithRewardedInterstitial();
    setUnlockingDetail(null);
    if (granted) setDetailModal(kind);
  };

  // ---- Hero kartı paylaşımı (WhatsApp/Instagram vb. — ödüllü reklam karşılığında) ----
  const [sharing, setSharing] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

  // ---- Weather Maps (radar) — ödüllü reklamla açılır ----
  const [showMap, setShowMap] = useState(false);
  const [mapUnlocking, setMapUnlocking] = useState(false);

  const handleOpenMap = async () => {
    if (showMap || mapUnlocking) return;
    if (isRewardedUnlockedThisSession()) { setShowMap(true); return; }
    setMapUnlocking(true);
    const granted = await unlockWithRewardedInterstitial();
    setMapUnlocking(false);
    if (granted) setShowMap(true);
  };

  const handleShare = async () => {
    if (!weather || sharing) return;
    setSharing(true);
    const granted = await unlockWithRewardedInterstitial();
    if (!granted) { setSharing(false); return; }

    // decode kilit açıldıktan sonra PNG üret — spinner bir kare görünmesin
    // diye kısa bir bekleme.
    await new Promise((r) => setTimeout(r, 0));
    const heroEl = heroRef.current;
    setSharing(false);
    if (!heroEl) return;

    const shareTitle = `${t("appName", lang)} — ${location.name}`;
    const shareText = `${location.name}: ${weather.current.temperature}° · ${t(
      getWeatherMapping(weather.current.weatherCode, weather.current.isDay).descKey, lang
    )}`;
    try {
      await shareWeatherCard(heroEl, { title: shareTitle, text: shareText });
    } catch (e) {
      console.error("[Meccanen HD] Paylaşım başarısız:", e);
    }
  };

  // ---- Bildirimden tıklama → deeplink: günlük özet/ani değişim bildirimi
  // extra.detail="day" taşır; kullanıcı bildirime dokununca bugünün detayı açılır.
  // Bildirim zaten konum/hava; ödüllü reklam şartı deeplink'te ARANMAZ (reklam
  // modeli uygulama içi detay tetikleyicilerinde korunur).
  useEffect(() => {
    let activeHandle: { remove: () => void } | null = null;
    const register = async () => {
      const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (action: ActionPerformed) => {
        const extra = action.notification.extra as { detail?: string; dayIndex?: number } | undefined;
        if (extra?.detail === "day") {
          setDetailDayIndex(extra.dayIndex ?? 0);
          setDetailModal("day");
        }
      });
      activeHandle = handle;
    };
    register();
    return () => { if (activeHandle) activeHandle.remove(); };
  }, []);

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
      if (latDiff < 0.05 && lonDiff < 0.05) { setLocationError(null); setIsDetectingLocation(false); return; }

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
      setLocationError(null);
      const exists = savedLocations.some(l => l.latitude.toFixed(2) === newLoc.latitude.toFixed(2));
      if (!exists) setSavedLocations([...savedLocations, newLoc]);
    } catch (e) {
      console.log("[Meccanen HD] Konum tespiti hatası:", e);
      const permDenied = (e as { code?: number } | undefined)?.code === 1;
      setLocationError(permDenied ? "denied" : "failed");
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
    setLocationError(null);
    setShowLocationPrompt(true);
  };

  const handleToggleAutoLocation = (val: boolean) => {
    localStorage.setItem("mhd_auto_location", String(val));
    setAutoLocationEnabled(val);
    if (val) {
      setLocationError(null);
      detectAndUpdateLocation();
    }
  };

  const handleLocationAllowed = async () => {
    setShowLocationPrompt(false);
    localStorage.setItem("mhd_location_prompted", "true");
    setIsDetectingLocation(true);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsDetectingLocation(false);
      setLocationError("denied");
      return;
    }
    await detectAndUpdateLocation();
  };

  const handleLocationDenied = () => {
    setShowLocationPrompt(false);
    localStorage.setItem("mhd_location_prompted", "true");
  };

  const handleLocationRetry = () => {
    setLocationError(null);
    if (autoLocationEnabled) {
      detectAndUpdateLocation();
    } else {
      handleFindLocation();
    }
  };

  const handleLocationSearchCity = () => {
    setLocationError(null);
    setSettingsTab("konum");
    setShowSettings(true);
  };

  // ---- Bildirim tercihleri (konum promptuyla aynı desen) ----
  const [notifDailyEnabled, setNotifDailyEnabledState] = useState(
    () => localStorage.getItem("mhd_notif_daily_enabled") === "true"
  );
  const [notifTime, setNotifTimeState] = useState(
    () => localStorage.getItem("mhd_notif_time") || "08:00"
  );
  const [notifPermissionGranted, setNotifPermissionGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(
    () => !localStorage.getItem("mhd_notif_prompted")
  );

  useEffect(() => { hasNotificationPermission().then(setNotifPermissionGranted); }, [weather]);

  const handleToggleNotifDaily = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      setNotifPermissionGranted(granted);
      if (!granted) return; // izin verilmezse toggle açık kalmaz
      localStorage.setItem("mhd_notif_daily_enabled", "true");
      setNotifDailyEnabledState(true);
    } else {
      localStorage.setItem("mhd_notif_daily_enabled", "false");
      setNotifDailyEnabledState(false);
    }
  };

  const handleChangeNotifTime = async (time: string) => {
    localStorage.setItem("mhd_notif_time", time);
    setNotifTimeState(time);
  };

  const handleNotifAllowed = async () => {
    setShowNotifPrompt(false);
    localStorage.setItem("mhd_notif_prompted", "true");
    await handleToggleNotifDaily(true);
  };

  const handleNotifDenied = () => {
    setShowNotifPrompt(false);
    localStorage.setItem("mhd_notif_prompted", "true");
  };

  // ---- Ani değişim uyarısı (ileriye dönük, saat-başı hassasiyetli) ----
  const [notifChangeAlertEnabled, setNotifChangeAlertEnabledState] = useState(
    () => localStorage.getItem("mhd_notif_change_enabled") === "true"
  );

  const handleToggleChangeAlert = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      setNotifPermissionGranted(granted);
      if (!granted) return;
    }
    localStorage.setItem("mhd_notif_change_enabled", val ? "true" : "false");
    setNotifChangeAlertEnabledState(val);
  };

  // Bildirimleri TAZELEMEK için tek ortak nokta: günlük özet + ani değişim
  // slotlarının tamamı refreshScheduledNotifications'ta yönetilir (kanal
  // oluşturma, içerik üretimi, zamanlama, iptal ve dil-bağımsız dedup dahil).
  // Hava verisi, dil, iki toggle veya bildirim saati değişince buraya düşer.
  useEffect(() => {
    refreshScheduledNotifications(weather, {
      notifDailyEnabled,
      notifTime,
      notifChangeAlertEnabled,
      lang,
      locationName: location.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, notifDailyEnabled, notifTime, notifChangeAlertEnabled, lang, location.name]);

  // ---- Türetilmiş görünüm verisi ----
  const intlTimezone = location.timezone || "Europe/Istanbul";
  const fmtHour = (dt: number) => formatHour(dt, intlTimezone, lang);
  const fmtDay = (dt: number) => formatDay(dt, intlTimezone, lang);

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
                  const order: LangCode[] = ["en", "tr", "ar", "de", "ur"];
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

        {locationError && !showSettings && (
          <LocationErrorBanner
            th={th}
            lang={lang}
            isDenied={locationError === "denied"}
            onRetry={handleLocationRetry}
            onSearchCity={handleLocationSearchCity}
            onDismiss={() => setLocationError(null)}
          />
        )}

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

        {weather && (
          <WeatherDashboard
            weather={weather}
            th={th}
            lang={lang}
            isLightTheme={isLight(themeKey)}
            locationName={location.name}
            formatHour={fmtHour}
            formatDay={fmtDay}
            unlockingDetail={unlockingDetail}
            onOpenDetail={handleOpenDetail}
            sharing={sharing}
            onShare={handleShare}
            mapUnlocking={mapUnlocking}
            onOpenMap={handleOpenMap}
            heroRef={heroRef}
          />
        )}
      </div>

      {showLocationPrompt && (
        <LocationPrompt
          th={th} lang={lang}
          isDetectingLocation={isDetectingLocation}
          onDenied={handleLocationDenied}
          onAllowed={handleLocationAllowed}
        />
      )}

      {!showLocationPrompt && showNotifPrompt && (
        <NotificationPrompt
          th={th} lang={lang}
          onDenied={handleNotifDenied}
          onAllowed={handleNotifAllowed}
        />
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
          notifDailyEnabled={notifDailyEnabled} onToggleNotifDaily={handleToggleNotifDaily}
          notifTime={notifTime} onChangeNotifTime={handleChangeNotifTime}
          notifPermissionGranted={notifPermissionGranted}
          notifChangeAlertEnabled={notifChangeAlertEnabled} onToggleChangeAlert={handleToggleChangeAlert}
        />
      )}

      {weather && (
        <DetailModal
          weather={weather}
          detailModal={detailModal}
          detailDayIndex={detailDayIndex}
          detailHourIndex={detailHourIndex}
          onClose={() => setDetailModal(null)}
          th={th}
          lang={lang}
          formatHour={fmtHour}
          formatDay={fmtDay}
        />
      )}

      {showMap && (
        <WeatherMapModal
          lat={location.latitude}
          lon={location.longitude}
          locationName={location.name}
          th={th}
          lang={lang}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}