import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { t, LangCode } from "../utils/i18n";
import type { WeatherBundle } from "../types";
import { buildNotificationContent, detectUpcomingChanges } from "../utils/notificationBuilder";

/**
 * ============================================================================
 * BİLDİRİM ALTYAPISI (yerel/zamanlanmış bildirimler)
 * ============================================================================
 * Namaz Vakti'de yaşanan derslerden kaçınıyoruz:
 * - smallIcon MUTLAKA gerçekten var olan bir kaynağa işaret etmeli (aksi
 *   halde bildirimler SESSİZCE hiç ateşlenmiyor). Bkz. capacitor.config.json
 *   → plugins.LocalNotifications.smallIcon = "ic_stat_notify" ve
 *   build-apk.yml'deki ikon üretim script'i (drawable klasörlerindeki
 *   ic_stat_notify.png dosyaları).
 * - `checkExactNotificationSetting` gibi native, cihazda çökmeye sebep olan
 *   deneysel API'ler KULLANILMIYOR.
 * - Sabit bildirim ID'leri kullanıyoruz (çoklama/yığılma olmasın diye) —
 *   Namaz Vakti'nin "6 sabit ID" pratiğiyle aynı mantık.
 * - Android 8+ için BİLDİRİM KANALLARI: günlük özet ve ani değişim uyarısı
 *   ayrı kanallarda (ensureNotificationChannels). Kanal oluşturma yalnızca
 *   native platformda yapılır; web'de güvenle atlanır.
 *
 * Şu an İKİ tür bildirim destekleniyor:
 *
 * 1) "Günlük özet": sabit saatte her gün TETİKLENMESİ garanti (native
 *    repeating alarm), İÇERİĞİ her hava verisi yenilendiğinde canlı veriyle
 *    üzerine yazılıyor. `body` kısa/collapsed görünüm, `largeBody` genişletilmiş
 *    (BigTextStyle) tam içerik — Android bildirimi açılınca tam metni gösterir.
 *
 * 2) "Ani değişim uyarısı": önümüzdeki ~23 saatlik tahmindeki HER ARDIŞIK SAAT
 *    ÇİFTİ karşılaştırılır (saat[i] vs saat[i+1]). Önemli bir fark (≥5°C
 *    sıcaklık veya ≥25 puan yağış ihtimali, iki yönde de) tespit edilirse:
 *    - Değişim "şu an" veya geçmişte kalan bir saate denk geliyorsa HEMEN
 *      gösterilir (fireImmediateChangeAlert)
 *    - Gelecekteki bir saate denk geliyorsa, o saatten TAM 1 SAAT ÖNCESİNE
 *      zamanlanır (scheduleFutureChangeAlert)
 *    Her olası saat dilimi (0-22 arası, ~23 slot) için SABİT bir ID ayrılmıştır;
 *    her yeniden hesaplamada slot ya güncellenir ya da iptal edilir.
 *
 * refreshScheduledNotifications(), bu iki türün ORTAK tazeleme noktasıdır:
 * App.tsx (konum/hava/dil değişince) ve backgroundTaskService (arka planda
 * veri tazelenince) ikisi de bu fonksiyonu çağırır — böylece bildirim içeriği
 * uygulama KAPALIYKEN bile güncel kalır (background task çalışıyorsa).
 */

const DAILY_SUMMARY_NOTIFICATION_ID = 9001;
const IMMEDIATE_CHANGE_ALERT_ID = 9002;
const FUTURE_CHANGE_ALERT_BASE_ID = 9200; // 9200..9222 arası, saat slotu başına 1 ID
export const FUTURE_CHANGE_ALERT_SLOT_COUNT = 23;

// Android 8+ kanalları — günlük özet ve ani değişim uyarısı ayrı kanallarda;
// kullanıcı her kanalın sesi/titreşimi/önceliğini ayrı yönetebilsin diye.
const DAILY_SUMMARY_CHANNEL_ID = "hava_gunluk_ozet";
const CHANGE_ALERT_CHANNEL_ID = "hava_degisim_uyari";

