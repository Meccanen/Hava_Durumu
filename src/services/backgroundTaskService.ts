import { BackgroundFetch } from '@transistorsoft/capacitor-background-fetch';
import {
  fetchWeatherBundle,
  WeatherServiceError,
  getCachedWeather,
  CACHE_MAX_AGE_MS,
} from './weatherService';

/**
 * ============================================================================
 * ARKA PLAN HAVA VERİSİ GÜNCELLEME SERVİSİ
 * ============================================================================
 * Her 30 dakikada bir arka planda hava durumu verisi çekip localStorage'a
 * yazar (weatherService.ts içindeki cache'e). Böylece uygulama açıldığında
 * veya bildirim tetiklendiğinde her zaman güncel veri kullanılabilir.
 *
 * Akış:
 * 1. BackgroundFetch.configure() ile varsayılan periyodik event kayıt edilir
 *    (minimumFetchInterval: 15 dk — OS'un izin verdiği en sık aralık).
 * 2. Her event tetiklendiğinde, localStorage'daki son çekim zamanına bakılır:
 *    - 30 dk'dan kısa süre önce çekilmişse: sadece finish() çağrılır (API
 *      çağrılmaz, gereksiz maliyet önlenir).
 *    - 30 dk veya daha eskiyse: fetchWeatherBundle() ile yeni veri çekilir
 *      ve cache'e yazılır.
 * 3. App.tsx, periyodik kontrolde cache'deki veriyi okur ve state'i günceller.
 *
 * NOT: Free tier API limiti (100K/ay) göz önünde bulundurularak, her event'te
 * API çağrısı YAPILMAZ. Sadece 30 dk dolmuşsa çekilir. Günde max ~48 çağrı.
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

    // Son çekimden bu yana 30 dk geçtiyse devam et, geçmediyse atla.
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
    await fetchWeatherBundle(location.latitude, location.longitude);

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
        minimumFetchInterval: 15, // OS'un izin verdiği minimum (15 dk)
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
