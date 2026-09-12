import { BackgroundFetch } from '@transistorsoft/capacitor-background-fetch';
import {
  fetchWeatherBundle,
  WeatherServiceError,
  getCachedWeather,
  CACHE_MAX_AGE_MS,
} from './weatherService';
import { refreshScheduledNotifications } from './notificationService';
import type { LangCode } from '../utils/i18n';

/**
 * ============================================================================
 * ARKA PLAN HAVA VERİSİ GÜNCELLEME SERVİSİ
 * ============================================================================
 * Her saat başında arka planda hava durumu verisi çekip localStorage'a
 * yazar (weatherService.ts içindeki cache'e). Böylece uygulama açıldığında
 * veya bildirim tetiklendiğinde her zaman güncel veri kullanılabilir.
 *
 * Akış:
 * 1. BackgroundFetch.configure() ile varsayılan periyodik event kayıt edilir
 *    (minimumFetchInterval: 60 dk — OS'un izin verdiği minimum 15 dk, biz
 *    saat başı istiyoruz).
 * 2. Her event tetiklendiğinde, localStorage'daki son çekim zamanına bakılır:
 *    - 60 dk'dan kısa süre önce çekilmişse: sadece finish() çağrılır (API
 *      çağrılmaz, gereksiz maliyet önlenir).
 *    - 60 dk veya daha eskiyse: fetchWeatherBundle() ile yeni veri çekilir,
 *      cache'e yazılır VE bildirimler güncel veriyle tazelenir.
 * 3. App.tsx, periyodik kontrolde cache'deki veriyi okur ve state'i günceller.
 *
 * Bildirim tazelemesi: fetchWeatherBundle başarılı olunca
 * refreshScheduledNotifications() çağrılır (günlük özet + ani değişim
 * slotları da aynı ortak fonksiyonla tazelenir). Böylece kullanıcı
 * uygulamayı günlerce açmasa bile 08:00 günlük özet bildirimi BAYAT veri
 * göstermez; her saat başı arka planda veri güncellendiğinde bildirim
 * içeriği de güncellenir. Tercihler (açık/kapalı, saat, dil) localStorage'dan
 * okunur.
 *
 * NOT: Free tier API limiti (100K/ay) göz önünde bulundurularak, her event'te
 * API çağrısı YAPILMAZ. Sadece 60 dk dolmuşsa çekilir. Günde max ~24 çağrı.
 *
 * SINIRLAMA: Bu JS callback'i yalnızca WebView hayatta kaldığında çalışır
 * (uygulama önde→arkada). Kullanıcı uygulamayı recents'ten tamamen kapatırsa
 * native job takvimde kalır ama JS callback'i tetiklenmez — uygulama yeniden
 * açıldığında cache-first akış zaten taze veri getirir.
 */

let initialized = false;

/**
 * Arka plan task'ının çalıştığı ana fonksiyon.
 * Konumu localStorage'dan okur, hava durumu çeker, cache'e yazar.
 */
async function executeWeatherRefresh(): Promise<boolean> {
  try {
    const locationRaw = localStorage.getItem('mhd_location');
    if (!locationRaw) {
      console.log('[backgroundTaskService] Kayıtlı konum yok, atlaniyor.');
      return false;
    }

    const location = JSON.parse(locationRaw);
    if (!location?.latitude || !location?.longitude) {
      console.log('[backgroundTaskService] Geçersiz konum verisi, atlanıyor.');
      return false;
    }

    // Son çekimden bu yana 60 dk geçtiyse devam et, geçmediyse atla.
    // Cache'in mevcut konuma ait olduğunu da kontrol et.
    const cached = getCachedWeather(location.latitude, location.longitude);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) {
      console.log('[backgroundTaskService] Cache hâlâ taze, API çağrısı atlanıyor.');
      return false;
    }

    console.log('[backgroundTaskService] Hava durumu güncelleniyor...', {
      lat: location.latitude,
      lng: location.longitude,
    });

    // fetchWeatherBundle başarılı çekimi otomatik cache'e yazar.
    const bundle = await fetchWeatherBundle(location.latitude, location.longitude);

    // Başarılı çekimden sonra bildirimleri taze veriyle güncelle (günlük
    // özet + ani değişim slotları). Tercihler localStorage'dan okunur:
    // iki tür de kapalıysa refresh fonksiyonu yalnızca iptal yapar, zararı
    // olmaz. Dil yoksa varsayılan olarak Türkçe'ye düşer.
    await refreshScheduledNotifications(bundle, {
      notifDailyEnabled: localStorage.getItem('mhd_notif_daily_enabled') === 'true',
      notifTime: localStorage.getItem('mhd_notif_time') || '08:00',
      notifChangeAlertEnabled: localStorage.getItem('mhd_notif_change_enabled') === 'true',
      lang: (localStorage.getItem('mhd_lang') as LangCode) || 'tr',
      locationName: location?.name as string | undefined,
    });

    console.log('[backgroundTaskService] Hava durumu başarıyla güncellendi.');

    return true;
  } catch (e) {
    const msg = e instanceof WeatherServiceError ? e.message : String(e);
    console.error('[backgroundTaskService] Hava durumu güncellenemedi:', msg);
    return false;
  }
}

/**
 * Background task'ı başlatır.
 * App.tsx'te bir kez, component mount edildiğinde çağrılmalı.
 *
 * Birden fazla configure() çağrısı güvenlidir — ikincisi ilkini override
 * eder. Ancak initialized flag'i ile gereksiz tekrar önlenir.
 */
export async function initBackgroundTask(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 60, // saat başı tazeleme istiyoruz (OS minimumu 15 dk — ipucudur, garanti değil)
        stopOnTerminate: false,   // Native job terminasyon sonrası takvimde kalır
        startOnBoot: true,        // Cihaz yeniden açıldığında native job yeniden başlar
        forceAlarmManager: false, // WorkManager kullan (pil tasarruflu)
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Ağ bağlantısı gerekli
      },
      async (taskId) => {
        // Event handler — OS bizi arka planda uyandırdı
        console.log('[backgroundTaskService] Background event:', taskId);
        await executeWeatherRefresh();
        // ZORUNLU: OS'a işin bittiğini haber ver, aksi halde OS gelecekteki
        // event'leri keser (ceza mekanizması)
        await BackgroundFetch.finish(taskId);
      },
      async (taskId) => {
        // Timeout handler — OS arka plan süresinin dolduğunu söylüyor
        console.log('[backgroundTaskService] Timeout:', taskId);
        await BackgroundFetch.finish(taskId);
      }
    );

    if (status !== BackgroundFetch.STATUS_AVAILABLE) {
      console.warn('[backgroundTaskService] BackgroundFetch durumu:', status);
      if (status === BackgroundFetch.STATUS_DENIED) {
        console.warn('[backgroundTaskService] Kullanıcı arka plan davranışını engellemiş.');
      } else if (status === BackgroundFetch.STATUS_RESTRICTED) {
        console.warn('[backgroundTaskService] Arka plan güncellemeleri kullanılamıyor.');
      }
    } else {
      console.log('[backgroundTaskService] BackgroundFetch başarıyla yapılandırıldı.');
    }
  } catch (e) {
    console.error('[backgroundTaskService] BackgroundFetch başlatılamadı:', e);
  }
}