let channelsCreated = false;

/**
 * Android 8+ için bildirim kanallarını oluşturur. Web/canlı geliştirme
 * ortamında LocalNotifications native değildir; o zaman güvenle atlanır.
 * Kanal adları oluşturma anındaki dile göre sabitlenir (OS tarafından
 * cache'lenir); kanal oluşturma bir kez yapılır (channelsCreated guard).
 */
export async function ensureNotificationChannels(lang: LangCode = "tr"): Promise<void> {
  if (channelsCreated || !Capacitor.isNativePlatform()) return;
  channelsCreated = true;
  try {
    await LocalNotifications.createChannel({
      id: DAILY_SUMMARY_CHANNEL_ID,
      name: t("notifChannelDaily", lang),
      description: t("notifChannelDailyDesc", lang),
      importance: 4,
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: CHANGE_ALERT_CHANNEL_ID,
      name: t("notifChannelChange", lang),
      description: t("notifChannelChangeDesc", lang),
      importance: 4,
      vibration: true,
    });
  } catch (error) {
    console.error('[notificationService] Bildirim kanalları oluşturulamadı:', error);
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[notificationService] İzin kontrolü başarısız:', error);
    return false;
  }
}

/** İzin iste. Kullanıcı reddederse false döner — çağıran taraf buna göre UI göstermeli. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[notificationService] İzin isteme başarısız:', error);
    return false;
  }
}

/**
 * Her gün belirtilen saatte tekrarlayan tek bir yerel bildirim kurar.
 * Sabit ID kullanıldığı için tekrar çağrılması (ör. kullanıcı saati
 * değiştirdiğinde) öncekinin üzerine yazar, çoklamaz. `largeBody` verilirse
 * Android'de bildirim genişletildiğinde (BigTextStyle) tam metin gösterilir;
 * `body` her zaman kısa/collapsed görünümde kalır.
 *
 * `extra.detail = "day"` deeplink intencedir: kullanıcı bildirime (veya
 * bildirimin action düğmesine) dokunduğunda App.tsx'teki
 * localNotificationActionPerformed dinleyicisi bunu "gün detayı" olarak açar.
 */
export async function scheduleDailySummaryNotification(
  hour: number,
  minute: number,
  title: string,
  body: string,
  largeBody?: string
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_SUMMARY_NOTIFICATION_ID,
          title,
          body,
          ...(largeBody ? { largeBody } : {}),
          channelId: DAILY_SUMMARY_CHANNEL_ID,
          extra: { detail: "day", dayIndex: 0 },
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  } catch (error) {
    console.error('[notificationService] Günlük bildirim zamanlanamadı:', error);
  }
}

export async function cancelDailySummaryNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_SUMMARY_NOTIFICATION_ID }] });
  } catch (error) {
    console.error('[notificationService] Günlük bildirim iptal edilemedi:', error);
  }
}

/**
 * Şu anki veya geçmişte kalmış bir değişim için HEMEN (schedule verilmeden)
 * tek seferlik bir bildirim gösterir. Sabit ID kullanıldığı için art arda
 * tetiklenirse yığılmaz.
 */
export async function fireImmediateChangeAlert(title: string, body: string): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: IMMEDIATE_CHANGE_ALERT_ID,
          title,
          body,
          channelId: CHANGE_ALERT_CHANNEL_ID,
          extra: { detail: "day", dayIndex: 0 },
        },
      ],
    });
  } catch (error) {
    console.error('[notificationService] Ani değişim bildirimi gösterilemedi:', error);
  }
}

/**
 * Gelecekteki belirli bir ana (fireAt) zamanlanan tek seferlik bir değişim
 * uyarısı. `slotIndex` (0-22), bu saat dilimine ayrılmış sabit ID'yi seçer —
 * aynı slotun tekrar çağrılması öncekini günceller, çoklamaz.
 */
export async function scheduleFutureChangeAlert(
  slotIndex: number,
  fireAt: Date,
  title: string,
  body: string
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: FUTURE_CHANGE_ALERT_BASE_ID + slotIndex,
          title,
          body,
          channelId: CHANGE_ALERT_CHANNEL_ID,
          extra: { detail: "day", dayIndex: 0 },
          schedule: { at: fireAt, allowWhileIdle: true },
        },
      ],
    });
  } catch (error) {
    console.error(`[notificationService] Gelecek değişim uyarısı (slot ${slotIndex}) zamanlanamadı:`, error);
  }
}

export async function cancelFutureChangeAlert(slotIndex: number): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: FUTURE_CHANGE_ALERT_BASE_ID + slotIndex }] });
  } catch (error) {
    console.error(`[notificationService] Gelecek değişim uyarısı (slot ${slotIndex}) iptal edilemedi:`, error);
  }
}

/**
 * Günlük özet ve ani değişim uyarılarını, verilen tercihlere göre TAZELER.
 * App.tsx (konum/hava/dil değişince) ve backgroundTaskService (arka planda
 * veri tazelenince) bu fonksiyonu çağırır — böylece bildirim içeriği
 * uygulama KAPALIYKEN bile güncel kalır.
 *
 * - Günlük özet kapalıysa iptal edilir; açıksa yeni içerikle yeniden planlanır.
 * - Ani değişim uyarıları kapalıysa tüm slotlar iptal edilir; açıksa her slot
 *   yeniden değerlendirilir: geçerli değilse iptal, gelecekteyse zamanla,
 *   şu an/geçmişteyse HEMEN gösterilir (gün+slot bazlı dedup — dil-bağımsız).
 */
export async function refreshScheduledNotifications(
  weather: WeatherBundle | null,
  prefs: {
    notifDailyEnabled: boolean;
    notifTime: string;
    notifChangeAlertEnabled: boolean;
    lang: LangCode;
    locationName?: string;
  }
): Promise<void> {
  await ensureNotificationChannels(prefs.lang);

  // ---- 1) Günlük özet ----
  if (prefs.notifDailyEnabled) {
    const { hour, minute } = parseNotifTime(prefs.notifTime);
    const { title, body, largeBody } = buildNotificationContent(weather, prefs.notifTime, prefs.lang, prefs.locationName);
    await scheduleDailySummaryNotification(hour, minute, title, body, largeBody);
  } else {
    await cancelDailySummaryNotification();
  }

  // ---- 2) Ani değişim uyarıları ----
  if (!prefs.notifChangeAlertEnabled || !weather) {
    for (let i = 0; i < FUTURE_CHANGE_ALERT_SLOT_COUNT; i++) await cancelFutureChangeAlert(i);
    return;
  }

  const changes = detectUpcomingChanges(weather, prefs.lang);
  const bySlot = new Map(changes.map((c) => [c.slotIndex, c]));

  for (let i = 0; i < FUTURE_CHANGE_ALERT_SLOT_COUNT; i++) {
    const change = bySlot.get(i);
    if (!change) {
      await cancelFutureChangeAlert(i);
      continue;
    }
    if (change.isImmediate) {
      // Dil-bağımsız dedup: gün+slot. Başlık DİL içerdiği için anahtara hiç
      // konulmaz — dil değişince aynı uyarı tekrar ateşlenmesin.
      const dedupeKey = `${new Date().toDateString()}:${i}`;
      const lastKey = localStorage.getItem("mhd_last_immediate_change_key");
      if (lastKey !== dedupeKey) {
        localStorage.setItem("mhd_last_immediate_change_key", dedupeKey);
        await fireImmediateChangeAlert(change.title, change.body);
      }
      await cancelFutureChangeAlert(i);
    } else {
      await scheduleFutureChangeAlert(i, change.fireAt, change.title, change.body);
    }
  }
}

function parseNotifTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}
